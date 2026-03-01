// ── Emergency Action Buttons + Guardian Shield ──
import { useState } from 'react';
import { ShieldOff, Shuffle, Lock, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InfoTooltip from './InfoTooltip';

interface ActionButtonsProps {
  onShelter: () => void;
  onEntropyExit: () => void;
  onGuardianShield?: () => void;
  isCritical?: boolean;
  criticalAsset?: string;
  criticalPrice?: number;
}

import { memo } from 'react';

export default memo(function ActionButtons({ onShelter, onEntropyExit, onGuardianShield, isCritical, criticalAsset, criticalPrice }: ActionButtonsProps) {
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
    <div className="glass-card p-3 sm:p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-3.5 h-3.5 text-pyth-red" />
        <h2 className="font-mono text-[10px] sm:text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
          Emergency Controls
        </h2>
        <InfoTooltip
          title="Emergency Actions"
          content="Manual Shelter closes all positions instantly. Entropy Exit uses Pyth Entropy (Fortuna) to randomize exit timing — preventing MEV bots from front-running your trades. Guardian Shield activates automatically when health factor drops below 1.0 to defend against liquidation."
        />
      </div>

      <div className="flex-1 flex flex-col space-y-2">
        {/* Critical Agent Override Box */}
        <AnimatePresence>
          {isCritical && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-2.5 py-2 rounded-lg bg-pyth-red/10 border border-pyth-red/40 space-y-1"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-pyth-red animate-pulse" />
                <span className="font-mono text-[9px] font-bold text-pyth-red tracking-wider">
                  AGENT ACTION OVERRIDE
                </span>
              </div>
              <p className="font-mono text-[10px] text-pyth-red/90 leading-snug">
                [CRITICAL] Liquidation imminent at ${criticalPrice?.toFixed(2) ?? '80.90'}.
                Sentinel-1 calculating exit strategy...
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
                className="w-full px-3 py-3 rounded-xl font-mono text-sm font-black tracking-widest
                  bg-gradient-to-r from-pyth-red/30 via-pyth-red/20 to-pyth-red/30
                  border-2 border-pyth-red/50 hover:border-pyth-red
                  text-white
                  transition-all duration-300
                  guardian-glow
                  disabled:opacity-60 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
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

            </motion.div>
          )}
        </AnimatePresence>

        {/* Spacer to push buttons down */}
        <div className="flex-1" />

        {/* Manual Shelter */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleShelter}
          disabled={shelterLoading}
          className="w-full px-3 py-3 rounded-xl font-mono text-xs font-bold tracking-wider
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

        {/* Entropy Exit */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleEntropy}
          disabled={entropyLoading}
          className="w-full px-3 py-3 rounded-xl font-mono text-xs font-bold tracking-wider
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
      </div>
    </div>
  );
});
