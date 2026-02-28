// ── Mock Pyth Data Service ──
// Simulates Pyth Pro real-time feeds with realistic market behavior

import type { PriceFeed, AgentLog, RiskMetrics, Position, AgentState, EntropySimulation } from '../types';

// Pyth Price Feed IDs (real mainnet IDs)
const PYTH_FEED_IDS = {
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'PYTH/USD': '0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff',
};

function generateSparkline(base: number, volatility: number, points = 24): number[] {
  const data: number[] = [];
  let current = base * (1 - volatility * 0.5);
  for (let i = 0; i < points; i++) {
    current += (Math.random() - 0.48) * base * volatility * 0.1;
    current = Math.max(current, base * 0.9);
    data.push(current);
  }
  data[data.length - 1] = base;
  return data;
}

export function getInitialPriceFeeds(): PriceFeed[] {
  return [
    {
      id: PYTH_FEED_IDS['BTC/USD'],
      symbol: 'BTC/USD',
      name: 'Bitcoin',
      category: 'crypto',
      price: 97842.50,
      previousPrice: 97842.50,
      change24h: 1245.30,
      changePercent24h: 1.29,
      confidence: 12.50,
      publishTime: Date.now(),
      emaPrice: 97500.00,
      high24h: 98500.00,
      low24h: 96100.00,
      volume24h: 42_500_000_000,
      sparkline: generateSparkline(97842.50, 0.02),
    },
    {
      id: PYTH_FEED_IDS['ETH/USD'],
      symbol: 'ETH/USD',
      name: 'Ethereum',
      category: 'crypto',
      price: 3456.78,
      previousPrice: 3456.78,
      change24h: -45.22,
      changePercent24h: -1.29,
      confidence: 1.25,
      publishTime: Date.now(),
      emaPrice: 3470.00,
      high24h: 3520.00,
      low24h: 3405.00,
      volume24h: 18_200_000_000,
      sparkline: generateSparkline(3456.78, 0.025),
    },
    {
      id: PYTH_FEED_IDS['SOL/USD'],
      symbol: 'SOL/USD',
      name: 'Solana',
      category: 'crypto',
      price: 178.45,
      previousPrice: 178.45,
      change24h: 5.67,
      changePercent24h: 3.28,
      confidence: 0.08,
      publishTime: Date.now(),
      emaPrice: 176.80,
      high24h: 182.30,
      low24h: 171.50,
      volume24h: 4_800_000_000,
      sparkline: generateSparkline(178.45, 0.035),
    },
    {
      id: PYTH_FEED_IDS['PYTH/USD'],
      symbol: 'PYTH/USD',
      name: 'Pyth Network',
      category: 'crypto',
      price: 0.3842,
      previousPrice: 0.3842,
      change24h: 0.0123,
      changePercent24h: 3.31,
      confidence: 0.0003,
      publishTime: Date.now(),
      emaPrice: 0.3800,
      high24h: 0.3950,
      low24h: 0.3680,
      volume24h: 125_000_000,
      sparkline: generateSparkline(0.3842, 0.04),
    },
    {
      id: 'equity-aapl',
      symbol: 'AAPL/USD',
      name: 'Apple Inc.',
      category: 'equity',
      price: 245.82,
      previousPrice: 245.82,
      change24h: 2.14,
      changePercent24h: 0.88,
      confidence: 0.15,
      publishTime: Date.now(),
      emaPrice: 244.50,
      high24h: 247.10,
      low24h: 243.20,
      volume24h: 52_000_000,
      sparkline: generateSparkline(245.82, 0.012),
    },
    {
      id: 'futures-sp500',
      symbol: 'SPX/USD',
      name: 'S&P 500',
      category: 'futures',
      price: 5892.40,
      previousPrice: 5892.40,
      change24h: 18.60,
      changePercent24h: 0.32,
      confidence: 2.10,
      publishTime: Date.now(),
      emaPrice: 5880.00,
      high24h: 5910.00,
      low24h: 5865.00,
      volume24h: 0,
      sparkline: generateSparkline(5892.40, 0.008),
    },
    {
      id: 'rates-fedfunds',
      symbol: 'FFER/USD',
      name: 'Fed Funds Rate',
      category: 'rates',
      price: 4.3300,
      previousPrice: 4.3300,
      change24h: 0.0000,
      changePercent24h: 0.00,
      confidence: 0.0010,
      publishTime: Date.now(),
      emaPrice: 4.3300,
      high24h: 4.3300,
      low24h: 4.3300,
      volume24h: 0,
      sparkline: generateSparkline(4.33, 0.001),
    },
    {
      id: 'rates-us10y',
      symbol: 'US10Y/USD',
      name: 'US 10Y Treasury',
      category: 'rates',
      price: 4.2850,
      previousPrice: 4.2850,
      change24h: -0.0120,
      changePercent24h: -0.28,
      confidence: 0.0015,
      publishTime: Date.now(),
      emaPrice: 4.2900,
      high24h: 4.3000,
      low24h: 4.2700,
      volume24h: 0,
      sparkline: generateSparkline(4.285, 0.005),
    },
  ];
}

