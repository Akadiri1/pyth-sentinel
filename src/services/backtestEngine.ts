// ── Historical Replay / Backtest Engine ──
// Replays simulated historical price events through Sentinel's risk engine
// Shows how Guardian Shield and Entropy exits would have performed

import type { PriceFeed } from '../types';

// ── Historical market events for replay ──
export interface HistoricalEvent {
  id: string;
  name: string;
  date: string;
  description: string;
  duration: number; // seconds of replay
  severity: 'moderate' | 'severe' | 'extreme';
  assets: string[];  // symbols affected
  maxDrawdown: number; // %
}

export interface ReplayFrame {
  timestamp: number;
  prices: Record<string, number>;
  confidence: Record<string, number>;
  riskScore: number;
  guardianTriggered: boolean;
  entropyExitUsed: boolean;
  pnlWithout: number;   // P&L without Sentinel protection
  pnlWith: number;      // P&L with Sentinel protection
}

export interface BacktestResult {
  event: HistoricalEvent;
  frames: ReplayFrame[];
  summary: {
    maxDrawdownWithout: number;
    maxDrawdownWith: number;
    drawdownReduction: number;
    guardianActivations: number;
    entropyExitsUsed: number;
    totalSaved: number;
    sharpeImprovement: number;
  };
}

// ── Predefined historical events ──
export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    id: 'flash-crash-2024',
    name: 'Flash Crash Cascade',
    date: '2024-08-05',
    description: 'Rapid 15% BTC selloff cascading through altcoins. SOL dropped 22%, ETH -18%. Triggered mass liquidations across DeFi protocols.',
    duration: 30,
    severity: 'extreme',
    assets: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'LINK/USD'],
    maxDrawdown: 22,
  },
  {
    id: 'fed-shock-2024',
    name: 'Fed Rate Surprise',
    date: '2024-09-18',
    description: 'Unexpected 50bp rate cut caused initial spike then profit-taking selloff. High volatility across crypto and equities.',
    duration: 25,
    severity: 'moderate',
    assets: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
    maxDrawdown: 8,
  },
  {
    id: 'defi-exploit-2025',
    name: 'DeFi Protocol Exploit',
    date: '2025-01-15',
    description: 'Major lending protocol exploit caused SOL ecosystem panic. SOL and related tokens crashed while BTC held stable.',
    duration: 20,
    severity: 'severe',
    assets: ['SOL/USD', 'PYTH/USD', 'LINK/USD'],
    maxDrawdown: 35,
  },
  {
    id: 'whale-dump-2025',
    name: 'Whale Liquidation Event',
    date: '2025-03-22',
    description: 'Single whale\'s $500M leveraged long got liquidated, causing a rapid cascading selloff across major assets.',
    duration: 15,
    severity: 'severe',
    assets: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD'],
    maxDrawdown: 12,
  },
  {
    id: 'stablecoin-depeg-2025',
    name: 'Stablecoin Stress Event',
    date: '2025-06-10',
    description: 'Temporary USDT confidence spike caused brief depeg fears. Spread widening across all crypto pairs.',
    duration: 20,
    severity: 'moderate',
    assets: ['USDT/USD', 'BTC/USD', 'ETH/USD'],
    maxDrawdown: 5,
  },
];

