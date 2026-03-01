// ── Historical Replay / Backtest Panel ──
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { History, Play, Pause, RotateCcw, Shield, Zap, AlertTriangle, TrendingDown, Clock } from 'lucide-react';
import type { PriceFeed } from '../types';
import {
  HISTORICAL_EVENTS,
  runBacktest,
  type HistoricalEvent,
  type BacktestResult,
} from '../services/backtestEngine';

interface BacktestPanelProps {
  feeds: PriceFeed[];
}

const severityColors = {
  moderate: { bg: 'bg-pyth-yellow/10', text: 'text-pyth-yellow', border: 'border-pyth-yellow/20' },
  severe: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  extreme: { bg: 'bg-pyth-red/10', text: 'text-pyth-red', border: 'border-pyth-red/20' },
};

export default function BacktestPanel({ feeds }: BacktestPanelProps) {
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent>(HISTORICAL_EVENTS[0]);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Run backtest when event changes
  useEffect(() => {
    if (feeds.length === 0) return;
    const r = runBacktest(selectedEvent, feeds);
    setResult(r);
    setFrameIndex(0);
    setPlaying(false);
  }, [selectedEvent, feeds]);

  // Playback timer
  useEffect(() => {
    if (playing && result) {
      timerRef.current = setInterval(() => {
        setFrameIndex(prev => {
          if (prev >= result.frames.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 100); // 10fps playback
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, result]);

  const handlePlay = () => {
    if (frameIndex >= (result?.frames.length ?? 1) - 1) {
      setFrameIndex(0);
    }
    setPlaying(true);
  };

  const handlePause = () => setPlaying(false);
  const handleReset = () => {
    setPlaying(false);
    setFrameIndex(0);
  };

  if (!result) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-pyth-cyan" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Historical Replay
          </h2>
        </div>
        <div className="flex items-center justify-center py-8 gap-2">
          <div className="w-4 h-4 border-2 border-pyth-cyan/30 border-t-pyth-cyan rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-pyth-text-muted">Waiting for live feed data...</span>
        </div>
      </div>
    );
  }

  const currentFrame = result.frames[frameIndex];
  const chartData = result.frames.slice(0, frameIndex + 1).map((f, i) => ({
    i,
    without: f.pnlWithout,
    with: f.pnlWith,
    risk: f.riskScore,
  }));

  const progress = ((frameIndex + 1) / result.frames.length) * 100;

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pyth-cyan/20 flex items-center justify-center">
            <History className="w-4 h-4 text-pyth-cyan" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-pyth-cyan font-mono tracking-wide">
              HISTORICAL REPLAY
            </h2>
            <p className="text-[10px] text-pyth-text-muted font-mono">
              Backtest Guardian Shield Against Past Events
            </p>
          </div>
        </div>

        {/* Event selector */}
        <select
          value={selectedEvent.id}
          onChange={(e) => {
            const ev = HISTORICAL_EVENTS.find(h => h.id === e.target.value);
            if (ev) setSelectedEvent(ev);
          }}
          className="appearance-none bg-pyth-surface border border-pyth-border rounded-lg px-3 py-1.5 text-xs font-mono text-pyth-text focus:outline-none focus:border-pyth-cyan/50 cursor-pointer"
        >
          {HISTORICAL_EVENTS.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name} ({ev.date})</option>
          ))}
        </select>
      </div>

      {/* Event description */}
      <div className={`px-3 py-2.5 rounded-lg border ${severityColors[selectedEvent.severity].bg} ${severityColors[selectedEvent.severity].border}`}>
        <div className="flex items-start gap-2">
          <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${severityColors[selectedEvent.severity].text}`} />
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs font-mono font-bold ${severityColors[selectedEvent.severity].text}`}>
                {selectedEvent.name}
              </span>
              <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full uppercase font-bold ${severityColors[selectedEvent.severity].bg} ${severityColors[selectedEvent.severity].text}`}>
                {selectedEvent.severity}
              </span>
            </div>
            <p className="text-[10px] font-mono text-pyth-text-dim leading-relaxed">
              {selectedEvent.description}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[9px] font-mono text-pyth-text-muted">
                <Clock className="w-3 h-3 inline mr-0.5" /> {selectedEvent.date}
              </span>
              <span className="text-[9px] font-mono text-pyth-text-muted">
                <TrendingDown className="w-3 h-3 inline mr-0.5" /> Max drawdown: {selectedEvent.maxDrawdown}%
              </span>
              <span className="text-[9px] font-mono text-pyth-text-muted">
                Assets: {selectedEvent.assets.join(', ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {playing ? (
            <button
              onClick={handlePause}
              className="w-8 h-8 rounded-lg bg-pyth-cyan/15 border border-pyth-cyan/25 flex items-center justify-center text-pyth-cyan hover:bg-pyth-cyan/25 transition-all"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="w-8 h-8 rounded-lg bg-pyth-cyan/15 border border-pyth-cyan/25 flex items-center justify-center text-pyth-cyan hover:bg-pyth-cyan/25 transition-all"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-lg bg-pyth-surface border border-pyth-border flex items-center justify-center text-pyth-text-dim hover:bg-pyth-surface/80 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-pyth-bg rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-pyth-cyan rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Frame info */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-mono text-pyth-text-muted">
            {frameIndex + 1}/{result.frames.length}
          </span>
          <span className={`text-xs font-mono font-bold ${
            currentFrame.riskScore > 70 ? 'text-pyth-red' :
            currentFrame.riskScore > 40 ? 'text-pyth-yellow' : 'text-pyth-green'
          }`}>
            Risk: {currentFrame.riskScore.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Live indicators during replay */}
      <AnimatePresence>
        {currentFrame.guardianTriggered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pyth-purple/10 border border-pyth-purple/25"
          >
            <Shield className="w-4 h-4 text-pyth-purple animate-pulse" />
            <span className="text-[10px] font-mono text-pyth-purple font-bold">
              GUARDIAN SHIELD ACTIVATED — Hedging positions to reduce exposure
            </span>
          </motion.div>
        )}
        {currentFrame.entropyExitUsed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pyth-green/10 border border-pyth-green/25"
          >
            <Zap className="w-4 h-4 text-pyth-green animate-pulse" />
            <span className="text-[10px] font-mono text-pyth-green font-bold">
              ENTROPY-RANDOMIZED EXIT — MEV-safe position close via Pyth Entropy
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* P&L comparison chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* P&L chart */}
        <div className="bg-pyth-surface/50 rounded-lg p-3">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase tracking-wider mb-2">
            Portfolio P&L Comparison
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="withoutGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF4162" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#FF4162" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="withGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5FE59A" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#5FE59A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Area type="monotone" dataKey="without" stroke="#FF4162" fill="url(#withoutGrad)" strokeWidth={1.5} name="Unprotected" />
                <Area type="monotone" dataKey="with" stroke="#5FE59A" fill="url(#withGrad)" strokeWidth={1.5} name="With Sentinel" />
                <Tooltip
                  contentStyle={{
                    background: '#13131A',
                    border: '1px solid rgba(0,212,255,0.3)',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontFamily: 'JetBrains Mono',
                    color: '#E8E8ED',
                  }}
                  formatter={(value: number | undefined, name?: string) => [
                    `$${(value ?? 0).toFixed(2)}`,
                    name ?? ''
                  ]}
                  labelFormatter={() => ''}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-pyth-red" />
              <span className="text-[9px] font-mono text-pyth-text-muted">Unprotected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-pyth-green" />
              <span className="text-[9px] font-mono text-pyth-text-muted">With Sentinel</span>
            </div>
          </div>
        </div>

        {/* Risk score chart */}
        <div className="bg-pyth-surface/50 rounded-lg p-3">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase tracking-wider mb-2">
            Risk Score Over Time
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis domain={[0, 100]} hide />
                <XAxis hide />
                <ReferenceLine y={70} stroke="rgba(255,65,98,0.3)" strokeDasharray="3 3" />
                <ReferenceLine y={40} stroke="rgba(255,216,107,0.3)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="risk" stroke="#00D4FF" strokeWidth={2} dot={false} />
                <Tooltip
                  contentStyle={{
                    background: '#13131A',
                    border: '1px solid rgba(0,212,255,0.3)',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontFamily: 'JetBrains Mono',
                    color: '#E8E8ED',
                  }}
                  formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(0)}/100`, 'Risk']}
                  labelFormatter={() => ''}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[9px] font-mono text-pyth-text-muted">
              🟢 &lt;40 Safe · 🟡 40-70 Elevated · 🔴 &gt;70 Guardian Trigger
            </span>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {frameIndex >= result.frames.length - 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <div className="bg-pyth-surface/50 rounded-lg p-3 text-center">
            <div className="text-[9px] font-mono text-pyth-text-muted uppercase">Drawdown Reduced</div>
            <div className="text-lg font-mono font-bold text-pyth-green">
              {result.summary.drawdownReduction.toFixed(0)}%
            </div>
          </div>
          <div className="bg-pyth-surface/50 rounded-lg p-3 text-center">
            <div className="text-[9px] font-mono text-pyth-text-muted uppercase">$ Saved</div>
            <div className="text-lg font-mono font-bold text-pyth-green">
              ${result.summary.totalSaved.toFixed(0)}
            </div>
          </div>
          <div className="bg-pyth-surface/50 rounded-lg p-3 text-center">
            <div className="text-[9px] font-mono text-pyth-text-muted uppercase">Shield Activations</div>
            <div className="text-lg font-mono font-bold text-pyth-purple">
              {result.summary.guardianActivations}
            </div>
          </div>
          <div className="bg-pyth-surface/50 rounded-lg p-3 text-center">
            <div className="text-[9px] font-mono text-pyth-text-muted uppercase">Sharpe Δ</div>
            <div className="text-lg font-mono font-bold text-pyth-cyan">
              +{result.summary.sharpeImprovement.toFixed(2)}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
