// ── Publisher Radar: Oracle Meta-Analysis ──
// Analyzes the "sources of the source" — Pyth's 120+ first-party institutional publishers.
// Tracks deviation, latency, uptime, confidence sensitivity, and stake utilization.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Radar,
  Radio,
  AlertTriangle,
  Shield,
  Zap,
  Eye,
  ChevronDown,
  TrendingUp,
  Server,
  Lock,
} from 'lucide-react';
import type { PublisherRadarData } from '../hooks';

interface Props {
  radar: PublisherRadarData;
}

// ── Status badge colors ──
const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  healthy:    { bg: 'bg-pyth-green/10',  text: 'text-pyth-green',  dot: 'bg-pyth-green' },
  lagging:    { bg: 'bg-pyth-yellow/10', text: 'text-pyth-yellow', dot: 'bg-pyth-yellow' },
  deviating:  { bg: 'bg-pyth-yellow/10', text: 'text-pyth-yellow', dot: 'bg-pyth-yellow' },
  suspicious: { bg: 'bg-pyth-red/10',    text: 'text-pyth-red',    dot: 'bg-pyth-red' },
  offline:    { bg: 'bg-pyth-text-muted/10', text: 'text-pyth-text-muted', dot: 'bg-pyth-text-muted' },
};

// ── Tier badge ──
const tierColors: Record<string, string> = {
  institutional: 'text-pyth-purple bg-pyth-purple/10',
  exchange: 'text-pyth-cyan bg-pyth-cyan/10',
  'market-maker': 'text-pyth-green bg-pyth-green/10',
  defi: 'text-pyth-yellow bg-pyth-yellow/10',
};

import { memo } from 'react';

