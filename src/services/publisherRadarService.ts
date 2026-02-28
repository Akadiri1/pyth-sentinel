// ── Publisher Radar Service ──
// Simulates publisher-level breakdown from real Pyth aggregate feed data.
// Pyth aggregates 120+ first-party institutional publishers. This service
// models individual publisher behavior (deviations, latency, uptime, stakes)
// from the live confidence interval and publish_time data.

import type { PriceFeed, Publisher, PublisherFeedMetrics, ConfidenceAlert } from '../types';

// ── Real Pyth Network Publishers ──
// These are actual institutional publishers on the Pyth Network
export const PUBLISHERS: Publisher[] = [
  { id: 'pub-01', name: 'Jane Street',       shortName: 'JS',   tier: 'institutional',  stake: 45_200_000, stakeCap: 50_000_000, stakeUtilization: 0.904 },
  { id: 'pub-02', name: 'Binance',           shortName: 'BN',   tier: 'exchange',        stake: 38_700_000, stakeCap: 45_000_000, stakeUtilization: 0.860 },
  { id: 'pub-03', name: 'Jump Trading',      shortName: 'JT',   tier: 'institutional',  stake: 32_100_000, stakeCap: 40_000_000, stakeUtilization: 0.803 },
  { id: 'pub-04', name: 'Wintermute',        shortName: 'WM',   tier: 'market-maker',   stake: 28_500_000, stakeCap: 35_000_000, stakeUtilization: 0.814 },
  { id: 'pub-05', name: 'Cumberland',        shortName: 'CB',   tier: 'market-maker',   stake: 22_800_000, stakeCap: 30_000_000, stakeUtilization: 0.760 },
  { id: 'pub-06', name: 'Galaxy Digital',    shortName: 'GD',   tier: 'institutional',  stake: 19_400_000, stakeCap: 25_000_000, stakeUtilization: 0.776 },
  { id: 'pub-07', name: 'OKX',              shortName: 'OK',   tier: 'exchange',        stake: 17_600_000, stakeCap: 22_000_000, stakeUtilization: 0.800 },
  { id: 'pub-08', name: 'Virtu Financial',   shortName: 'VF',   tier: 'institutional',  stake: 15_200_000, stakeCap: 20_000_000, stakeUtilization: 0.760 },
  { id: 'pub-09', name: 'DRW / Cumberland',  shortName: 'DRW',  tier: 'market-maker',   stake: 12_800_000, stakeCap: 18_000_000, stakeUtilization: 0.711 },
  { id: 'pub-10', name: 'Alameda Research',  shortName: 'AR',   tier: 'market-maker',   stake: 8_200_000,  stakeCap: 15_000_000, stakeUtilization: 0.547 },
  { id: 'pub-11', name: 'Raydium',           shortName: 'RAY',  tier: 'defi',           stake: 6_500_000,  stakeCap: 12_000_000, stakeUtilization: 0.542 },
  { id: 'pub-12', name: 'CoinShares',        shortName: 'CS',   tier: 'institutional',  stake: 5_900_000,  stakeCap: 10_000_000, stakeUtilization: 0.590 },
];

// ── Per-publisher state (accumulated across ticks) ──
const publisherPriceHistories: Map<string, Map<string, number[]>> = new Map(); // publisherId → feedSymbol → prices
const publisherUptimes: Map<string, number> = new Map();
const publisherLatencies: Map<string, number> = new Map();
const MAX_HISTORY = 20;

// Seeded deterministic randomness per publisher for consistency
function seededRandom(seed: string, tick: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash + tick) * 10000;
  return x - Math.floor(x);
}

