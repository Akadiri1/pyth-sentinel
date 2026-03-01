// ── Entropy Simulations Panel ──
// Powered by real Pyth Entropy (Fortuna) random seeds
import { Dice5, Play, CheckCircle2, Loader2, AlertCircle, Zap, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import type { EntropySimulation } from '../types';
import type { LiveEntropySeed, EntropyConnectionStatus } from '../services/pythEntropyService';

interface EntropyPanelProps {
  simulations: EntropySimulation[];
  entropyStatus: EntropyConnectionStatus;
  latestSeed: LiveEntropySeed | null;
}

const statusConfig = {
  pending: { icon: Dice5, color: 'text-pyth-text-muted', bg: 'bg-pyth-text-muted/10', label: 'Pending' },
  running: { icon: Loader2, color: 'text-pyth-purple', bg: 'bg-pyth-purple/10', label: 'Running' },
  complete: { icon: CheckCircle2, color: 'text-pyth-green', bg: 'bg-pyth-green/10', label: 'Complete' },
};

const connectionColors: Record<EntropyConnectionStatus, string> = {
  connecting: 'text-pyth-cyan',
  live: 'text-pyth-green',
  fallback: 'text-yellow-400',
  error: 'text-pyth-red',
};

const connectionLabels: Record<EntropyConnectionStatus, string> = {
  connecting: 'CONNECTING...',
  live: 'FORTUNA LIVE',
  fallback: 'LOCAL FALLBACK',
  error: 'ERROR',
};

import { memo } from 'react';

export default memo(function EntropyPanel({ simulations, entropyStatus, latestSeed }: EntropyPanelProps) {
  return (
    <div className="glass-card p-4">
      {/* Header with live Fortuna status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Dice5 className="w-4 h-4 text-pyth-purple" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Entropy Stress Tests
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Radio className={`w-3 h-3 ${connectionColors[entropyStatus]} ${entropyStatus === 'live' ? 'animate-pulse' : ''}`} />
            <span className={`font-mono text-[9px] font-bold ${connectionColors[entropyStatus]}`}>
              {connectionLabels[entropyStatus]}
            </span>
          </div>
        </div>
      </div>

      {/* Fortuna seed provenance banner */}
      {latestSeed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-3 px-2.5 py-1.5 rounded-md bg-pyth-purple/5 border border-pyth-purple/20"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <Zap className="w-3 h-3 text-pyth-purple" />
            <span className="font-mono text-[9px] text-pyth-purple font-bold uppercase tracking-wider">
              {latestSeed.isLive ? 'Live Pyth Entropy Seed' : 'Local Entropy Seed'}
            </span>
          </div>
          <div className="font-mono text-[10px] text-pyth-text-dim leading-relaxed">
            <span className="text-pyth-text">{latestSeed.seedShort}</span>
            {latestSeed.isLive && (
              <>
                {' · '}
                <span className="text-pyth-text-muted">
                  {latestSeed.chain} #{latestSeed.sequence}
                </span>
                {latestSeed.txHash && (
                  <>
                    {' · '}
                    <span className="text-pyth-text-muted" title={latestSeed.txHash}>
                      tx:{latestSeed.txHash.slice(0, 8)}...
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}

      <div className="space-y-2">
        {simulations.map((sim, i) => {
          const config = statusConfig[sim.status];
          const StatusIcon = config.icon;
          const isNegative = sim.impact < 0;

          return (
            <motion.div
              key={sim.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="px-3 py-2.5 rounded-lg bg-white/[0.02] border border-pyth-border hover:border-pyth-border-hover transition-all"
            >
              <div className="flex items-start gap-2">
                <StatusIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.color} ${
                  sim.status === 'running' ? 'animate-spin' : ''
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[11px] text-pyth-text font-medium leading-tight">
                    {sim.scenario}
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-1.5">
                    <span className="font-mono text-[9px] text-pyth-text-muted">
                      P: {(sim.probability * 100).toFixed(1)}%
                    </span>
                    <span className={`font-mono text-[9px] font-bold ${isNegative ? 'text-pyth-red' : 'text-pyth-green'}`}>
                      {isNegative ? '' : '+'}${sim.impact.toLocaleString()}
                    </span>
                    <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    {sim.entropyIsLive && (
                      <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-full bg-pyth-purple/10 text-pyth-purple" title={`Seed: ${sim.entropySeed}`}>
                        ⚡ {sim.entropySeedShort}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[9px] text-pyth-text-muted mt-1 leading-relaxed">
                    → {sim.recommendedAction}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});
