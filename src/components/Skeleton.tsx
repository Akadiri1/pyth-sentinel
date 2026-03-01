// ── Loading Skeleton Component ──
import { motion } from 'framer-motion';

interface SkeletonProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div className={`glass-card p-4 space-y-3 animate-pulse ${className}`} role="status" aria-label="Loading">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-pyth-surface" />
        <div className="space-y-1 flex-1">
          <div className="h-3 bg-pyth-surface rounded w-1/3" />
          <div className="h-2 bg-pyth-surface/60 rounded w-1/2" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-2.5 bg-pyth-surface/50 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
      <span className="sr-only">Loading content...</span>
    </div>
  );
}

export function SkeletonPriceCards() {
  return (
    <div className="glass-card p-4" role="status" aria-label="Loading price feeds">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-pyth-surface animate-pulse" />
        <div className="h-3 bg-pyth-surface rounded w-40" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg p-3 bg-pyth-surface/40 border border-pyth-border animate-pulse"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 bg-pyth-surface rounded w-16" />
              <div className="h-3 bg-pyth-surface rounded w-10" />
            </div>
            <div className="h-5 bg-pyth-surface/60 rounded w-24 mb-1" />
            <div className="h-2 bg-pyth-surface/40 rounded w-16" />
          </motion.div>
        ))}
      </div>
      <span className="sr-only">Loading price data from Pyth Hermes...</span>
    </div>
  );
}