// ── Generate publisher metrics from a real feed ──
export function generatePublisherMetrics(
  feed: PriceFeed,
  tick: number,
): PublisherFeedMetrics[] {
  const metrics: PublisherFeedMetrics[] = [];
  const conf = feed.confidence;
  const price = feed.price;

  for (const pub of PUBLISHERS) {
    const r = seededRandom(pub.id + feed.symbol, tick);
    const r2 = seededRandom(pub.id + feed.symbol + 'lat', tick);
    const r3 = seededRandom(pub.id + feed.symbol + 'up', tick);

    // Publisher-specific deviation from aggregate
    // Most publishers stay within 1-2σ, occasionally one goes wider
    let deviationMultiplier: number;
    if (pub.tier === 'institutional') {
      deviationMultiplier = (r - 0.5) * 1.2; // tight, ±0.6σ
    } else if (pub.tier === 'exchange') {
      deviationMultiplier = (r - 0.5) * 2.0; // moderate, ±1.0σ
    } else if (pub.tier === 'market-maker') {
      deviationMultiplier = (r - 0.5) * 3.0; // wider, ±1.5σ
    } else {
      deviationMultiplier = (r - 0.5) * 5.0; // DeFi, ±2.5σ
    }

    // Inject occasional suspicious deviation (>20σ) for one publisher
    const isSuspicious = pub.id === 'pub-10' && r > 0.92;
    if (isSuspicious) {
      deviationMultiplier = 22 + r * 8; // 22-30σ deviation
    }

    const deviation = Math.abs(deviationMultiplier);
    const deviationAbsolute = deviationMultiplier * conf;
    const reportedPrice = price + deviationAbsolute;

    // Latency: institutional is fastest, DeFi is slowest
    let baseLatency: number;
    if (pub.tier === 'institutional') baseLatency = 8 + r2 * 15;
    else if (pub.tier === 'exchange') baseLatency = 12 + r2 * 25;
    else if (pub.tier === 'market-maker') baseLatency = 18 + r2 * 35;
    else baseLatency = 50 + r2 * 80;

    // Uptime: high-tier publishers have 99.5%+
    let uptime: number;
    if (pub.tier === 'institutional') uptime = 99.5 + r3 * 0.5;
    else if (pub.tier === 'exchange') uptime = 98.5 + r3 * 1.2;
    else if (pub.tier === 'market-maker') uptime = 97.0 + r3 * 2.5;
    else uptime = 93.0 + r3 * 5.0;

    // Track price history
    const histKey = `${pub.id}-${feed.symbol}`;
    if (!publisherPriceHistories.has(pub.id)) {
      publisherPriceHistories.set(pub.id, new Map());
    }
    const pubHistories = publisherPriceHistories.get(pub.id)!;
    if (!pubHistories.has(feed.symbol)) {
      pubHistories.set(feed.symbol, []);
    }
    const priceHist = pubHistories.get(feed.symbol)!;
    priceHist.push(reportedPrice);
    if (priceHist.length > MAX_HISTORY) priceHist.splice(0, priceHist.length - MAX_HISTORY);

    // Store latency/uptime
    publisherLatencies.set(histKey, baseLatency);
    publisherUptimes.set(histKey, uptime);

    // Determine status
    let status: PublisherFeedMetrics['status'];
    if (isSuspicious || deviation > 20) {
      status = 'suspicious';
    } else if (deviation > 5) {
      status = 'deviating';
    } else if (baseLatency > 80) {
      status = 'lagging';
    } else if (uptime < 95) {
      status = 'offline';
    } else {
      status = 'healthy';
    }

    metrics.push({
      publisherId: pub.id,
      feedSymbol: feed.symbol,
      reportedPrice,
      deviation,
      deviationAbsolute: Math.abs(deviationAbsolute),
      latency: Math.round(baseLatency),
      uptime: parseFloat(uptime.toFixed(2)),
      lastReportTime: feed.publishTime - Math.round(baseLatency),
      status,
      priceHistory: [...priceHist],
    });
  }

  return metrics;
}

// ── Confidence Interval History Tracking ──
const confidenceHistories: Map<string, number[]> = new Map();
const prevConfidences: Map<string, number> = new Map();
const CONF_HISTORY_LENGTH = 30;

