// ── Positions Panel ──
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Position } from '../types';
import { formatPrice } from '../hooks';

interface PositionsPanelProps {
  positions: Position[];
  isSheltered?: boolean;
}

import { memo } from 'react';

export default memo(function PositionsPanel({ positions, isSheltered }: PositionsPanelProps) {
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.size * p.currentPrice, 0);

  return (
    <div className="glass-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-pyth-purple shrink-0" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Active Positions
          </h2>
          {isSheltered && (
            <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-pyth-yellow/15 text-pyth-yellow font-bold animate-pulse">
              SHELTERED
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="font-mono text-[10px] text-pyth-text-muted">Total Value </span>
          <span className="font-mono text-xs text-pyth-text font-bold">
            ${formatPrice(totalValue)}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-pyth-surface/60 border border-pyth-border">
        <span className="font-mono text-[10px] text-pyth-text-muted">Unrealized P&L</span>
        <span className={`font-mono text-sm font-bold ${totalPnl >= 0 ? 'text-pyth-green' : 'text-pyth-red'}`}>
          {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Position rows */}
      <div className="space-y-2">
        {positions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 py-8 text-center"
          >
            <p className="font-mono text-xs text-pyth-text-muted">
              {isSheltered
                ? '🛡️ All positions sheltered — withdrawing to USDC safety vault...'
                : 'No active positions — waiting for re-entry...'}
            </p>
            <div className="mt-2 flex justify-center">
              <div className="w-4 h-4 border-2 border-pyth-purple/40 border-t-pyth-purple rounded-full animate-spin" />
            </div>
          </motion.div>
        ) : (
          positions.map(pos => (
            <PositionRow key={pos.id} position={pos} />
          ))
        )}
      </div>
    </div>
  );
});

function PositionRow({ position }: { position: Position }) {
  const isProfit = position.pnl >= 0;
  const healthColor =
    position.healthFactor > 3 ? 'text-pyth-green' :
    position.healthFactor > 1.5 ? 'text-pyth-yellow' : 'text-pyth-red';

  return (
    <motion.div
      className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-pyth-border hover:border-pyth-border-hover transition-all"
      whileHover={{ x: 2 }}
    >
      {/* Side indicator */}
      <div className={`w-1 h-8 rounded-full shrink-0 ${position.side === 'long' ? 'bg-pyth-green' : 'bg-pyth-red'}`} />

      {/* Asset info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-pyth-text">{position.asset}</span>
          <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
            position.side === 'long' ? 'bg-pyth-green/15 text-pyth-green' : 'bg-pyth-red/15 text-pyth-red'
          }`}>
            {position.side.toUpperCase()} {position.leverage}x
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-pyth-text-muted">
            Size: {position.size}
          </span>
          <span className="font-mono text-[10px] text-pyth-text-muted">
            Entry: ${formatPrice(position.entryPrice)}
          </span>
        </div>
      </div>

      {/* P&L */}
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1 justify-end">
          {isProfit ? (
            <ArrowUpRight className="w-3 h-3 text-pyth-green" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-pyth-red" />
          )}
          <span className={`font-mono text-xs font-bold ${isProfit ? 'text-pyth-green' : 'text-pyth-red'}`}>
            {isProfit ? '+' : ''}${position.pnl.toFixed(2)}
          </span>
        </div>
        <span className={`font-mono text-[10px] ${isProfit ? 'text-pyth-green/70' : 'text-pyth-red/70'}`}>
          {isProfit ? '+' : ''}{position.pnlPercent.toFixed(2)}%
        </span>
      </div>

      {/* Health Factor */}
      <div className="hidden sm:block text-right pl-2 border-l border-pyth-border shrink-0">
        <span className="font-mono text-[9px] text-pyth-text-muted block">Health</span>
        <span className={`font-mono text-xs font-bold ${healthColor}`}>
          {position.healthFactor.toFixed(2)}
        </span>
      </div>
    </motion.div>
  );
}
