// ── Historical Price Chart Panel ──
// Full interactive price chart with timeframes, confidence bands, and OHLC view

import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
  Bar,
} from 'recharts';
import { BarChart3, TrendingUp, Activity, Layers, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { PriceFeed } from '../types';
import {
  getPriceHistory,
  aggregateOHLC,
  getPriceStats,
  type PricePoint,
} from '../services/priceHistoryService';
import { formatPrice } from '../hooks';
import InfoTooltip from './InfoTooltip';

interface PriceChartPanelProps {
  feeds: PriceFeed[];
}

type ChartMode = 'line' | 'area' | 'ohlc';
type TimeRange = '1m' | '5m' | '10m' | 'all';

const timeRangeMs: Record<TimeRange, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '10m': 10 * 60_000,
  all: Infinity,
};

const barDurations: Record<TimeRange, number> = {
  '1m': 5_000,     // 5s bars
  '5m': 15_000,    // 15s bars
  '10m': 30_000,   // 30s bars
  all: 60_000,     // 1m bars
};

function formatChartTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default memo(function PriceChartPanel({ feeds }: PriceChartPanelProps) {
  const [selectedFeedId, setSelectedFeedId] = useState<string>(feeds[0]?.id || '');
  const [chartMode, setChartMode] = useState<ChartMode>('area');
  const [timeRange, setTimeRange] = useState<TimeRange>('5m');
  const [showConfidence, setShowConfidence] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const selectedFeed = feeds.find(f => f.id === selectedFeedId) || feeds[0];

  // Get filtered price history
  const chartData = useMemo(() => {
    if (!selectedFeed) return [];
    const history = getPriceHistory(selectedFeed.id);
    const cutoff = timeRange === 'all' ? 0 : Date.now() - timeRangeMs[timeRange];
    return history
      .filter(p => p.timestamp >= cutoff)
      .map(p => ({
        time: p.timestamp,
        timeLabel: formatChartTime(p.timestamp),
        price: p.price,
        confidence: p.confidence,
        emaPrice: p.emaPrice,
        upperBand: p.price + p.confidence,
        lowerBand: p.price - p.confidence,
      }));
  }, [selectedFeed, timeRange, feeds]); // feeds dep triggers re-render on price updates

  // OHLC data
  const ohlcData = useMemo(() => {
    if (!selectedFeed || chartMode !== 'ohlc') return [];
    const bars = aggregateOHLC(selectedFeed.id, barDurations[timeRange]);
    const cutoff = timeRange === 'all' ? 0 : Date.now() - timeRangeMs[timeRange];
    return bars
      .filter(b => b.timestamp >= cutoff)
      .map(b => ({
        time: b.timestamp,
        timeLabel: formatChartTime(b.timestamp),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        confidence: b.confidence,
        // For candlestick rendering
        body: Math.abs(b.close - b.open),
        isGreen: b.close >= b.open,
        bodyBottom: Math.min(b.open, b.close),
        wick: b.high - b.low,
      }));
  }, [selectedFeed, chartMode, timeRange, feeds]);

  // Price stats
  const stats = useMemo(() => {
    if (!selectedFeed) return null;
    return getPriceStats(selectedFeed.id);
  }, [selectedFeed, feeds]);

  if (feeds.length === 0) return null;

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-pyth-purple" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Historical Price Chart
          </h2>
          <InfoTooltip
            title="Extended Price History"
            content="Interactive chart showing detailed price history accumulated from Pyth Hermes SSE stream. Supports line, area, and OHLC candlestick views with confidence band overlays and EMA tracking. Data points are stored in-memory from the moment you open the dashboard."
            learnMoreUrl="https://docs.pyth.network/price-feeds/pythnet-price-feeds"
          />
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto sm:ml-0 p-1 rounded hover:bg-pyth-surface/50 text-pyth-text-muted"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Feed selector */}
            <select
              value={selectedFeedId}
              onChange={e => setSelectedFeedId(e.target.value)}
              className="font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-2 py-1 text-pyth-text focus:border-pyth-purple/50 outline-none"
            >
              {feeds.map(f => (
                <option key={f.id} value={f.id}>{f.symbol}</option>
              ))}
            </select>

            {/* Time range */}
            <div className="flex gap-0.5 bg-pyth-surface/50 rounded-lg p-0.5">
              {(['1m', '5m', '10m', 'all'] as TimeRange[]).map(tr => (
                <button
                  key={tr}
                  onClick={() => setTimeRange(tr)}
                  className={`font-mono text-[10px] px-2 py-0.5 rounded transition-all ${
                    timeRange === tr
                      ? 'bg-pyth-purple/20 text-pyth-purple'
                      : 'text-pyth-text-muted hover:text-pyth-text'
                  }`}
                >
                  {tr.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Chart mode */}
            <div className="flex gap-0.5 bg-pyth-surface/50 rounded-lg p-0.5">
              <button
                onClick={() => setChartMode('line')}
                className={`p-1 rounded transition-all ${chartMode === 'line' ? 'bg-pyth-purple/20 text-pyth-purple' : 'text-pyth-text-muted'}`}
                title="Line chart"
              >
                <TrendingUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => setChartMode('area')}
                className={`p-1 rounded transition-all ${chartMode === 'area' ? 'bg-pyth-purple/20 text-pyth-purple' : 'text-pyth-text-muted'}`}
                title="Area chart"
              >
                <Layers className="w-3 h-3" />
              </button>
              <button
                onClick={() => setChartMode('ohlc')}
                className={`p-1 rounded transition-all ${chartMode === 'ohlc' ? 'bg-pyth-purple/20 text-pyth-purple' : 'text-pyth-text-muted'}`}
                title="OHLC candlestick"
              >
                <Activity className="w-3 h-3" />
              </button>
            </div>

            {/* Toggle overlays */}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showConfidence}
                onChange={e => setShowConfidence(e.target.checked)}
                className="w-3 h-3 accent-pyth-purple"
              />
              <span className="font-mono text-[9px] text-pyth-text-muted">Conf.</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showEMA}
                onChange={e => setShowEMA(e.target.checked)}
                className="w-3 h-3 accent-pyth-cyan"
              />
              <span className="font-mono text-[9px] text-pyth-text-muted">EMA</span>
            </label>
          </div>
        )}
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Stats bar */}
            {stats && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                {[
                  { label: 'Current', value: `$${formatPrice(selectedFeed?.price || 0)}`, color: 'text-pyth-text' },
                  { label: 'High', value: `$${formatPrice(stats.max)}`, color: 'text-pyth-green' },
                  { label: 'Low', value: `$${formatPrice(stats.min)}`, color: 'text-pyth-red' },
                  { label: 'Avg', value: `$${formatPrice(stats.avg)}`, color: 'text-pyth-cyan' },
                  { label: 'Std Dev', value: `$${stats.stdDev < 1 ? stats.stdDev.toFixed(4) : stats.stdDev.toFixed(2)}`, color: 'text-pyth-lavender' },
                  { label: 'Points', value: `${stats.count}`, color: 'text-pyth-text-muted' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-pyth-surface/40 rounded-lg p-2 text-center">
                    <div className="font-mono text-[9px] text-pyth-text-muted uppercase">{label}</div>
                    <div className={`font-mono text-xs font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Chart */}
            <div className="h-64 sm:h-80">
              {chartData.length < 2 && chartMode !== 'ohlc' ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Clock className="w-8 h-8 text-pyth-text-muted/30 mx-auto mb-2" />
                    <p className="font-mono text-xs text-pyth-text-muted">
                      Accumulating price data from Pyth Hermes...
                    </p>
                    <p className="font-mono text-[10px] text-pyth-text-muted/60 mt-1">
                      {chartData.length} point{chartData.length !== 1 ? 's' : ''} collected — chart appears after 2+ points
                    </p>
                  </div>
                </div>
              ) : chartMode === 'ohlc' ? (
                <OHLCChart data={ohlcData} showConfidence={showConfidence} />
              ) : chartMode === 'line' ? (
                <LineChartView data={chartData} showConfidence={showConfidence} showEMA={showEMA} />
              ) : (
                <AreaChartView data={chartData} showConfidence={showConfidence} showEMA={showEMA} />
              )}
            </div>

            {/* Duration indicator */}
            {stats && (
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[9px] text-pyth-text-muted">
                  {Math.round(stats.durationMs / 1000)}s of data · {chartData.length} visible points
                </span>
                <span className="font-mono text-[9px] text-pyth-text-muted">
                  {selectedFeed?.symbol} · Pyth Hermes SSE
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Chart sub-components ──

interface ChartViewProps {
  data: Array<{
    time: number;
    timeLabel: string;
    price: number;
    confidence: number;
    emaPrice: number;
    upperBand: number;
    lowerBand: number;
  }>;
  showConfidence: boolean;
  showEMA: boolean;
}

function LineChartView({ data, showConfidence, showEMA }: ChartViewProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(171,135,255,0.06)" />
        <XAxis
          dataKey="timeLabel"
          tick={{ fontSize: 9, fill: '#8A8EA0' }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={{ stroke: 'rgba(171,135,255,0.1)' }}
        />
        <YAxis
          tick={{ fontSize: 9, fill: '#8A8EA0' }}
          tickFormatter={(v: number) => `$${formatPrice(v)}`}
          width={80}
          domain={['auto', 'auto']}
          tickLine={false}
          axisLine={{ stroke: 'rgba(171,135,255,0.1)' }}
        />
        <Tooltip content={<CustomTooltip />} />
        {showConfidence && (
          <>
            <Line type="monotone" dataKey="upperBand" stroke="rgba(171,135,255,0.2)" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Upper Conf." />
            <Line type="monotone" dataKey="lowerBand" stroke="rgba(171,135,255,0.2)" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Lower Conf." />
          </>
        )}
        {showEMA && (
          <Line type="monotone" dataKey="emaPrice" stroke="#05D2DD" strokeWidth={1} strokeDasharray="5 3" dot={false} name="EMA" />
        )}
        <Line type="monotone" dataKey="price" stroke="#AB87FF" strokeWidth={2} dot={false} name="Price" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaChartView({ data, showConfidence, showEMA }: ChartViewProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#AB87FF" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#AB87FF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#AB87FF" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#AB87FF" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(171,135,255,0.06)" />
        <XAxis
          dataKey="timeLabel"
          tick={{ fontSize: 9, fill: '#8A8EA0' }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={{ stroke: 'rgba(171,135,255,0.1)' }}
        />
        <YAxis
          tick={{ fontSize: 9, fill: '#8A8EA0' }}
          tickFormatter={(v: number) => `$${formatPrice(v)}`}
          width={80}
          domain={['auto', 'auto']}
          tickLine={false}
          axisLine={{ stroke: 'rgba(171,135,255,0.1)' }}
        />
        <Tooltip content={<CustomTooltip />} />
        {showConfidence && (
          <>
            <Area type="monotone" dataKey="upperBand" stroke="none" fill="url(#confGrad)" name="Upper Conf." />
            <Area type="monotone" dataKey="lowerBand" stroke="none" fill="none" name="Lower Conf." />
          </>
        )}
        {showEMA && (
          <Line type="monotone" dataKey="emaPrice" stroke="#05D2DD" strokeWidth={1} strokeDasharray="5 3" dot={false} name="EMA" />
        )}
        <Area type="monotone" dataKey="price" stroke="#AB87FF" strokeWidth={2} fill="url(#priceGrad)" dot={false} name="Price" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function OHLCChart({ data, showConfidence }: { data: Array<Record<string, unknown>>; showConfidence: boolean }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="font-mono text-xs text-pyth-text-muted">Accumulating data for OHLC bars...</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(171,135,255,0.06)" />
        <XAxis
          dataKey="timeLabel"
          tick={{ fontSize: 9, fill: '#8A8EA0' }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={{ stroke: 'rgba(171,135,255,0.1)' }}
        />
        <YAxis
          tick={{ fontSize: 9, fill: '#8A8EA0' }}
          tickFormatter={(v: number) => `$${formatPrice(v)}`}
          width={80}
          domain={['auto', 'auto']}
          tickLine={false}
          axisLine={{ stroke: 'rgba(171,135,255,0.1)' }}
        />
        <Tooltip content={<OHLCTooltip />} />
        {showConfidence && (
          <Bar dataKey="confidence" fill="rgba(171,135,255,0.05)" name="Confidence" />
        )}
        {/* Wick (high-low range) */}
        <Bar dataKey="wick" fill="rgba(171,135,255,0.3)" barSize={2} name="Range" />
        {/* Body (open-close) — color-coded */}
        {data.map((d, i) => (
          <Bar
            key={i}
            dataKey="body"
            fill={(d as { isGreen: boolean }).isGreen ? '#00FFA3' : '#FF4162'}
            barSize={8}
            name="Body"
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Custom tooltip ──

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-pyth-surface/95 backdrop-blur-md border border-pyth-border rounded-lg p-2 shadow-xl">
      <p className="font-mono text-[9px] text-pyth-text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="font-mono text-[10px] text-pyth-text-muted">{p.name}:</span>
          <span className="font-mono text-[10px] text-pyth-text font-bold">
            ${typeof p.value === 'number' ? formatPrice(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function OHLCTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, number | boolean> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-pyth-surface/95 backdrop-blur-md border border-pyth-border rounded-lg p-2 shadow-xl">
      <p className="font-mono text-[9px] text-pyth-text-muted mb-1">{label}</p>
      {(['open', 'high', 'low', 'close'] as const).map(k => (
        <div key={k} className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] text-pyth-text-muted uppercase">{k}:</span>
          <span className="font-mono text-[10px] text-pyth-text font-bold">
            ${formatPrice(d[k] as number)}
          </span>
        </div>
      ))}
    </div>
  );
}
