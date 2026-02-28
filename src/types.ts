// ── Sentinel-1 Type Definitions ──

export interface PriceFeed {
  id: string;
  symbol: string;
  name: string;
  category: 'crypto' | 'equity' | 'futures' | 'rates';
  price: number;
  previousPrice: number;
  change24h: number;
  changePercent24h: number;
  confidence: number;
  publishTime: number;
  emaPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  sparkline: number[];
}

export interface AgentLog {
  id: string;
  timestamp: number;
  type: 'info' | 'warning' | 'critical' | 'success' | 'analysis' | 'action';
  source: 'pyth-pro' | 'entropy' | 'agent' | 'risk-engine' | 'executor';
  message: string;
}

export interface RiskMetrics {
  overallScore: number; // 0-100
  volatilityIndex: number;
  correlationRisk: number;
  liquidationProximity: number;
  entropyHealth: number;
  trend: 'improving' | 'stable' | 'deteriorating';
}

export interface Position {
  id: string;
  asset: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  healthFactor: number;
  leverage: number;
}

export interface AgentState {
  status: 'monitoring' | 'analyzing' | 'executing' | 'idle' | 'alert';
  uptime: number;
  decisionsToday: number;
  accuracy: number;
  lastAction: string;
  lastActionTime: number;
}

export interface EntropySimulation {
  id: string;
  scenario: string;
  probability: number;
  impact: number;
  recommendedAction: string;
  status: 'pending' | 'running' | 'complete';
  /** Real Pyth Entropy seed from Fortuna (hex string) */
  entropySeed?: string;
  /** Shortened display version: 0xabcd...ef01 */
  entropySeedShort?: string;
  /** Chain the seed originated from */
  entropyChain?: string;
  /** Sequence number on-chain */
  entropySequence?: number;
  /** Whether the seed is live from Fortuna or a local fallback */
  entropyIsLive?: boolean;
}

// ── Publisher Radar Types ──

export interface Publisher {
  id: string;
  name: string;
  shortName: string;         // e.g. "JS" for Jane Street
  tier: 'institutional' | 'exchange' | 'market-maker' | 'defi';
  stake: number;             // PYTH staked
  stakeCap: number;          // max stake cap
  stakeUtilization: number;  // stake / stakeCap
}

export interface PublisherFeedMetrics {
  publisherId: string;
  feedSymbol: string;
  reportedPrice: number;
  deviation: number;          // deviation from aggregate in confidence intervals
  deviationAbsolute: number;  // absolute $ deviation
  latency: number;            // ms behind fastest reporter
  uptime: number;             // 0-100%
  lastReportTime: number;
  status: 'healthy' | 'lagging' | 'deviating' | 'suspicious' | 'offline';
  priceHistory: number[];     // recent reported prices (for sparkline)
}

export interface ConfidenceAlert {
  id: string;
  feedSymbol: string;
  timestamp: number;
  previousConf: number;
  currentConf: number;
  changePercent: number;      // % change in confidence width
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface PublisherRadarState {
  publishers: Publisher[];
  feedMetrics: Map<string, PublisherFeedMetrics[]>;  // feedSymbol → publisher metrics
  confidenceAlerts: ConfidenceAlert[];
  confidenceHistory: Map<string, number[]>;          // feedSymbol → confidence over time
  fastestPublisher: string;                          // publisher name
  avgLatency: number;
  suspiciousCount: number;
}
