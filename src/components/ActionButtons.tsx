// ── Emergency Action Buttons + Guardian Shield ──
import { useState } from 'react';
import { ShieldOff, Shuffle, Lock, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActionButtonsProps {
  onShelter: () => void;
  onEntropyExit: () => void;
  onGuardianShield?: () => void;
  isCritical?: boolean;
  criticalAsset?: string;
  criticalPrice?: number;
}

export default function ActionButtons({ onShelter, onEntropyExit, onGuardianShield, isCritical, criticalAsset, criticalPrice }: ActionButtonsProps) {
  const [shelterLoading, setShelterLoading] = useState(false);
  const [entropyLoading, setEntropyLoading] = useState(false);
  const [guardianLoading, setGuardianLoading] = useState(false);

  const handleShelter = () => {
    setShelterLoading(true);
    onShelter();
    setTimeout(() => setShelterLoading(false), 3000);
  };

  const handleEntropy = () => {
    setEntropyLoading(true);
    onEntropyExit();
    setTimeout(() => setEntropyLoading(false), 3000);
  };

  const handleGuardian = () => {
    setGuardianLoading(true);
    onGuardianShield?.();
    setTimeout(() => setGuardianLoading(false), 5000);
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lock className="w-4 h-4 text-pyth-red" />
        <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
          Emergency Controls
        </h2>
      </div>

      <div className="space-y-3">
        {/* Critical Agent Override Box */}
        <AnimatePresence>
          {isCritical && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 py-3 rounded-lg bg-pyth-red/10 border border-pyth-red/40 space-y-2"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-pyth-red animate-pulse" />
                <span className="font-mono text-[10px] font-bold text-pyth-red tracking-wider">
                  AGENT ACTION OVERRIDE
                </span>
              </div>
              <p className="font-mono text-[11px] text-pyth-red/90 leading-relaxed">
                [CRITICAL] Liquidation imminent at ${criticalPrice?.toFixed(2) ?? '80.90'}.
                Sentinel-1 is calculating Entropy-shielded exit strategy...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guardian Shield — only visible when critical */}
        <AnimatePresence>
          {isCritical && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleGuardian}
                disabled={guardianLoading}
                className="w-full px-4 py-5 rounded-xl font-mono text-base font-black tracking-widest
                  bg-gradient-to-r from-pyth-red/30 via-pyth-red/20 to-pyth-red/30
                  border-2 border-pyth-red/50 hover:border-pyth-red
                  text-white
                  transition-all duration-300
                  guardian-glow
                  disabled:opacity-60 disabled:cursor-not-allowed
                  flex items-center justify-center gap-3"
              >
                {guardianLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    SHIELDING...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    ACTIVATE GUARDIAN SHIELD
                  </>
                )}
              </motion.button>
              <p className="font-mono text-[9px] text-pyth-red/70 text-center mt-1">
                Emergency Pyth Entropy exit — lock collateral & stabilize health factor
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Shelter */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleShelter}
          disabled={shelterLoading}
          className="w-full px-4 py-3 rounded-xl font-mono text-sm font-bold tracking-wider
            bg-gradient-to-r from-pyth-red/20 to-pyth-red/10
            border border-pyth-red/30 hover:border-pyth-red/60
            text-pyth-red hover:text-white
            transition-all duration-300
            hover:shadow-[0_0_30px_rgba(255,65,98,0.2)]
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
            btn-glow"
        >
          {shelterLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              WITHDRAWING...
            </>
          ) : (
            <>
              <ShieldOff className="w-4 h-4" />
              MANUAL SHELTER
            </>
          )}
        </motion.button>
        <p className="font-mono text-[9px] text-pyth-text-muted text-center">
          Immediately withdraw all positions to USDC safety vault
        </p>

        {/* Entropy Exit */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleEntropy}
          disabled={entropyLoading}
          className="w-full px-4 py-3 rounded-xl font-mono text-sm font-bold tracking-wider
            bg-gradient-to-r from-pyth-purple/20 to-pyth-purple/10
            border border-pyth-purple/30 hover:border-pyth-purple/60
            text-pyth-purple hover:text-pyth-lavender
            transition-all duration-300
            hover:shadow-[0_0_30px_rgba(171,135,255,0.2)]
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
            btn-glow"
        >
          {entropyLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              RANDOMIZING EXIT...
            </>
          ) : (
            <>
              <Shuffle className="w-4 h-4" />
              ENTROPY-RANDOMIZED EXIT
            </>
          )}
        </motion.button>
        <p className="font-mono text-[9px] text-pyth-text-muted text-center">
          Exit via Pyth Entropy — randomized timing & tranches to prevent MEV
        </p>
      </div>
    </div>
  );
}