export function trackConfidence(feed: PriceFeed): ConfidenceAlert | null {
  const symbol = feed.symbol;
  const conf = feed.confidence;

  // Store history
  if (!confidenceHistories.has(symbol)) {
    confidenceHistories.set(symbol, []);
  }
  const history = confidenceHistories.get(symbol)!;
  history.push(conf);
  if (history.length > CONF_HISTORY_LENGTH) {
    history.splice(0, history.length - CONF_HISTORY_LENGTH);
  }

  // Check for significant change
  const prevConf = prevConfidences.get(symbol);
  prevConfidences.set(symbol, conf);

  if (prevConf === undefined || prevConf === 0) return null;

  const changePercent = ((conf - prevConf) / prevConf) * 100;

  // Only alert on significant widening (>30% increase in confidence interval)
  if (changePercent > 30) {
    const severity: ConfidenceAlert['severity'] = changePercent > 100 ? 'critical' : changePercent > 60 ? 'warning' : 'info';
    return {
      id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      feedSymbol: symbol,
      timestamp: Date.now(),
      previousConf: prevConf,
      currentConf: conf,
      changePercent,
      severity,
      message: severity === 'critical'
        ? `CRITICAL: ${symbol} confidence interval exploded ${changePercent.toFixed(0)}% (±$${prevConf.toFixed(4)} → ±$${conf.toFixed(4)}). Extreme volatility or publisher disagreement imminent.`
        : severity === 'warning'
        ? `WARNING: ${symbol} confidence widening ${changePercent.toFixed(0)}%. Oracle consensus weakening — price uncertainty rising.`
        : `${symbol} confidence interval widened ${changePercent.toFixed(0)}%. Monitoring for sustained expansion.`,
    };
  }

  return null;
}

export function getConfidenceHistory(symbol: string): number[] {
  return confidenceHistories.get(symbol) || [];
}

// ── Publisher Deviation Auto-Ignore Threshold ──
// Any publisher whose deviation exceeds this σ threshold is pre-emptively
// excluded from the Guardian Shield's filtered price computation,
// BEFORE the protocol even flags it as suspicious.
export const PUBLISHER_SIGMA_THRESHOLD = 3.0;

// ── Compute a stake-weighted median price after filtering out deviating publishers ──
// Used by Guardian Shield for clean re-entry pricing during liquidation defense.
export interface FilteredPriceResult {
  filteredPrice: number;         // stake-weighted mean of clean publishers
  rawPrice: number;              // original aggregate
  excludedPublishers: { name: string; shortName: string; deviation: number; reportedPrice: number }[];
  includedCount: number;
  totalCount: number;
  priceImpact: number;           // $ difference between raw and filtered
  priceImpactPercent: number;    // % difference
}

export function computeFilteredPrice(
  feed: PriceFeed,
  tick: number,
  sigmaThreshold: number = PUBLISHER_SIGMA_THRESHOLD,
): FilteredPriceResult {
  const metrics = generatePublisherMetrics(feed, tick);
  const rawPrice = feed.price;

  const excluded: FilteredPriceResult['excludedPublishers'] = [];
  const included: { reportedPrice: number; stake: number }[] = [];

  for (const m of metrics) {
    const pub = PUBLISHERS.find(p => p.id === m.publisherId);
    if (!pub) continue;

    if (m.deviation > sigmaThreshold) {
      excluded.push({
        name: pub.name,
        shortName: pub.shortName,
        deviation: m.deviation,
        reportedPrice: m.reportedPrice,
      });
    } else {
      included.push({ reportedPrice: m.reportedPrice, stake: pub.stake });
    }
  }

  // Stake-weighted mean of included publishers
  let filteredPrice = rawPrice;
  if (included.length > 0) {
    const totalStake = included.reduce((s, p) => s + p.stake, 0);
    filteredPrice = included.reduce((s, p) => s + p.reportedPrice * (p.stake / totalStake), 0);
  }

  const priceImpact = Math.abs(filteredPrice - rawPrice);
  const priceImpactPercent = rawPrice !== 0 ? (priceImpact / rawPrice) * 100 : 0;

  return {
    filteredPrice,
    rawPrice,
    excludedPublishers: excluded,
    includedCount: included.length,
    totalCount: metrics.length,
    priceImpact,
    priceImpactPercent,
  };
}

// ── Find fastest publisher in current session ──
export function findFastestPublisher(allMetrics: PublisherFeedMetrics[]): { name: string; avgLatency: number } {
  const latencyByPublisher: Map<string, number[]> = new Map();

  for (const m of allMetrics) {
    if (!latencyByPublisher.has(m.publisherId)) {
      latencyByPublisher.set(m.publisherId, []);
    }
    latencyByPublisher.get(m.publisherId)!.push(m.latency);
  }

  let bestId = '';
  let bestAvg = Infinity;

  for (const [pubId, latencies] of latencyByPublisher) {
    const avg = latencies.reduce((s, l) => s + l, 0) / latencies.length;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestId = pubId;
    }
  }

  const pub = PUBLISHERS.find(p => p.id === bestId);
  return { name: pub?.name ?? 'Unknown', avgLatency: Math.round(bestAvg) };
}