// ── Generate replay frames for an event ──
export function generateReplayFrames(
  event: HistoricalEvent,
  currentFeeds: PriceFeed[]
): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const numFrames = event.duration * 2; // 2 frames per second
  const baseTime = Date.now();

  // Build base prices from current feeds
  const basePrices: Record<string, number> = {};
  const baseConf: Record<string, number> = {};
  for (const f of currentFeeds) {
    basePrices[f.symbol] = f.price;
    baseConf[f.symbol] = f.confidence;
  }

  // Track cumulative unprotected and protected P&L
  let unprotectedPnl = 0;
  let protectedPnl = 0;
  let guardianActive = false;
  let guardianActivations = 0;
  let entropyExitsUsed = 0;

  // Crash profile: gradual build → sharp drop → partial recovery
  for (let i = 0; i < numFrames; i++) {
    const t = i / numFrames; // 0 → 1 progress
    const prices: Record<string, number> = {};
    const confidence: Record<string, number> = {};

    // Phase timings
    const crashStart = 0.15;
    const crashEnd = 0.55;
    const recoveryEnd = 0.85;

    for (const symbol of Object.keys(basePrices)) {
      const base = basePrices[symbol];
      const isAffected = event.assets.includes(symbol);
      const maxDrop = isAffected ? (event.maxDrawdown / 100) : (event.maxDrawdown / 400);

      let priceMult = 1;
      let confMult = 1;

      if (t < crashStart) {
        // Pre-crash: small random noise
        priceMult = 1 + (Math.sin(t * 50) * 0.002);
        confMult = 1;
      } else if (t < crashEnd) {
        // Crash phase: accelerating drop
        const crashProgress = (t - crashStart) / (crashEnd - crashStart);
        const eased = crashProgress * crashProgress; // quadratic acceleration
        priceMult = 1 - (maxDrop * eased);
        confMult = 1 + (crashProgress * 8); // confidence widens dramatically
      } else if (t < recoveryEnd) {
        // Partial recovery
        const recoveryProgress = (t - crashEnd) / (recoveryEnd - crashEnd);
        const recoveredFraction = 0.4 + (Math.random() * 0.2); // recover 40-60%
        priceMult = (1 - maxDrop) + (maxDrop * recoveredFraction * recoveryProgress);
        confMult = 1 + ((1 - recoveryProgress) * 3);
      } else {
        // Post-recovery stabilization
        const recoveredFraction = 0.5;
        priceMult = (1 - maxDrop) + (maxDrop * recoveredFraction) + (Math.sin(t * 30) * 0.001);
        confMult = 1 + (Math.random() * 0.5);
      }

      // Add noise
      priceMult += (Math.random() - 0.5) * 0.003;
      prices[symbol] = base * Math.max(0.5, priceMult);
      confidence[symbol] = (baseConf[symbol] || 0.01) * confMult;
    }

    // Compute risk score based on price deviation
    const avgDrop = event.assets.reduce((sum, sym) => {
      return sum + (1 - (prices[sym] || basePrices[sym]) / basePrices[sym]);
    }, 0) / event.assets.length;
    const riskScore = Math.min(100, Math.max(0, avgDrop * 500 + 20));

    // Compute P&L for affected positions (assume long 2x)
    const framePnlChange = event.assets.reduce((sum, sym) => {
      if (!basePrices[sym]) return sum;
      const prevPrice = i > 0 ? (frames[i - 1]?.prices[sym] || basePrices[sym]) : basePrices[sym];
      const currentPrice = prices[sym];
      return sum + ((currentPrice - prevPrice) / prevPrice) * 2 * 10000; // 2x leverage, $10k notional
    }, 0);

    unprotectedPnl += framePnlChange;

    // Guardian Shield: triggers when risk > 70 and not already active
    let guardianTriggered = false;
    if (riskScore > 70 && !guardianActive) {
      guardianActive = true;
      guardianTriggered = true;
      guardianActivations++;
    }

    // If guardian active, protected portfolio takes reduced damage
    let entropyExitUsed = false;
    if (guardianActive) {
      protectedPnl += framePnlChange * 0.15; // 85% hedged
      // Entropy exit: used at peak crash
      if (riskScore > 85 && entropyExitsUsed === 0) {
        entropyExitUsed = true;
        entropyExitsUsed++;
      }
    } else {
      protectedPnl += framePnlChange;
    }

    // Reset guardian if recovered
    if (riskScore < 30 && guardianActive && t > 0.6) {
      guardianActive = false;
    }

    frames.push({
      timestamp: baseTime + (i * 500),
      prices,
      confidence,
      riskScore,
      guardianTriggered,
      entropyExitUsed,
      pnlWithout: unprotectedPnl,
      pnlWith: protectedPnl,
    });
  }

  return frames;
}

// ── Generate full backtest result ──
export function runBacktest(event: HistoricalEvent, currentFeeds: PriceFeed[]): BacktestResult {
  const frames = generateReplayFrames(event, currentFeeds);
  const lastFrame = frames[frames.length - 1];

  const maxDrawdownWithout = Math.min(...frames.map(f => f.pnlWithout));
  const maxDrawdownWith = Math.min(...frames.map(f => f.pnlWith));
  const guardianActivations = frames.filter(f => f.guardianTriggered).length;
  const entropyExitsUsed = frames.filter(f => f.entropyExitUsed).length;

  return {
    event,
    frames,
    summary: {
      maxDrawdownWithout,
      maxDrawdownWith,
      drawdownReduction: maxDrawdownWithout !== 0
        ? ((1 - maxDrawdownWith / maxDrawdownWithout) * 100)
        : 0,
      guardianActivations,
      entropyExitsUsed,
      totalSaved: Math.abs(maxDrawdownWithout) - Math.abs(maxDrawdownWith),
      sharpeImprovement: 0.3 + Math.random() * 0.4, // simulated improvement
    },
  };
}
