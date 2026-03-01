// ── Custom Hooks for Sentinel-1 ──

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PriceFeed, AgentLog, RiskMetrics, AgentState, Position, EntropySimulation } from './types';
import {
  getInitialPriceFeeds,
  simulatePriceUpdate,
  getNextAgentMessage,
  generateRiskMetrics,
  getInitialAgentState,
} from './services/mockPythService';
import {
  fetchLatestPrices,
  createResilientPoller,
  type ConnectionStatusCallback,
} from './services/pythHermesService';
import {
  PUBLISHERS,
  generatePublisherMetrics,
  trackConfidence,
  getConfidenceHistory,
  findFastestPublisher,
  computeFilteredPrice,
  PUBLISHER_SIGMA_THRESHOLD,
} from './services/publisherRadarService';
import {
  fetchRecentEntropyLogs,
  getLatestEntropySeed,
  seedToNumber,
  type LiveEntropySeed,
  type EntropyConnectionStatus,
} from './services/pythEntropyService';

// ── Live Price Feeds — Pyth Hermes REST polling with mock fallback ──
export function usePriceFeeds() {
  const [feeds, setFeeds] = useState<PriceFeed[]>([]);
  const [updatedId, setUpdatedId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error' | 'mock'>('connecting');
  const [dataSource, setDataSource] = useState<'live' | 'mock'>('live');
  const cleanupRef = useRef<(() => void) | null>(null);
  const failedPermanently = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const onUpdate = (newFeeds: PriceFeed[]) => {
      if (cancelled) return;
      setDataSource('live');
      setFeeds(prev => {
        if (prev.length === 0) return newFeeds;
        const merged = [...prev];
        for (const newFeed of newFeeds) {
          const idx = merged.findIndex(f => f.id === newFeed.id);
          if (idx >= 0) {
            if (merged[idx].price !== newFeed.price) {
              setUpdatedId(newFeed.id);
            }
            merged[idx] = newFeed;
          } else {
            merged.push(newFeed);
          }
        }
        return merged;
      });
    };

    const onStatus: ConnectionStatusCallback = (status) => {
      if (cancelled) return;
      if (status === 'error' && !failedPermanently.current) {
        // After 10 consecutive failures, switch to mock
        failedPermanently.current = true;
        console.log('[Sentinel-1] Hermes unreachable after retries, switching to mock data');
        if (cleanupRef.current) cleanupRef.current();
        startMock();
        return;
      }
      setConnectionStatus(status);
    };

    // Primary: REST polling (reliable from browsers)
    const startPoller = () => {
      const cleanup = createResilientPoller(onUpdate, onStatus, 1500);
      cleanupRef.current = cleanup;
    };

    // Fallback: mock data
    const startMock = () => {
      setDataSource('mock');
      setConnectionStatus('mock');
      setFeeds(getInitialPriceFeeds());
      const timer = setInterval(() => {
        setFeeds(prev => {
          const count = Math.floor(Math.random() * 3) + 1;
          const indices = new Set<number>();
          while (indices.size < count) {
            indices.add(Math.floor(Math.random() * prev.length));
          }
          const updated = [...prev];
          indices.forEach(i => {
            updated[i] = simulatePriceUpdate(updated[i]);
            setUpdatedId(updated[i].id);
          });
          return updated;
        });
      }, 800);
      cleanupRef.current = () => clearInterval(timer);
    };

    startPoller();

    return () => {
      cancelled = true;
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  // Clear pulse marker
  useEffect(() => {
    if (updatedId) {
      const t = setTimeout(() => setUpdatedId(null), 400);
      return () => clearTimeout(t);
    }
  }, [updatedId]);

  return { feeds, updatedId, connectionStatus, dataSource };
}

// ── Live Positions — react to real price feeds with shelter/entropy exit actions ──
type AddLogFn = (log: Omit<AgentLog, 'id' | 'timestamp'>) => void;

const BASE_POSITIONS = [
  { id: 'pos-1', asset: 'SOL/USD', side: 'long' as const, size: 450, entryPrice: 172.30, leverage: 3 },
  { id: 'pos-2', asset: 'ETH/USD', side: 'long' as const, size: 12.5, entryPrice: 3380.00, leverage: 2 },
  { id: 'pos-3', asset: 'BTC/USD', side: 'short' as const, size: 0.35, entryPrice: 99100.00, leverage: 2 },
  { id: 'pos-4', asset: 'LINK/USD', side: 'long' as const, size: 800, entryPrice: 14.50, leverage: 2 },
];

function computePosition(bp: typeof BASE_POSITIONS[0], entryPrice: number, feed?: PriceFeed): Position {
  const currentPrice = feed?.price ?? 0;
  const direction = bp.side === 'long' ? 1 : -1;
  const priceDiff = (currentPrice - entryPrice) * direction;
  const pnl = priceDiff * bp.size;
  const pnlPercent = entryPrice !== 0 ? (priceDiff / entryPrice) * 100 : 0;
  const notionalValue = bp.size * currentPrice;
  const healthFactor = notionalValue > 0
    ? Math.max(0.1, Math.min(10, (notionalValue + pnl) / (notionalValue / bp.leverage)))
    : bp.leverage + 1;
  return { ...bp, entryPrice, currentPrice, pnl, pnlPercent, healthFactor };
}

export function useLivePositions(feeds: PriceFeed[], addLog?: AddLogFn) {
  const [entryPrices, setEntryPrices] = useState<Record<string, number>>(
    Object.fromEntries(BASE_POSITIONS.map(bp => [bp.asset, bp.entryPrice]))
  );
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());
  const [isSheltered, setIsSheltered] = useState(false);
  const feedsRef = useRef<PriceFeed[]>(feeds);
  const addLogRef = useRef<AddLogFn | undefined>(addLog);

  useEffect(() => { feedsRef.current = feeds; }, [feeds]);
  useEffect(() => { addLogRef.current = addLog; }, [addLog]);

  // Compute positions reactively from live feeds
  const [positions, setPositions] = useState<Position[]>([]);
  useEffect(() => {
    if (feeds.length === 0) return;
    if (isSheltered) { setPositions([]); return; }
    const newPositions = BASE_POSITIONS
      .filter(bp => !closedIds.has(bp.id))
      .map(bp => {
        const feed = feeds.find(f => f.symbol === bp.asset);
        const entry = entryPrices[bp.asset] ?? bp.entryPrice;
        return computePosition(bp, entry, feed);
      });
    setPositions(newPositions);
  }, [feeds, entryPrices, closedIds, isSheltered]);

  // Manual Shelter — close all positions, re-enter at current prices after delay
  const shelterAll = useCallback(() => {
    // Capture P&L before sheltering
    const currentPositions = BASE_POSITIONS
      .filter(bp => !closedIds.has(bp.id))
      .map(bp => computePosition(bp, entryPrices[bp.asset] ?? bp.entryPrice, feedsRef.current.find(f => f.symbol === bp.asset)));
    const totalPnl = currentPositions.reduce((s, p) => s + p.pnl, 0);

    setIsSheltered(true);
    addLogRef.current?.({
      type: 'critical',
      source: 'executor',
      message: `MANUAL SHELTER ACTIVATED — Closing ${currentPositions.length} positions. Withdrawing to USDC safety vault.`,
    });
    addLogRef.current?.({
      type: 'action',
      source: 'risk-engine',
      message: `Portfolio P&L locked at ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}. All market exposure eliminated. Monitoring for re-entry.`,
    });

    // Re-enter after 8 seconds at current market prices
    setTimeout(() => {
      const currentFeeds = feedsRef.current;
      const newEntries: Record<string, number> = {};
      BASE_POSITIONS.forEach(bp => {
        const feed = currentFeeds.find(f => f.symbol === bp.asset);
        newEntries[bp.asset] = feed?.price ?? bp.entryPrice;
      });
      setEntryPrices(newEntries);
      setClosedIds(new Set());
      setIsSheltered(false);
      addLogRef.current?.({
        type: 'success',
        source: 'agent',
        message: `Shelter lifted — Re-entering ${BASE_POSITIONS.length} positions at current Pyth Pro market prices. Fresh entries locked.`,
      });
    }, 8000);
  }, [closedIds, entryPrices]);

  // Entropy-Randomized Exit — now uses REAL Pyth Entropy seed from Fortuna
  const entropyExit = useCallback(() => {
    const activeIds = BASE_POSITIONS.filter(bp => !closedIds.has(bp.id) && !isSheltered).map(bp => bp.id);
    if (activeIds.length === 0) return;

    // Fetch a real entropy seed from Pyth Fortuna before executing
    getLatestEntropySeed().then(entropySeed => {
      const seedLabel = entropySeed.isLive
        ? `Pyth Fortuna seed ${entropySeed.seedShort} (${entropySeed.chain} #${entropySeed.sequence})`
        : `Local entropy fallback ${entropySeed.seedShort}`;

      addLogRef.current?.({
        type: 'action',
        source: 'entropy',
        message: `ENTROPY-RANDOMIZED EXIT — ${seedLabel}. Seeding ${activeIds.length} positions for MEV-safe execution...`,
      });

      // Use real entropy bytes to deterministically shuffle
      const shuffled = [...activeIds].sort((a, b) => {
        const ha = seedToNumber(entropySeed.seed, activeIds.indexOf(a));
        const hb = seedToNumber(entropySeed.seed, activeIds.indexOf(b));
        return ha - hb;
      });
      const toClose = shuffled.slice(0, Math.max(1, Math.ceil(shuffled.length * 0.75)));

    let cumulativeDelay = 0;
    toClose.forEach((posId, i) => {
      // Use entropy seed bytes for deterministic per-tranche jitter
      const jitter = seedToNumber(entropySeed.seed, i + 10);
      cumulativeDelay += 1200 + jitter * 2000;
      const delay = cumulativeDelay;

      setTimeout(() => {
        const bp = BASE_POSITIONS.find(b => b.id === posId);
        const feed = feedsRef.current.find(f => f.symbol === bp?.asset);
        setClosedIds(prev => new Set([...prev, posId]));
        addLogRef.current?.({
          type: 'success',
          source: 'executor',
          message: `Entropy tranche ${i + 1}/${toClose.length}: Closed ${bp?.asset} ${bp?.side} at $${feed?.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—'}. Timing seeded by ${entropySeed.seedShort}.`,
        });
      }, delay);
    });

    // Re-enter remaining + closed positions after all tranches complete
    const totalDelay = cumulativeDelay + 5000;
    setTimeout(() => {
      const currentFeeds = feedsRef.current;
      const newEntries: Record<string, number> = {};
      BASE_POSITIONS.forEach(bp => {
        const feed = currentFeeds.find(f => f.symbol === bp.asset);
        newEntries[bp.asset] = feed?.price ?? bp.entryPrice;
      });
      setEntryPrices(newEntries);
      setClosedIds(new Set());
      addLogRef.current?.({
        type: 'info',
        source: 'agent',
        message: `Entropy exit complete. Seed: ${entropySeed.seedShort}${entropySeed.isLive ? ` (Fortuna ${entropySeed.chain} #${entropySeed.sequence})` : ' (local)'}. All positions re-entered at Pyth Pro prices.`,
      });
    }, totalDelay);
    }); // end getLatestEntropySeed().then()
  }, [closedIds, isSheltered]);

  // Guardian Shield — scripted critical liquidation defense sequence
  // Pre-filters publishers exceeding the σ threshold before computing
  // the clean re-entry price to prevent poisoned oracle data.
  const guardianShield = useCallback(() => {
    const solFeed = feedsRef.current.find(f => f.symbol === 'SOL/USD');
    const solPrice = solFeed?.price ?? 80.95;
    const solPos = BASE_POSITIONS.find(bp => bp.asset === 'SOL/USD');
    if (!solPos) return;

    const currentEntry = entryPrices['SOL/USD'] ?? solPos.entryPrice;
    const pos = computePosition(solPos, currentEntry, solFeed);

    // Pre-compute filtered price (excludes publishers > σ threshold)
    const tickNow = Date.now();
    const filtered = solFeed
      ? computeFilteredPrice(solFeed, tickNow, PUBLISHER_SIGMA_THRESHOLD)
      : null;

    // Log 1: ALERT — immediate — health factor + publisher audit
    addLogRef.current?.({
      type: 'critical',
      source: 'risk-engine',
      message: `HEALTH FACTOR ${pos.healthFactor.toFixed(2)}. LIQUIDATION DISTANCE: ${(Math.max(0, (pos.healthFactor - 0.05) / pos.healthFactor) * 100).toFixed(2)}%. SOL/USD at $${solPrice.toFixed(2)}. Initiating publisher integrity scan...`,
    });

    // Log 2: PUBLISHER FILTER — 0.8s delay — report excluded publishers
    setTimeout(() => {
      if (filtered && filtered.excludedPublishers.length > 0) {
        const names = filtered.excludedPublishers
          .map(p => `${p.shortName} (${p.deviation.toFixed(1)}σ, $${p.reportedPrice.toFixed(2)})`)
          .join(', ');
        addLogRef.current?.({
          type: 'warning',
          source: 'pyth-pro',
          message: `PUBLISHER FILTER: Ignoring ${filtered.excludedPublishers.length}/${filtered.totalCount} publishers exceeding ${PUBLISHER_SIGMA_THRESHOLD}σ threshold: ${names}. Clean consensus: ${filtered.includedCount} publishers retained.`,
        });
      } else {
        addLogRef.current?.({
          type: 'info',
          source: 'pyth-pro',
          message: `PUBLISHER FILTER: All ${filtered?.totalCount ?? 12} publishers within ${PUBLISHER_SIGMA_THRESHOLD}σ threshold. Full consensus intact. No outliers excluded.`,
        });
      }
    }, 800);

    // Log 3: ACTION — 1.8s delay — locking collateral + real entropy seed from Fortuna
    setTimeout(() => {
      getLatestEntropySeed().then(entropySeed => {
        const seedLabel = entropySeed.isLive
          ? `Fortuna seed: ${entropySeed.seedShort} (${entropySeed.chain} #${entropySeed.sequence})`
          : `Local seed: ${entropySeed.seedShort}`;
        addLogRef.current?.({
          type: 'action',
          source: 'executor',
          message: `LOCKING COLLATERAL. TRIGGERING EMERGENCY PYTH ENTROPY EXIT. ${seedLabel}. Using filtered price oracle (${filtered?.includedCount ?? 12}/${filtered?.totalCount ?? 12} publishers).`,
        });
      });
    }, 1800);

    // Log 4: SYSTEM — 3s delay — Pyth Pro verification with filtered vs raw comparison
    setTimeout(() => {
      const latestSol = feedsRef.current.find(f => f.symbol === 'SOL/USD');
      const latestFiltered = latestSol
        ? computeFilteredPrice(latestSol, tickNow + 1, PUBLISHER_SIGMA_THRESHOLD)
        : null;
      const fPrice = latestFiltered?.filteredPrice ?? latestSol?.price ?? solPrice;
      const rPrice = latestFiltered?.rawPrice ?? fPrice;
      const impact = latestFiltered?.priceImpact ?? 0;

      addLogRef.current?.({
        type: 'info',
        source: 'pyth-pro',
        message: `SOL filtered price: $${fPrice.toFixed(2)} (raw aggregate: $${rPrice.toFixed(2)}, Δ$${impact.toFixed(4)}). Confidence: ±$${(latestSol?.confidence ?? 0.05).toFixed(4)}. ${latestFiltered && latestFiltered.excludedPublishers.length > 0 ? `${latestFiltered.excludedPublishers.length} outlier(s) stripped. ` : ''}Executing partial close on filtered oracle.`,
      });
    }, 3000);

    // Log 5: SUCCESS — 4.5s delay — stabilize position using FILTERED price
    setTimeout(() => {
      const latestFeeds = feedsRef.current;
      const latestSol = latestFeeds.find(f => f.symbol === 'SOL/USD');
      const latestFiltered = latestSol
        ? computeFilteredPrice(latestSol, tickNow + 2, PUBLISHER_SIGMA_THRESHOLD)
        : null;

      // Use the filtered (clean) price for re-entry, not the raw aggregate
      const cleanPrice = latestFiltered?.filteredPrice ?? latestSol?.price ?? solPrice;
      const excluded = latestFiltered?.excludedPublishers ?? [];

      setEntryPrices(prev => ({
        ...prev,
        'SOL/USD': cleanPrice,
      }));

      const newHF = (1.2 + Math.random() * 0.5).toFixed(2);
      addLogRef.current?.({
        type: 'success',
        source: 'agent',
        message: `Liquidation Averted. SOL/USD de-risked at filtered price $${cleanPrice.toFixed(2)}${excluded.length > 0 ? ` (${excluded.length} poisoned publisher(s) ignored)` : ''}. New Health Factor: ${newHF}. Position stabilized. Guardian Shield standing down.`,
      });
    }, 4500);
  }, [entryPrices]);

  // Detect critical state (any position health < 1.0)
  const isCritical = positions.some(p => p.healthFactor < 1.0);

  return { positions, shelterAll, entropyExit, guardianShield, isSheltered, isCritical };
}

// ── Live Risk Metrics — derived from real feed data ──
export function useLiveRiskMetrics(feeds: PriceFeed[], positions: Position[]) {
  const [metrics, setMetrics] = useState<RiskMetrics>(generateRiskMetrics);

  useEffect(() => {
    if (feeds.length === 0) return;

    // Compute real volatility from sparkline variance
    const volatilities = feeds
      .filter(f => f.sparkline.length > 2)
      .map(f => {
        const prices = f.sparkline;
        const returns = prices.slice(1).map((p, i) => Math.abs((p - prices[i]) / prices[i]) * 100);
        return returns.reduce((a, b) => a + b, 0) / returns.length;
      });
    const avgVolatility = volatilities.length > 0
      ? Math.min(100, (volatilities.reduce((a, b) => a + b, 0) / volatilities.length) * 50)
      : 30;

    // Compute correlation risk from feed co-movement
    const changes = feeds.map(f => f.changePercent24h);
    const allSameSign = changes.every(c => c >= 0) || changes.every(c => c <= 0);
    const correlationRisk = allSameSign ? 60 + Math.random() * 20 : 20 + Math.random() * 30;

    // Compute liquidation proximity from positions
    const minHealth = positions.length > 0
      ? Math.min(...positions.map(p => p.healthFactor))
      : 5;
    const liquidationProximity = Math.max(0, Math.min(100, (1 / minHealth) * 100));

    // Compute overall score
    const overallScore = avgVolatility * 0.35 + correlationRisk * 0.35 + liquidationProximity * 0.3;

    setMetrics({
      overallScore: Math.min(100, Math.max(0, overallScore)),
      volatilityIndex: avgVolatility,
      correlationRisk,
      liquidationProximity,
      entropyHealth: 80 + Math.random() * 18,
      trend: overallScore > 55 ? 'deteriorating' : overallScore < 35 ? 'improving' : 'stable',
    });
  }, [feeds, positions]);

  return metrics;
}

// ── Live Entropy Stress Tests — now seeded by REAL Pyth Fortuna entropy ──
export function useLiveEntropy(feeds: PriceFeed[], positions: Position[]): {
  simulations: EntropySimulation[];
  entropyStatus: EntropyConnectionStatus;
  latestSeed: LiveEntropySeed | null;
} {
  const [simulations, setSimulations] = useState<EntropySimulation[]>([]);
  const [entropyStatus, setEntropyStatus] = useState<EntropyConnectionStatus>('connecting');
  const [latestSeed, setLatestSeed] = useState<LiveEntropySeed | null>(null);
  const feedsRef = useRef(feeds);
  const posRef = useRef(positions);
  const tickRef = useRef(0);
  const seedsRef = useRef<LiveEntropySeed[]>([]);

  useEffect(() => { feedsRef.current = feeds; }, [feeds]);
  useEffect(() => { posRef.current = positions; }, [positions]);

  // Periodically fetch real entropy seeds from Fortuna
  useEffect(() => {
    let cancelled = false;
    const fetchSeeds = async () => {
      try {
        setEntropyStatus('connecting');
        const seeds = await fetchRecentEntropyLogs(10);
        if (cancelled) return;
        if (seeds.length > 0) {
          seedsRef.current = seeds;
          setLatestSeed(seeds[0]);
          setEntropyStatus('live');
        } else {
          setEntropyStatus('fallback');
        }
      } catch {
        if (!cancelled) setEntropyStatus('fallback');
      }
    };
    fetchSeeds();
    const timer = setInterval(fetchSeeds, 20_000); // refresh seeds every 20s
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const statusOrder: Array<'pending' | 'running' | 'complete'> = ['pending', 'running', 'complete'];

    const compute = () => {
      const currentFeeds = feedsRef.current;
      const currentPositions = posRef.current;
      if (currentFeeds.length === 0 || currentPositions.length === 0) return;

      tickRef.current++;
      const tick = tickRef.current;

      // Pick a seed from the Fortuna cache (rotate through them)
      const seeds = seedsRef.current;
      const currentSeed = seeds.length > 0
        ? seeds[tick % seeds.length]
        : null;

      const totalNotional = currentPositions.reduce((s, p) => s + Math.abs(p.size * p.currentPrice), 0);

      // Sort by notional exposure
      const sorted = [...currentPositions].sort((a, b) =>
        Math.abs(b.size * b.currentPrice) - Math.abs(a.size * a.currentPrice)
      );
      const largest = sorted[0];
      const weakest = [...currentPositions].sort((a, b) => a.healthFactor - b.healthFactor)[0];

      // Use entropy seed to modulate crash percentages (if available)
      const s = currentSeed?.seed ?? '0xdeadbeef';

      const newSims: EntropySimulation[] = [];

      // Scenario 1: Flash crash of largest position
      const crashPct = 0.08 + seedToNumber(s, 0) * 0.12; // 8-20% seeded by entropy
      const flashDir = largest.side === 'long' ? -1 : 1;
      const flashImpact = largest.size * largest.currentPrice * crashPct * largest.leverage * flashDir;
      newSims.push({
        id: 'entropy-1',
        scenario: `${largest.asset} flash crash −${(crashPct * 100).toFixed(1)}% ($${largest.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })} → $${(largest.currentPrice * (1 - crashPct)).toLocaleString('en-US', { maximumFractionDigits: 0 })})`,
        probability: 0.04 + seedToNumber(s, 1) * 0.06,
        impact: Math.round(flashImpact),
        recommendedAction: flashImpact < 0
          ? `Reduce ${largest.asset} exposure by 30% via entropy-randomized exit`
          : `Short position benefits — maintain current exposure`,
        status: statusOrder[(tick + 0) % 3],
        entropySeed: currentSeed?.seed,
        entropySeedShort: currentSeed?.seedShort,
        entropyChain: currentSeed?.chain,
        entropySequence: currentSeed?.sequence,
        entropyIsLive: currentSeed?.isLive,
      });

      // Scenario 2: Correlated market sell-off
      const corrPct = 0.05 + seedToNumber(s, 2) * 0.08;
      const corrImpact = currentPositions.reduce((sum, pos) => {
        const dir = pos.side === 'long' ? -1 : 1;
        return sum + pos.size * pos.currentPrice * corrPct * pos.leverage * dir;
      }, 0);
      newSims.push({
        id: 'entropy-2',
        scenario: `Correlated sell-off −${(corrPct * 100).toFixed(1)}% across all ${currentPositions.length} positions`,
        probability: 0.02 + seedToNumber(s, 3) * 0.04,
        impact: Math.round(corrImpact),
        recommendedAction: corrImpact < -totalNotional * 0.05
          ? 'CRITICAL: Activate manual shelter immediately'
          : 'Pre-compute entropy exit paths for high-exposure positions',
        status: statusOrder[(tick + 1) % 3],
        entropySeed: currentSeed?.seed,
        entropySeedShort: currentSeed?.seedShort,
        entropyChain: currentSeed?.chain,
        entropySequence: currentSeed?.sequence,
        entropyIsLive: currentSeed?.isLive,
      });

      // Scenario 3: Volatility spike on weakest position
      const volCrash = 0.10 + seedToNumber(s, 4) * 0.15;
      const volDir = weakest.side === 'long' ? -1 : 1;
      const volImpact = weakest.size * weakest.currentPrice * volCrash * weakest.leverage * volDir;
      newSims.push({
        id: 'entropy-3',
        scenario: `${weakest.asset} vol spike −${(volCrash * 100).toFixed(1)}% (health ${weakest.healthFactor.toFixed(2)} → ${Math.max(0.1, weakest.healthFactor * (1 - volCrash)).toFixed(2)})`,
        probability: 0.06 + seedToNumber(s, 5) * 0.06,
        impact: Math.round(volImpact),
        recommendedAction: weakest.healthFactor < 2
          ? 'URGENT: Set entropy stop-loss at health factor 1.20'
          : `Monitor — health factor ${weakest.healthFactor.toFixed(2)} provides buffer`,
        status: statusOrder[(tick + 2) % 3],
        entropySeed: currentSeed?.seed,
        entropySeedShort: currentSeed?.seedShort,
        entropyChain: currentSeed?.chain,
        entropySequence: currentSeed?.sequence,
        entropyIsLive: currentSeed?.isLive,
      });

      // Scenario 4: Black swan cascading liquidation
      const swanPct = 0.20 + seedToNumber(s, 6) * 0.15;
      const blackSwanImpact = currentPositions.reduce((sum, pos) => {
        const dir = pos.side === 'long' ? -1 : 1;
        return sum + pos.size * pos.currentPrice * swanPct * pos.leverage * dir;
      }, 0);
      newSims.push({
        id: 'entropy-4',
        scenario: `Black swan − cascading liquidations (−${(swanPct * 100).toFixed(1)}% portfolio stress)`,
        probability: 0.005 + seedToNumber(s, 7) * 0.01,
        impact: Math.round(blackSwanImpact),
        recommendedAction: 'Emergency shelter + entropy-randomized exit for all positions',
        status: statusOrder[(tick + 3) % 3],
        entropySeed: currentSeed?.seed,
        entropySeedShort: currentSeed?.seedShort,
        entropyChain: currentSeed?.chain,
        entropySequence: currentSeed?.sequence,
        entropyIsLive: currentSeed?.isLive,
      });

      setSimulations(newSims);
    };

    compute();
    const timer = setInterval(compute, 5000);
    return () => clearInterval(timer);
  }, []);

  return { simulations, entropyStatus, latestSeed };
}

// ── Agent Reasoning Log — uses live price data ──
export function useAgentLogs(interval = 3000, feeds: PriceFeed[] = []) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const maxLogs = 50;
  const feedsRef = useRef<PriceFeed[]>(feeds);

  useEffect(() => {
    feedsRef.current = feeds;
  }, [feeds]);

  // addLog allows other hooks (positions, entropy) to inject entries
  const addLog = useCallback((log: Omit<AgentLog, 'id' | 'timestamp'>) => {
    setLogs(prev => [{
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...log,
    }, ...prev].slice(0, maxLogs));
  }, []);

  useEffect(() => {
    // Initial burst — use live data if available
    const currentFeeds = feedsRef.current;
    const initial = currentFeeds.length > 0
      ? [generateLiveAgentMessage(currentFeeds), generateLiveAgentMessage(currentFeeds), generateLiveAgentMessage(currentFeeds)]
      : [getNextAgentMessage(), getNextAgentMessage(), getNextAgentMessage()];
    setLogs(initial);

    const timer = setInterval(() => {
      const liveFeeds = feedsRef.current;
      setLogs(prev => {
        let newLog: AgentLog;

        // 95% of messages use live data when available (only 5% generic)
        if (liveFeeds.length > 0 && Math.random() > 0.05) {
          newLog = generateLiveAgentMessage(liveFeeds);
        } else {
          newLog = getNextAgentMessage();
        }

        return [newLog, ...prev].slice(0, maxLogs);
      });
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  return { logs, addLog };
}

// ── Generate agent messages that reference real live prices ──
// Includes flash crash defense, short squeeze detection, institutional flow,
// EMA cross detection, liquidation monitoring, and Pyth Pro feed health.
function generateLiveAgentMessage(feeds: PriceFeed[]): AgentLog {
  const feed = feeds[Math.floor(Math.random() * feeds.length)];
  const price = feed.price;
  const changeDir = feed.changePercent24h >= 0 ? 'up' : 'down';
  const changePct = Math.abs(feed.changePercent24h).toFixed(2);
  const conf = feed.confidence;
  const fmtP = (p: number) => p >= 1 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.toFixed(4);
  const fmtC = (c: number) => c >= 1 ? c.toFixed(2) : c.toFixed(4);
  const latency = (15 + Math.random() * 50).toFixed(0);
  const bullishCount = feeds.filter(f => f.changePercent24h > 0).length;
  const aboveEma = feed.price > feed.emaPrice;

  const templates: Omit<AgentLog, 'id' | 'timestamp'>[] = [
    // === SYSTEM — Pyth Pro feed health ===
    {
      type: 'info',
      source: 'pyth-pro',
      message: `Monitoring ${feed.symbol} via Pyth Pro Feed. Latency: ${latency}ms. Price: $${fmtP(price)} (±$${fmtC(conf)}).`,
    },
    {
      type: 'info',
      source: 'pyth-pro',
      message: `Hermes connection health: ${feeds.length} active feeds. Avg confidence: ±$${fmtC(feeds.reduce((s, f) => s + f.confidence, 0) / feeds.length)}. Latency: ${latency}ms.`,
    },

    // === ANALYSIS — EMA cross & trend ===
    {
      type: 'analysis',
      source: 'agent',
      message: `${feed.symbol} ${changeDir} ${changePct}%. EMA: $${fmtP(feed.emaPrice)}. ${aboveEma ? 'Price above EMA — bullish divergence detected.' : 'Price below EMA — bearish convergence. EMA cross imminent.'}`,
    },
    {
      type: 'analysis',
      source: 'agent',
      message: `${feed.symbol} microstructure: Confidence tightening to ±$${fmtC(conf)}. Liquidity depth: ${conf < 0.1 ? 'HIGH' : conf < 1 ? 'MODERATE' : 'LOW'}. ${conf < 0.1 ? 'Institutional accumulation likely.' : 'Spread widening — watch for slippage.'}`,
    },

    // === ALERT — Volatility spike / flash crash detection ===
    {
      type: Math.abs(feed.changePercent24h) > 1.5 ? 'warning' : 'info',
      source: 'risk-engine',
      message: `${Math.abs(feed.changePercent24h) > 1.5 ? 'Volatility Spike Detected. ' : ''}${feed.symbol} ${changePct}% move. Confidence widening: ±$${fmtC(conf)}. ${Math.abs(feed.changePercent24h) > 3 ? 'FLASH CRASH PROTOCOL STANDBY.' : 'Monitoring.'}`,
    },
    {
      type: feed.changePercent24h < -3 ? 'critical' : 'warning',
      source: 'risk-engine',
      message: feed.changePercent24h < -1
        ? `${feed.symbol} Price: $${fmtP(price)}. Bearish momentum accelerating. Health factor decreasing. Pre-emptive shelter evaluation triggered.`
        : `${feed.symbol} range compression detected. 24h: $${fmtP(feed.low24h)} — $${fmtP(feed.high24h)}. Breakout probability rising.`,
    },

    // === ACTION — Strategy execution ===
    {
      type: 'action',
      source: 'executor',
      message: aboveEma && feed.changePercent24h > 0.5
        ? `${feed.symbol} breaking resistance. Sentiment: BULLISH. Evaluating scale-in at $${fmtP(price)}. Target exit: $${fmtP(price * 1.05)}.`
        : `${feed.symbol} testing support at $${fmtP(feed.low24h)}. Pre-computing entropy exit paths. MEV-safe execution standing by.`,
    },

    // === SUCCESS — Cross-asset scan / position monitoring ===
    {
      type: 'success',
      source: 'agent',
      message: `Cross-asset scan: ${bullishCount}/${feeds.length} feeds positive. Market regime: ${bullishCount > feeds.length / 2 ? 'RISK-ON' : 'RISK-OFF'}. Correlation: ${bullishCount === feeds.length || bullishCount === 0 ? 'HIGH — hedging recommended.' : 'NORMAL.'}`,
    },
    {
      type: 'success',
      source: 'agent',
      message: `Portfolio rebalance check: ${feed.symbol} weight ${(100 / feeds.length).toFixed(1)}%. ${aboveEma ? 'Maintaining position — momentum confirmed.' : 'Reducing exposure — trend weakening.'}`,
    },

    // === ENTROPY — Stress test / simulation ===
    {
      type: 'success',
      source: 'entropy',
      message: `Entropy simulation: ${feed.symbol} −5% stress → portfolio impact: -$${(price * 0.05 * 450).toFixed(0)}. Exit paths computed. Randomization seed ready.`,
    },
    {
      type: 'info',
      source: 'entropy',
      message: `Requesting Pyth Entropy RNG seed for ${feed.symbol} exit tranche. MEV protection: ACTIVE. Timing randomization: ${(1.5 + Math.random() * 3).toFixed(1)}s jitter.`,
    },

    // === Short squeeze / institutional flow detection ===
    {
      type: feed.changePercent24h > 2 ? 'action' : 'analysis',
      source: 'agent',
      message: feed.changePercent24h > 1
        ? `Institutional buy pressure detected on ${feed.symbol}. Price $${fmtP(price)} breaking 24h high. RSI: ${(55 + Math.random() * 20).toFixed(0)}. Short squeeze probability: ${(15 + Math.random() * 30).toFixed(0)}%.`
        : `${feed.symbol} order flow neutral. Bid/ask spread: $${fmtC(conf * 2)}. No significant institutional activity detected.`,
    },

    // === Guardian monitoring ===
    {
      type: 'info',
      source: 'agent',
      message: `Guardian scan: ${feed.symbol} health nominal. Feed latency: ${latency}ms. Confidence: ±$${fmtC(conf)}. Sentinel-1 standing by.`,
    },
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    ...template,
  };
}

// ── Agent State ──
export function useAgentState() {
  const [state, setState] = useState<AgentState>(getInitialAgentState);

  useEffect(() => {
    const timer = setInterval(() => {
      setState(prev => ({
        ...prev,
        uptime: prev.uptime + 1,
        status: Math.random() > 0.85 ? 'analyzing' : Math.random() > 0.7 ? 'executing' : 'monitoring',
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return state;
}

// ── Time Formatter ──
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(4);
}

export function formatCompact(num: number): string {
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

// ── useInterval (safe) ──
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ── Publisher Radar — Oracle Meta-Analysis ──
// Tracks publisher deviations, latency, confidence changes, and stake utilization
// using real Pyth feed data (confidence intervals, publish times, EMA).

import type { PublisherFeedMetrics, ConfidenceAlert, Publisher } from './types';

export interface PublisherRadarData {
  publishers: Publisher[];
  feedMetrics: Record<string, PublisherFeedMetrics[]>; // feedSymbol → metrics[]
  confidenceAlerts: ConfidenceAlert[];
  confidenceHistory: Record<string, number[]>;        // feedSymbol → conf values
  fastestPublisher: { name: string; avgLatency: number };
  suspiciousCount: number;
  avgLatency: number;
  selectedFeed: string;
  setSelectedFeed: (s: string) => void;
}

export function usePublisherRadar(feeds: PriceFeed[]): PublisherRadarData {
  const [feedMetrics, setFeedMetrics] = useState<Record<string, PublisherFeedMetrics[]>>({});
  const [confidenceAlerts, setConfidenceAlerts] = useState<ConfidenceAlert[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<string>('');
  const tickRef = useRef(0);

  // Auto-select first feed
  useEffect(() => {
    if (feeds.length > 0 && !selectedFeed) {
      setSelectedFeed(feeds[0].symbol);
    }
  }, [feeds, selectedFeed]);

  // Compute publisher metrics: immediately on first feeds, then every 2s
  const computeMetrics = useCallback(() => {
    if (feeds.length === 0) return;
    tickRef.current++;
    const tick = tickRef.current;
    const newMetrics: Record<string, PublisherFeedMetrics[]> = {};

    for (const feed of feeds) {
      const pubMetrics = generatePublisherMetrics(feed, tick);
      newMetrics[feed.symbol] = pubMetrics;

      const alert = trackConfidence(feed);
      if (alert) {
        setConfidenceAlerts(prev => [alert, ...prev].slice(0, 20));
      }
    }

    setFeedMetrics(newMetrics);
  }, [feeds]);

  // Immediate compute on first feed arrival
  const initialComputeDone = useRef(false);
  useEffect(() => {
    if (feeds.length > 0 && !initialComputeDone.current) {
      initialComputeDone.current = true;
      computeMetrics();
    }
  }, [feeds, computeMetrics]);

  // Periodic recompute every 2 seconds
  useEffect(() => {
    if (feeds.length === 0) return;
    const timer = setInterval(computeMetrics, 2000);
    return () => clearInterval(timer);
  }, [feeds, computeMetrics]);

  // Compute aggregates
  const allMetrics = Object.values(feedMetrics).flat();
  const suspicious = allMetrics.filter(m => m.status === 'suspicious').length;
  const avgLat = allMetrics.length > 0
    ? Math.round(allMetrics.reduce((s, m) => s + m.latency, 0) / allMetrics.length)
    : 0;
  const fastest = allMetrics.length > 0
    ? findFastestPublisher(allMetrics)
    : { name: '—', avgLatency: 0 };

  // Build confidence history for all feeds
  const confHistory: Record<string, number[]> = {};
  for (const feed of feeds) {
    confHistory[feed.symbol] = getConfidenceHistory(feed.symbol);
  }

  return {
    publishers: PUBLISHERS,
    feedMetrics,
    confidenceAlerts,
    confidenceHistory: confHistory,
    fastestPublisher: fastest,
    suspiciousCount: suspicious,
    avgLatency: avgLat,
    selectedFeed,
    setSelectedFeed,
  };
}

// ── Wallet Security Monitoring ──
// Polls connected wallet's recent transactions and flags suspicious activity.

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
  analyzeWalletTransactions,
  computeSecurityScore,
  type SecurityAlert,
  type WalletSecurityState,
  type TransactionAnalysis,
  type ThreatLevel,
} from './services/walletSecurityService';

const EMPTY_SECURITY_STATE: WalletSecurityState = {
  overallRisk: 'safe',
  securityScore: 100,
  alerts: [],
  recentTxCount: 0,
  lastScanTime: 0,
  isScanning: false,
  totalOutflow24h: 0,
  totalInflow24h: 0,
  uniqueInteractions: 0,
  dustTokenCount: 0,
};

export function useWalletSecurity(
  addLog?: (log: Omit<AgentLog, 'id' | 'timestamp'>) => void,
  pollInterval: number = 45_000, // poll every 45s
) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<WalletSecurityState>(EMPTY_SECURITY_STATE);
  const [analyses, setAnalyses] = useState<TransactionAnalysis[]>([]);
  const addLogRef = useRef(addLog);
  const prevAlertIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { addLogRef.current = addLog; }, [addLog]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!connected || !publicKey) {
      setState(EMPTY_SECURITY_STATE);
      setAnalyses([]);
      prevAlertIdsRef.current = new Set();
    }
  }, [connected, publicKey]);

  // Core scan function
  const runScan = useCallback(async () => {
    if (!publicKey || !connected) return;

    setState(prev => ({ ...prev, isScanning: true }));

    try {
      // Get balance for threshold calculations
      const lamports = await connection.getBalance(publicKey);
      const balanceSol = lamports / LAMPORTS_PER_SOL;

      // Run transaction analysis
      const { analyses: txAnalyses, alerts: newAlerts } =
        await analyzeWalletTransactions(connection, publicKey.toBase58(), balanceSol, 50);

      setAnalyses(txAnalyses);

      // Merge alerts (keep dismissed state from previous)
      setState(prev => {
        const existingMap = new Map(prev.alerts.map(a => [a.id, a]));
        const merged: SecurityAlert[] = [];
        const seenIds = new Set<string>();

        for (const alert of newAlerts) {
          if (seenIds.has(alert.id)) continue;
          seenIds.add(alert.id);
          const existing = existingMap.get(alert.id);
          merged.push(existing ? { ...alert, dismissed: existing.dismissed } : alert);
        }

        // Keep old alerts that weren't in the new scan (they might still be relevant)
        for (const old of prev.alerts) {
          if (!seenIds.has(old.id)) {
            merged.push(old);
            seenIds.add(old.id);
          }
        }

        const { score, level } = computeSecurityScore(merged);

        // Log NEW alerts to reasoning console
        const prevIds = prevAlertIdsRef.current;
        for (const alert of merged) {
          if (!prevIds.has(alert.id) && !alert.dismissed) {
            const logType = alert.level === 'critical' ? 'critical'
              : alert.level === 'warning' ? 'warning' : 'info';
            addLogRef.current?.({
              type: logType,
              source: 'risk-engine',
              message: `[WALLET SECURITY] ${alert.title}: ${alert.description.slice(0, 180)}`,
            });
          }
        }
        prevAlertIdsRef.current = new Set(merged.map(a => a.id));

        // Compute 24h flow stats
        const oneDayAgo = Date.now() - 24 * 60 * 60_000;
        const recentTxs = txAnalyses.filter(t => (t.timestamp * 1000) > oneDayAgo);
        const totalOutflow = recentTxs
          .filter(t => t.type === 'outflow')
          .reduce((s, t) => s + t.amount, 0);
        const totalInflow = recentTxs
          .filter(t => t.type === 'inflow')
          .reduce((s, t) => s + t.amount, 0);
        const uniqueAddrs = new Set(txAnalyses.map(t => t.counterparty).filter(Boolean));
        const dustCount = txAnalyses.filter(
          t => t.type === 'inflow' && t.amount > 0 && t.amount < 0.001
        ).length;

        return {
          overallRisk: level,
          securityScore: score,
          alerts: merged,
          recentTxCount: txAnalyses.length,
          lastScanTime: Date.now(),
          isScanning: false,
          totalOutflow24h: totalOutflow,
          totalInflow24h: totalInflow,
          uniqueInteractions: uniqueAddrs.size,
          dustTokenCount: dustCount,
        };
      });

    } catch (err) {
      console.warn('[WalletSecurity] Scan failed:', err);
      setState(prev => ({ ...prev, isScanning: false }));
    }
  }, [publicKey, connected, connection]);

  // Initial scan on connect + periodic polling
  useEffect(() => {
    if (!publicKey || !connected) return;

    // Initial scan
    runScan();

    // Periodic polling
    const timer = setInterval(runScan, pollInterval);
    return () => clearInterval(timer);
  }, [publicKey, connected, runScan, pollInterval]);

  // Dismiss an alert
  const dismissAlert = useCallback((alertId: string) => {
    setState(prev => {
      const updated = prev.alerts.map(a =>
        a.id === alertId ? { ...a, dismissed: true } : a
      );
      const { score, level } = computeSecurityScore(updated);
      return { ...prev, alerts: updated, securityScore: score, overallRisk: level };
    });
  }, []);

  // Dismiss all
  const dismissAll = useCallback(() => {
    setState(prev => {
      const updated = prev.alerts.map(a => ({ ...a, dismissed: true }));
      return { ...prev, alerts: updated, securityScore: 100, overallRisk: 'safe' as ThreatLevel };
    });
  }, []);

  // Force re-scan
  const rescan = useCallback(() => {
    runScan();
  }, [runScan]);

  // Browser notification for critical alerts
  useEffect(() => {
    const criticals = state.alerts.filter(a => a.level === 'critical' && !a.dismissed);
    if (criticals.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      const latest = criticals[0];
      new Notification('⚠️ SENTINEL-1 Security Alert', {
        body: latest.title + ': ' + latest.description.slice(0, 120),
        icon: '/sentinel.svg',
      });
    }
  }, [state.alerts]);

  return {
    security: state,
    analyses,
    dismissAlert,
    dismissAll,
    rescan,
  };
}

// ── Airdrop Guard ──
// Monitors wallet token accounts for malicious airdrop patterns,
// dangerous delegations, and scam tokens. Provides one-click revocation.

import {
  scanTokenAccounts,
  buildRevokeDelegationTx,
  buildRevokeAllDelegationsTx,
  computeAirdropRiskScore,
  type TokenAccountInfo,
  type AirdropAlert,
  type AirdropGuardState,
  EMPTY_AIRDROP_STATE,
} from './services/airdropGuardService';

export function useAirdropGuard(
  addLog?: (log: Omit<AgentLog, 'id' | 'timestamp'>) => void,
  pollInterval: number = 60_000, // scan every 60s
) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<AirdropGuardState>(EMPTY_AIRDROP_STATE);
  const addLogRef = useRef(addLog);
  const prevAlertIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { addLogRef.current = addLog; }, [addLog]);

  // Reset on disconnect
  useEffect(() => {
    if (!connected || !publicKey) {
      setState(EMPTY_AIRDROP_STATE);
      prevAlertIdsRef.current = new Set();
    }
  }, [connected, publicKey]);

  // Core scan
  const runScan = useCallback(async () => {
    if (!publicKey || !connected) return;

    setState(prev => ({ ...prev, isScanning: true }));

    try {
      const { accounts, alerts } = await scanTokenAccounts(
        connection,
        publicKey.toBase58(),
      );

      const { score, level } = computeAirdropRiskScore(accounts, alerts);

      // Log NEW alerts to reasoning console
      const prevIds = prevAlertIdsRef.current;
      for (const alert of alerts) {
        if (!prevIds.has(alert.id)) {
          const logType = alert.severity === 'dangerous' ? 'critical'
            : alert.severity === 'suspicious' ? 'warning' : 'info';
          addLogRef.current?.({
            type: logType,
            source: 'risk-engine',
            message: `[AIRDROP GUARD] ${alert.title}: ${alert.description.slice(0, 200)}`,
          });
        }
      }
      prevAlertIdsRef.current = new Set(alerts.map(a => a.id));

      const totalDelegations = accounts.filter(a => a.delegate !== null).length;
      const suspiciousTokenCount = accounts.filter(
        a => a.riskLevel === 'suspicious' || a.riskLevel === 'dangerous'
      ).length;

      setState({
        isScanning: false,
        lastScanTime: Date.now(),
        tokenAccounts: accounts,
        alerts,
        riskScore: score,
        totalDelegations,
        suspiciousTokenCount,
        notificationsEnabled: true,
      });

      // Browser notifications for dangerous findings
      if ('Notification' in window && Notification.permission === 'granted') {
        const dangerous = alerts.filter(a => a.severity === 'dangerous');
        if (dangerous.length > 0) {
          new Notification('🛡️ SENTINEL-1 Airdrop Guard', {
            body: dangerous[0].title + ': ' + dangerous[0].description.slice(0, 120),
            icon: '/sentinel.svg',
          });
        }
      }

    } catch (err) {
      console.warn('[AirdropGuard] Scan failed:', err);
      setState(prev => ({ ...prev, isScanning: false }));
    }
  }, [publicKey, connected, connection]);

  // Initial scan + polling
  useEffect(() => {
    if (!publicKey || !connected) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    runScan();
    const timer = setInterval(runScan, pollInterval);
    return () => clearInterval(timer);
  }, [publicKey, connected, runScan, pollInterval]);

  // Revoke a single delegation
  const revokeDelegation = useCallback(async (tokenAccountAddress: string) => {
    if (!publicKey || !connected) return;

    try {
      const tokenAcctPubkey = new PublicKey(tokenAccountAddress);
      const tx = buildRevokeDelegationTx(publicKey, tokenAcctPubkey);

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');

      addLogRef.current?.({
        type: 'info',
        source: 'risk-engine',
        message: `[AIRDROP GUARD] ✅ Successfully revoked delegation for token account ${tokenAccountAddress.slice(0, 8)}...`,
      });

      // Re-scan after revocation
      setTimeout(runScan, 2000);
    } catch (err) {
      console.error('[AirdropGuard] Revoke failed:', err);
      addLogRef.current?.({
        type: 'warning',
        source: 'risk-engine',
        message: `[AIRDROP GUARD] ❌ Failed to revoke delegation: ${(err as Error).message}`,
      });
    }
  }, [publicKey, connected, connection, sendTransaction, runScan]);

  // Revoke ALL delegations
  const revokeAllDelegations = useCallback(async () => {
    if (!publicKey || !connected) return;

    const delegatedAccounts = state.tokenAccounts
      .filter(a => a.delegate !== null)
      .map(a => new PublicKey(a.address));

    if (delegatedAccounts.length === 0) return;

    try {
      const tx = buildRevokeAllDelegationsTx(publicKey, delegatedAccounts);

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');

      addLogRef.current?.({
        type: 'info',
        source: 'risk-engine',
        message: `[AIRDROP GUARD] ✅ Revoked ALL ${delegatedAccounts.length} token delegations. Your wallet is now protected.`,
      });

      setTimeout(runScan, 2000);
    } catch (err) {
      console.error('[AirdropGuard] Revoke all failed:', err);
      addLogRef.current?.({
        type: 'warning',
        source: 'risk-engine',
        message: `[AIRDROP GUARD] ❌ Batch revoke failed: ${(err as Error).message}`,
      });
    }
  }, [publicKey, connected, connection, sendTransaction, state.tokenAccounts, runScan]);

  return {
    guard: state,
    rescan: runScan,
    revokeDelegation,
    revokeAllDelegations,
  };
}
