// ── Risk Gauge Component ──
import { useEffect, useState } from 'react';
import { ShieldAlert, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import type { RiskMetrics } from '../types';

interface RiskGaugeProps {
  metrics: RiskMetrics;
}

import { memo } from 'react';

export default memo(function RiskGauge({ metrics }: RiskGaugeProps) {
  const score = Math.round(metrics.overallScore);
  const riskLevel = score <= 30 ? 'LOW' : score <= 55 ? 'MODERATE' : score <= 75 ? 'ELEVATED' : 'CRITICAL';
  const riskColor =
    score <= 30 ? '#00FFA3' : score <= 55 ? '#FFD166' : score <= 75 ? '#FF8C42' : '#FF4162';

  // SVG arc math
  const radius = 80;
  const circumference = Math.PI * radius; // semi-circle
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const trendIcon =
    metrics.trend === 'improving' ? TrendingDown :
    metrics.trend === 'deteriorating' ? TrendingUp : Minus;
  const TrendIcon = trendIcon;
  const trendColor =
    metrics.trend === 'improving' ? 'text-pyth-green' :
    metrics.trend === 'deteriorating' ? 'text-pyth-red' : 'text-pyth-text-muted';

  return (
    <div className="glass-card p-4 flex flex-col items-center">
      <div className="flex items-center gap-2 mb-3 self-start">
        <ShieldAlert className="w-4 h-4 text-pyth-purple" />
        <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
          Risk Assessment
        </h2>
      </div>

      {/* Gauge */}
      <div className="relative w-48 h-28 mb-2">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={riskColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${riskColor}40)` }}
          />
          {/* Score text */}
          <text x="100" y="80" textAnchor="middle" className="font-mono" fill={riskColor} fontSize="32" fontWeight="700">
            {score}
          </text>
          <text x="100" y="98" textAnchor="middle" className="font-mono" fill="rgba(255,255,255,0.4)" fontSize="10">
            / 100
          </text>
        </svg>
      </div>

      {/* Risk Level Badge */}
      <div
        className="px-3 py-1 rounded-full font-mono text-xs font-bold tracking-wider mb-4"
        style={{ backgroundColor: `${riskColor}20`, color: riskColor }}
      >
        {riskLevel}
      </div>

      {/* Trend */}
      <div className="flex items-center gap-1.5 mb-4">
        <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
        <span className={`font-mono text-[11px] ${trendColor} capitalize`}>
          {metrics.trend}
        </span>
      </div>

      {/* Sub-metrics */}
      <div className="w-full space-y-2.5">
        <SubMetric label="Volatility Index" value={metrics.volatilityIndex} />
        <SubMetric label="Correlation Risk" value={metrics.correlationRisk} />
        <SubMetric label="Liquidation Proximity" value={metrics.liquidationProximity} />
        <SubMetric label="Entropy Health" value={metrics.entropyHealth} inverted />
      </div>
    </div>
  );
});

function SubMetric({ label, value, inverted = false }: { label: string; value: number; inverted?: boolean }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = inverted
    ? pct > 70 ? '#00FFA3' : pct > 40 ? '#FFD166' : '#FF4162'
    : pct < 30 ? '#00FFA3' : pct < 60 ? '#FFD166' : '#FF4162';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-pyth-text-dim">{label}</span>
        <span className="font-mono text-[10px] font-semibold" style={{ color }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