export default memo(function PublisherRadar({ radar }: Props) {
  const {
    publishers,
    feedMetrics,
    confidenceAlerts,
    confidenceHistory,
    fastestPublisher,
    suspiciousCount,
    avgLatency,
    selectedFeed,
    setSelectedFeed,
  } = radar;

  const [expandedPublisher, setExpandedPublisher] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'publishers' | 'confidence' | 'stakes'>('publishers');

  const currentMetrics = feedMetrics[selectedFeed] || [];
  const feedSymbols = Object.keys(feedMetrics);

  // Sort publishers by deviation (suspicious first)
  const sortedMetrics = [...currentMetrics].sort((a, b) => {
    const statusOrder = { suspicious: 0, deviating: 1, lagging: 2, offline: 3, healthy: 4 };
    return (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
  });

  // Loading state when no metrics yet
  const hasData = feedSymbols.length > 0;

  return (
    <div className="glass-card p-4 space-y-4 min-h-[200px]">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pyth-purple/20 flex items-center justify-center shrink-0">
            <Radar className="w-4 h-4 text-pyth-purple" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-pyth-lavender font-mono tracking-wide">
              PUBLISHER RADAR
            </h2>
            <p className="text-[10px] text-pyth-text-muted font-mono">
              Oracle Meta-Analysis · {publishers.length} Publishers
            </p>
          </div>
        </div>

        {/* ── Quick Stats ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {suspiciousCount > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pyth-red/15 border border-pyth-red/30"
            >
              <AlertTriangle className="w-3 h-3 text-pyth-red" />
              <span className="text-[10px] font-mono text-pyth-red font-bold">
                {suspiciousCount} SUSPICIOUS
              </span>
            </motion.div>
          )}
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-pyth-green/10">
            <Zap className="w-3 h-3 text-pyth-green" />
            <span className="text-[10px] font-mono text-pyth-green">
              {fastestPublisher.name} · {fastestPublisher.avgLatency}ms
            </span>
          </div>
          <div className="text-[10px] font-mono text-pyth-text-dim">
            AVG {avgLatency}ms
          </div>
        </div>
      </div>

      {/* ── Feed Selector + Tab Bar ── */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="w-5 h-5 border-2 border-pyth-purple/30 border-t-pyth-purple rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-pyth-text-muted">
            Waiting for live feed data to compute publisher metrics...
          </span>
        </div>
      ) : (
      <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        {/* Feed selector dropdown */}
        <div className="relative w-full sm:w-auto">
          <select
            value={selectedFeed}
            onChange={(e) => setSelectedFeed(e.target.value)}
            className="appearance-none w-full sm:w-auto bg-pyth-surface border border-pyth-border rounded-lg px-3 py-1.5 pr-7 text-xs font-mono text-pyth-text focus:outline-none focus:border-pyth-purple/50 cursor-pointer"
          >
            {feedSymbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-pyth-text-dim absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-pyth-surface rounded-lg p-0.5 w-full sm:w-auto overflow-x-auto">
          {(['publishers', 'confidence', 'stakes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 sm:px-3 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-pyth-purple/20 text-pyth-lavender'
                  : 'text-pyth-text-muted hover:text-pyth-text-dim'
              }`}
            >
              {tab === 'publishers' && <Server className="w-3 h-3 inline mr-1" />}
              {tab === 'confidence' && <Eye className="w-3 h-3 inline mr-1" />}
              {tab === 'stakes' && <Lock className="w-3 h-3 inline mr-1" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'publishers' && (
          <motion.div
            key="publishers"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <PublisherTable
              metrics={sortedMetrics}
              publishers={publishers}
              expanded={expandedPublisher}
              onToggle={setExpandedPublisher}
            />
          </motion.div>
        )}

        {activeTab === 'confidence' && (
          <motion.div
            key="confidence"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ConfidencePanel
              alerts={confidenceAlerts}
              history={confidenceHistory}
              selectedFeed={selectedFeed}
            />
          </motion.div>
        )}

        {activeTab === 'stakes' && (
          <motion.div
            key="stakes"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <StakesPanel publishers={publishers} />
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
});

// ══════════════════════════════════════════════════════════
// ── Publisher Table Sub-Component
// ══════════════════════════════════════════════════════════

function PublisherTable({
  metrics,
  publishers,
  expanded,
  onToggle,
}: {
  metrics: import('../types').PublisherFeedMetrics[];
  publishers: import('../types').Publisher[];
  expanded: string | null;
  onToggle: (id: string | null) => void;
}) {
  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1 text-[9px] font-mono text-pyth-text-muted uppercase tracking-wider">
        <div className="col-span-3">Publisher</div>
        <div className="col-span-2 text-right">Deviation</div>
        <div className="col-span-2 text-right">Latency</div>
        <div className="col-span-2 text-right">Uptime</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-1 text-center">Trend</div>
      </div>

      {/* Publisher rows */}
      <div className="space-y-0.5 max-h-[280px] overflow-y-auto custom-scrollbar">
        {metrics.map((m) => {
          const pub = publishers.find(p => p.id === m.publisherId);
          if (!pub) return null;
          const colors = statusColors[m.status] || statusColors.healthy;
          const isExpanded = expanded === m.publisherId;
          const isSuspicious = m.status === 'suspicious';

          return (
            <div key={m.publisherId}>
              <motion.div
                layout
                onClick={() => onToggle(isExpanded ? null : m.publisherId)}
                className={`px-3 py-2 rounded-lg cursor-pointer transition-all
                  ${isSuspicious ? 'bg-pyth-red/5 border border-pyth-red/20' : 'bg-pyth-surface/50 hover:bg-pyth-surface'}
                  ${isExpanded ? 'border border-pyth-purple/30 bg-pyth-purple/5' : ''}`}
              >
                {/* ── Mobile Card Layout ── */}
                <div className="sm:hidden space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold font-mono shrink-0 ${tierColors[pub.tier]}`}>
                        {pub.shortName}
                      </div>
                      <div className="truncate">
                        <div className="text-xs text-pyth-text truncate">{pub.name}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase shrink-0 ${colors.bg} ${colors.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${isSuspicious ? 'animate-pulse' : ''}`} />
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-pyth-text-muted">
                    <span>Dev: <span className={m.deviation > 20 ? 'text-pyth-red font-bold' : m.deviation > 5 ? 'text-pyth-yellow' : 'text-pyth-text-dim'}>{m.deviation.toFixed(1)}σ</span></span>
                    <span>Lat: <span className={m.latency > 80 ? 'text-pyth-yellow' : m.latency < 20 ? 'text-pyth-green' : 'text-pyth-text-dim'}>{m.latency}ms</span></span>
                    <span>Up: <span className={m.uptime >= 99 ? 'text-pyth-green' : m.uptime >= 97 ? 'text-pyth-text-dim' : 'text-pyth-yellow'}>{m.uptime}%</span></span>
                    <span className={`text-[9px] ${tierColors[pub.tier]} px-1 rounded`}>{pub.tier}</span>
                  </div>
                </div>

                {/* ── Desktop Grid Layout ── */}
                <div className="hidden sm:grid grid-cols-12 gap-2">
                  {/* Publisher name */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold font-mono ${tierColors[pub.tier]}`}>
                      {pub.shortName}
                    </div>
                    <div className="truncate">
                      <div className="text-xs text-pyth-text truncate">{pub.name}</div>
                      <div className={`text-[9px] font-mono ${tierColors[pub.tier]} inline-block px-1 rounded`}>
                        {pub.tier}
                      </div>
                    </div>
                  </div>

                  {/* Deviation */}
                  <div className="col-span-2 flex items-center justify-end">
                    <span className={`text-xs font-mono ${
                      m.deviation > 20 ? 'text-pyth-red font-bold' :
                      m.deviation > 5 ? 'text-pyth-yellow' :
                      'text-pyth-text-dim'
                    }`}>
                      {m.deviation.toFixed(1)}σ
                    </span>
                  </div>

                  {/* Latency */}
                  <div className="col-span-2 flex items-center justify-end">
                    <span className={`text-xs font-mono ${
                      m.latency > 80 ? 'text-pyth-yellow' :
                      m.latency < 20 ? 'text-pyth-green' :
                      'text-pyth-text-dim'
                    }`}>
                      {m.latency}ms
                    </span>
                  </div>

                  {/* Uptime */}
                  <div className="col-span-2 flex items-center justify-end">
                    <span className={`text-xs font-mono ${
                      m.uptime >= 99 ? 'text-pyth-green' :
                      m.uptime >= 97 ? 'text-pyth-text-dim' :
                      'text-pyth-yellow'
                    }`}>
                      {m.uptime}%
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className="col-span-2 flex items-center justify-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase ${colors.bg} ${colors.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${isSuspicious ? 'animate-pulse' : ''}`} />
                      {m.status}
                    </span>
                  </div>

                  {/* Mini sparkline */}
                  <div className="col-span-1 flex items-center justify-center">
                    {m.priceHistory.length > 2 && (
                      <div className="w-8 h-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={m.priceHistory.map((p, i) => ({ v: p, i }))}>
                            <Area
                              type="monotone"
                              dataKey="v"
                              stroke={isSuspicious ? '#FF4162' : '#AB87FF'}
                              fill={isSuspicious ? 'rgba(255,65,98,0.1)' : 'rgba(171,135,255,0.1)'}
                              strokeWidth={1}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 sm:px-4 py-3 sm:ml-4 border-l-2 border-pyth-purple/30 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <div className="text-[9px] font-mono text-pyth-text-muted uppercase">Reported Price</div>
                          <div className="text-sm font-mono text-pyth-text">
                            ${m.reportedPrice >= 1 ? m.reportedPrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : m.reportedPrice.toFixed(4)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono text-pyth-text-muted uppercase">$ Deviation</div>
                          <div className={`text-sm font-mono ${m.deviationAbsolute > 1 ? 'text-pyth-yellow' : 'text-pyth-text-dim'}`}>
                            ±${m.deviationAbsolute >= 1 ? m.deviationAbsolute.toFixed(2) : m.deviationAbsolute.toFixed(4)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono text-pyth-text-muted uppercase">Stake</div>
                          <div className="text-sm font-mono text-pyth-text">
                            {(pub.stake / 1_000_000).toFixed(1)}M PYTH
                          </div>
                        </div>
                      </div>
                      {isSuspicious && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pyth-red/10 border border-pyth-red/20">
                          <AlertTriangle className="w-4 h-4 text-pyth-red flex-shrink-0" />
                          <span className="text-[10px] font-mono text-pyth-red">
                            ALERT: Publisher deviates &gt;20σ from aggregate. Price report flagged as suspicious. Potential data staleness or manipulation.
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── Confidence Interval Sensitivity Panel
// ══════════════════════════════════════════════════════════

function ConfidencePanel({
  alerts,
  history,
  selectedFeed,
}: {
  alerts: import('../types').ConfidenceAlert[];
  history: Record<string, number[]>;
  selectedFeed: string;
}) {
  const confData = (history[selectedFeed] || []).map((v, i) => ({ i, conf: v }));
  const feedAlerts = alerts.filter(a => a.feedSymbol === selectedFeed);

  return (
    <div className="space-y-3">
      {/* Confidence chart */}
      <div className="bg-pyth-surface/50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-pyth-cyan" />
            <span className="text-xs font-mono text-pyth-text">
              {selectedFeed} Confidence Interval (±$)
            </span>
          </div>
          {confData.length > 0 && (
            <span className="text-xs font-mono text-pyth-cyan">
              Current: ±${confData[confData.length - 1]?.conf.toFixed(4)}
            </span>
          )}
        </div>
        <div className="h-20">
          {confData.length > 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={confData}>
                <defs>
                  <linearGradient id="confGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="conf"
                  stroke="#00D4FF"
                  fill="url(#confGradient)"
                  strokeWidth={1.5}
                />
                <Tooltip
                  contentStyle={{
                    background: '#13131A',
                    border: '1px solid rgba(0,212,255,0.3)',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontFamily: 'JetBrains Mono',
                    color: '#E8E8ED',
                  }}
                  formatter={(value: number | undefined) => [`±$${(value ?? 0).toFixed(4)}`, 'Confidence']}
                  labelFormatter={() => ''}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] font-mono text-pyth-text-muted">
              Accumulating confidence data...
            </div>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="px-3 py-2 rounded-lg bg-pyth-purple/5 border border-pyth-purple/15">
        <div className="flex items-start gap-2">
          <Radio className="w-3.5 h-3.5 text-pyth-purple mt-0.5 flex-shrink-0" />
          <p className="text-[10px] font-mono text-pyth-text-dim leading-relaxed">
            Pyth's confidence interval (±conf) represents publisher consensus on price accuracy.
            <span className="text-pyth-yellow"> Widening confidence </span>
            is an early warning of extreme volatility — often preceding a crash by 2–5 seconds.
            Sentinel monitors for &gt;30% expansion as a pre-emptive risk signal.
          </p>
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-1">
        <div className="text-[9px] font-mono text-pyth-text-muted uppercase tracking-wider px-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Confidence Alerts
        </div>
        {feedAlerts.length > 0 ? (
          <div className="space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
            {feedAlerts.map(alert => (
              <div
                key={alert.id}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono flex items-start gap-2 ${
                  alert.severity === 'critical'
                    ? 'bg-pyth-red/10 border border-pyth-red/20 text-pyth-red'
                    : alert.severity === 'warning'
                    ? 'bg-pyth-yellow/10 border border-pyth-yellow/20 text-pyth-yellow'
                    : 'bg-pyth-cyan/10 border border-pyth-cyan/20 text-pyth-cyan'
                }`}
              >
                <span className="text-pyth-text-muted flex-shrink-0">
                  {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-3 rounded-lg bg-pyth-surface/30 text-center">
            <span className="text-[10px] font-mono text-pyth-text-muted">
              No confidence anomalies detected. All feeds within normal spread.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── Publisher Stake Caps Panel
// ══════════════════════════════════════════════════════════

function StakesPanel({ publishers }: { publishers: import('../types').Publisher[] }) {
  const totalStake = publishers.reduce((s, p) => s + p.stake, 0);
  const totalCap = publishers.reduce((s, p) => s + p.stakeCap, 0);
  const sorted = [...publishers].sort((a, b) => b.stake - a.stake);

  return (
    <div className="space-y-3">
      {/* Total stake header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-pyth-surface/50 rounded-lg p-3 text-center">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase">Total Staked</div>
          <div className="text-lg font-mono font-bold text-pyth-purple">
            {(totalStake / 1_000_000).toFixed(0)}M
          </div>
          <div className="text-[9px] font-mono text-pyth-text-muted">PYTH</div>
        </div>
        <div className="bg-pyth-surface/50 rounded-lg p-3 text-center">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase">Stake Cap</div>
          <div className="text-lg font-mono font-bold text-pyth-lavender">
            {(totalCap / 1_000_000).toFixed(0)}M
          </div>
          <div className="text-[9px] font-mono text-pyth-text-muted">PYTH</div>
        </div>
        <div className="bg-pyth-surface/50 rounded-lg p-3 text-center">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase">Utilization</div>
          <div className="text-lg font-mono font-bold text-pyth-green">
            {((totalStake / totalCap) * 100).toFixed(1)}%
          </div>
          <div className="text-[9px] font-mono text-pyth-text-muted">ACTIVE</div>
        </div>
      </div>

      {/* Stake bars */}
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
        {sorted.map((pub) => {
          const pct = (pub.stake / sorted[0].stake) * 100;
          const utilColor = pub.stakeUtilization > 0.85
            ? 'bg-pyth-green'
            : pub.stakeUtilization > 0.7
            ? 'bg-pyth-purple'
            : 'bg-pyth-yellow';

          return (
            <div key={pub.id} className="group px-3 py-2 rounded-lg bg-pyth-surface/30 hover:bg-pyth-surface/60 transition-all">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold font-mono ${tierColors[pub.tier]}`}>
                    {pub.shortName}
                  </div>
                  <span className="text-xs font-mono text-pyth-text">{pub.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-pyth-text-dim">
                    {(pub.stake / 1_000_000).toFixed(1)}M
                  </span>
                  <span className="text-[9px] font-mono text-pyth-text-muted">
                    / {(pub.stakeCap / 1_000_000).toFixed(0)}M
                  </span>
                </div>
              </div>
              {/* Stake bar */}
              <div className="h-1.5 rounded-full bg-pyth-bg overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${utilColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className={`text-[8px] font-mono ${tierColors[pub.tier]}`}>{pub.tier}</span>
                <span className="text-[8px] font-mono text-pyth-text-muted">
                  {(pub.stakeUtilization * 100).toFixed(1)}% utilized
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      <div className="px-3 py-2 rounded-lg bg-pyth-purple/5 border border-pyth-purple/15">
        <div className="flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-pyth-purple mt-0.5 flex-shrink-0" />
          <p className="text-[10px] font-mono text-pyth-text-dim leading-relaxed">
            Publisher stake caps enforce economic security on Pyth feeds. Higher stake =
            <span className="text-pyth-green"> more skin in the game</span>.
            Publishers exceeding their cap are throttled. Sentinel tracks utilization to assess
            the economic security backing each feed.
          </p>
        </div>
      </div>
    </div>
  );
}