export function simulatePriceUpdate(feed: PriceFeed): PriceFeed {
  const volatility = feed.category === 'crypto' ? 0.003 : feed.category === 'rates' ? 0.0002 : 0.001;
  const delta = (Math.random() - 0.48) * feed.price * volatility;
  const newPrice = Math.max(feed.price + delta, feed.price * 0.95);
  const newSparkline = [...feed.sparkline.slice(1), newPrice];

  return {
    ...feed,
    previousPrice: feed.price,
    price: Number(newPrice.toPrecision(feed.price > 100 ? 7 : feed.price > 1 ? 6 : 4)),
    publishTime: Date.now(),
    confidence: feed.confidence * (0.95 + Math.random() * 0.1),
    sparkline: newSparkline,
    change24h: newPrice - feed.sparkline[0],
    changePercent24h: ((newPrice - feed.sparkline[0]) / feed.sparkline[0]) * 100,
  };
}

// ── Agent Reasoning Messages ──

const AGENT_MESSAGES: Omit<AgentLog, 'id' | 'timestamp'>[] = [
  { type: 'info', source: 'pyth-pro', message: 'Pyth Pro feed latency: 0.8ms. All 8 feeds nominal.' },
  { type: 'analysis', source: 'agent', message: 'Analyzing BTC/ETH correlation matrix... Pearson coefficient: 0.87. Normal range.' },
  { type: 'info', source: 'pyth-pro', message: 'SOL/USD volatility spike detected: +2.4% in 500ms window. Monitoring...' },
  { type: 'warning', source: 'risk-engine', message: 'Cross-asset correlation rising. BTC-SPX 30d correlation: 0.62 → 0.71. Risk-off signal emerging.' },
  { type: 'success', source: 'agent', message: 'Portfolio rebalance simulation complete. Optimal hedge ratio: 0.42 (ETH short vs SOL long).' },
  { type: 'analysis', source: 'agent', message: 'Running Monte Carlo simulation (10,000 paths) using Pyth Entropy seed...' },
  { type: 'info', source: 'executor', message: 'Entropy-randomized exit strategy prepared. Execution window: 30s, 5 tranches.' },
  { type: 'critical', source: 'risk-engine', message: 'ALERT: SOL health factor approaching 1.15. Pre-emptive hedge threshold: 1.20.' },
  { type: 'success', source: 'entropy', message: 'Entropy RNG generated successfully. Seed: 0xa7f3...c821. Applying to exit timing.' },
  { type: 'analysis', source: 'agent', message: 'Pyth Pro micro-structure analysis: BTC bid-ask spread tightening. Institutional accumulation likely.' },
  { type: 'info', source: 'pyth-pro', message: 'Price feed confidence interval narrowing: BTC ±$8.50, ETH ±$0.95. High certainty.' },
  { type: 'warning', source: 'risk-engine', message: 'Volatility regime shift detected: transitioning from low-vol to mid-vol environment.' },
  { type: 'success', source: 'agent', message: 'Arbitrage opportunity identified: SOL/ETH ratio deviation of 0.3σ from mean. Expected reversion: 4-6h.' },
  { type: 'action', source: 'executor', message: 'Initiating Shadow Exit protocol: randomizing 5 exit tranches over 30s window to avoid MEV.' },
  { type: 'info', source: 'pyth-pro', message: 'US10Y yield shift: -1.2bps. Monitoring macro correlation impact on crypto positions.' },
  { type: 'analysis', source: 'agent', message: 'AAPL earnings proximity detected. Adjusting equity-crypto correlation assumptions.' },
  { type: 'success', source: 'entropy', message: 'Stress test complete. 95th percentile VaR: -8.2%. Portfolio resilient to 3σ shock.' },
  { type: 'info', source: 'agent', message: 'Natural language query processed: "Simulate hedged ETH position if rates rise." Generating scenario...' },
  { type: 'warning', source: 'risk-engine', message: 'Fed Funds rate unchanged but forward curve steepening. Adjusting rate sensitivity model.' },
  { type: 'analysis', source: 'agent', message: 'Cross-asset momentum score: BTC (+0.7), SOL (+0.9), ETH (-0.2), SPX (+0.4). SOL leading momentum.' },
];

