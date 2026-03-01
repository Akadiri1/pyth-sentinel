// ── Price Ticker Component ──
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { PriceFeed } from '../types';
import { formatPrice, formatCompact } from '../hooks';

interface PriceTickerProps {
  feeds: PriceFeed[];
  updatedId: string | null;
  isLive?: boolean;
}

const categoryIcons: Record<string, string> = {
  crypto: '₿',
  equity: '📈',
  futures: '📊',
  rates: '%',
};

const categoryColors: Record<string, string> = {
  crypto: 'text-pyth-purple',
  equity: 'text-pyth-cyan',
  futures: 'text-pyth-yellow',
  rates: 'text-pyth-lavender',
};

import { memo } from 'react';

export default memo(function PriceTicker({ feeds, updatedId, isLive = false }: PriceTickerProps) {
  return (
    <div className="glass-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isLive ? 'bg-pyth-green' : 'bg-pyth-yellow'} animate-pulse`} />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            {isLive ? 'Pyth Hermes — Live' : 'Pyth Pro Feeds'}
          </h2>
        </div>
        <span className="font-mono text-[10px] text-pyth-text-muted">
          {feeds.length} feeds · {isLive ? 'hermes.pyth.network' : 'mock data'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {feeds.map(feed => (
          <PriceCard key={feed.id} feed={feed} isUpdating={feed.id === updatedId} />
        ))}
      </div>
    </div>
  );
});

function PriceCard({ feed, isUpdating }: { feed: PriceFeed; isUpdating: boolean }) {
  const isPositive = feed.changePercent24h >= 0;
  const isNeutral = Math.abs(feed.changePercent24h) < 0.01;
  const sparkData = feed.sparkline.map((v, i) => ({ v, i }));

  return (
    <motion.div
      className={`relative rounded-lg p-3 bg-pyth-surface/60 border transition-all duration-300 ${
        isUpdating
          ? 'border-pyth-purple/50 shadow-[0_0_15px_rgba(171,135,255,0.15)]'
          : 'border-pyth-border hover:border-pyth-border-hover'
      }`}
      animate={isUpdating ? { scale: [1, 1.01, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs ${categoryColors[feed.category]}`}>
            {categoryIcons[feed.category]}
          </span>
          <span className="font-mono text-xs font-bold text-pyth-text">
            {feed.symbol}
          </span>
        </div>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
          feed.category === 'crypto'
            ? 'bg-pyth-purple/15 text-pyth-purple'
            : feed.category === 'equity'
            ? 'bg-pyth-cyan/15 text-pyth-cyan'
            : feed.category === 'futures'
            ? 'bg-pyth-yellow/15 text-pyth-yellow'
            : 'bg-pyth-lavender/15 text-pyth-lavender'
        }`}>
          {feed.category}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`font-mono text-lg font-bold ${isUpdating ? 'price-pulse' : ''} text-pyth-text`}>
          ${formatPrice(feed.price)}
        </span>
      </div>

      {/* Change */}
      <div className="flex items-center gap-1 mb-2">
        {isNeutral ? (
          <Minus className="w-3 h-3 text-pyth-text-muted" />
        ) : isPositive ? (
          <TrendingUp className="w-3 h-3 text-pyth-green" />
        ) : (
          <TrendingDown className="w-3 h-3 text-pyth-red" />
        )}
        <span className={`font-mono text-xs font-medium ${
          isNeutral ? 'text-pyth-text-muted' : isPositive ? 'text-pyth-green' : 'text-pyth-red'
        }`}>
          {isPositive ? '+' : ''}{feed.changePercent24h.toFixed(2)}%
        </span>
        {feed.volume24h > 0 && (
          <span className="font-mono text-[9px] text-pyth-text-muted ml-auto">
            Vol {formatCompact(feed.volume24h)}
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-8 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`grad-${feed.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#00FFA3' : '#FF4162'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isPositive ? '#00FFA3' : '#FF4162'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={isPositive ? '#00FFA3' : '#FF4162'}
              strokeWidth={1.5}
              fill={`url(#grad-${feed.id})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Confidence */}
      <div className="flex items-center justify-between mt-1">
        <span className="font-mono text-[9px] text-pyth-text-muted">
          ±${feed.confidence < 1 ? feed.confidence.toFixed(4) : feed.confidence.toFixed(2)}
        </span>
        <span className="font-mono text-[9px] text-pyth-text-muted">
          {new Date(feed.publishTime).toLocaleTimeString('en-US', { hour12: false })}
        </span>
      </div>
    </motion.div>
  );
}