let messageIndex = 0;

export function getNextAgentMessage(): AgentLog {
  const msg = AGENT_MESSAGES[messageIndex % AGENT_MESSAGES.length];
  messageIndex++;
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    ...msg,
  };
}

// ── Risk Metrics ──

export function generateRiskMetrics(): RiskMetrics {
  return {
    overallScore: 35 + Math.random() * 30, // 35-65 range (moderate)
    volatilityIndex: 20 + Math.random() * 40,
    correlationRisk: 30 + Math.random() * 35,
    liquidationProximity: 10 + Math.random() * 25,
    entropyHealth: 80 + Math.random() * 18,
    trend: Math.random() > 0.6 ? 'improving' : Math.random() > 0.3 ? 'stable' : 'deteriorating',
  };
}

export function updateRiskMetrics(current: RiskMetrics): RiskMetrics {
  const drift = (val: number, range: number) => Math.max(0, Math.min(100, val + (Math.random() - 0.5) * range));
  return {
    overallScore: drift(current.overallScore, 4),
    volatilityIndex: drift(current.volatilityIndex, 6),
    correlationRisk: drift(current.correlationRisk, 5),
    liquidationProximity: drift(current.liquidationProximity, 3),
    entropyHealth: drift(current.entropyHealth, 2),
    trend: current.overallScore > 55 ? 'deteriorating' : current.overallScore < 35 ? 'improving' : 'stable',
  };
}

// ── Positions ──

export function getInitialPositions(): Position[] {
  return [
    {
      id: 'pos-1',
      asset: 'SOL/USD',
      side: 'long',
      size: 450,
      entryPrice: 172.30,
      currentPrice: 178.45,
      pnl: 2767.50,
      pnlPercent: 3.57,
      healthFactor: 2.84,
      leverage: 3,
    },
    {
      id: 'pos-2',
      asset: 'ETH/USD',
      side: 'long',
      size: 12.5,
      entryPrice: 3380.00,
      currentPrice: 3456.78,
      pnl: 959.75,
      pnlPercent: 2.27,
      healthFactor: 4.12,
      leverage: 2,
    },
    {
      id: 'pos-3',
      asset: 'BTC/USD',
      side: 'short',
      size: 0.35,
      entryPrice: 99100.00,
      currentPrice: 97842.50,
      pnl: 440.13,
      pnlPercent: 1.27,
      healthFactor: 5.60,
      leverage: 2,
    },
  ];
}

// ── Agent State ──

export function getInitialAgentState(): AgentState {
  return {
    status: 'monitoring',
    uptime: 47 * 3600 + 23 * 60 + 15,
    decisionsToday: 142,
    accuracy: 94.7,
    lastAction: 'Portfolio rebalance — reduced ETH exposure by 2.5%',
    lastActionTime: Date.now() - 180_000,
  };
}

// ── Entropy Simulations ──

export function getEntropySimulations(): EntropySimulation[] {
  return [
    {
      id: 'sim-1',
      scenario: 'Flash crash: BTC -15% in 5min',
      probability: 0.023,
      impact: -12400,
      recommendedAction: 'Pre-position 20% emergency USDC shelter',
      status: 'complete',
    },
    {
      id: 'sim-2',
      scenario: 'Correlated selloff: All crypto -8%',
      probability: 0.067,
      impact: -8200,
      recommendedAction: 'Activate entropy-randomized exit for SOL position',
      status: 'complete',
    },
    {
      id: 'sim-3',
      scenario: 'Rate hike surprise: +50bps',
      probability: 0.12,
      impact: -3100,
      recommendedAction: 'Hedge crypto with SPX put equivalent',
      status: 'running',
    },
    {
      id: 'sim-4',
      scenario: 'SOL ecosystem catalyst: +20%',
      probability: 0.15,
      impact: 14400,
      recommendedAction: 'Maintain long SOL, add on pullback',
      status: 'pending',
    },
  ];
}
