// ── Security Alert Modal ──
// Full-screen critical alert overlay when wallet compromise is detected.
// Pulses red, provides actionable steps, links to Solscan.

import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldX, X, ExternalLink, AlertTriangle,
  ArrowRight, Copy, Check,
} from 'lucide-react';
import { useState } from 'react';
import type { SecurityAlert } from '../services/walletSecurityService';
import { shortenAddress, threatLevelColor } from '../services/walletSecurityService';

interface SecurityAlertModalProps {
  alerts: SecurityAlert[];
  isOpen: boolean;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

import { memo } from 'react';

export default memo(function SecurityAlertModal({
  alerts,
  isOpen,
  onClose,
  onDismiss,
  onDismissAll,
}: SecurityAlertModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const criticals = alerts.filter(a => a.level === 'critical' && !a.dismissed);
  const warnings = alerts.filter(a => a.level === 'warning' && !a.dismissed);
  const activeAlerts = [...criticals, ...warnings];
  const hasCritical = criticals.length > 0;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && activeAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          {/* Backdrop with danger pulse */}
          <motion.div
            className="absolute inset-0 backdrop-blur-md"
            style={{ backgroundColor: hasCritical ? 'rgba(255,65,98,0.15)' : 'rgba(255,216,107,0.1)' }}
            animate={hasCritical ? {
              backgroundColor: ['rgba(255,65,98,0.12)', 'rgba(255,65,98,0.22)', 'rgba(255,65,98,0.12)'],
            } : {}}
            transition={hasCritical ? { duration: 2, repeat: Infinity } : {}}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="relative w-full max-w-lg bg-pyth-surface border rounded-2xl shadow-2xl overflow-hidden"
            style={{ borderColor: hasCritical ? 'rgba(255,65,98,0.4)' : 'rgba(255,216,107,0.3)' }}
          >
            {/* Danger gradient bar */}
            <div className="h-1" style={{
              background: hasCritical
                ? 'linear-gradient(90deg, #FF4162, #FF8C42, #FF4162)'
                : 'linear-gradient(90deg, #FFD166, #FF8C42, #FFD166)',
            }} />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={hasCritical ? { scale: [1, 1.15, 1] } : {}}
                  transition={hasCritical ? { duration: 1.5, repeat: Infinity } : {}}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: hasCritical ? 'rgba(255,65,98,0.2)' : 'rgba(255,216,107,0.15)' }}
                >
                  <ShieldX className="w-5 h-5" style={{ color: hasCritical ? '#FF4162' : '#FFD166' }} />
                </motion.div>
                <div>
                  <h2 className="text-sm font-black font-mono tracking-wider"
                    style={{ color: hasCritical ? '#FF4162' : '#FFD166' }}
                  >
                    {hasCritical ? '⚠️ SECURITY BREACH DETECTED' : '⚡ SECURITY ADVISORY'}
                  </h2>
                  <p className="text-[10px] text-pyth-text-muted font-mono">
                    {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''} • SENTINEL-1 Wallet Guard
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-pyth-bg transition-colors text-pyth-text-muted hover:text-pyth-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Alerts List */}
            <div className="px-5 pb-3 max-h-[280px] overflow-y-auto scrollbar-thin space-y-2">
              {activeAlerts.map(alert => {
                const color = threatLevelColor(alert.level);
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-xl border"
                    style={{
                      borderColor: `${color}25`,
                      backgroundColor: `${color}08`,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] font-bold" style={{ color }}>
                            {alert.title}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-pyth-text-dim leading-relaxed mb-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {alert.txSignature && (
                            <a
                              href={`https://solscan.io/tx/${alert.txSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[9px] text-pyth-purple hover:underline"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              View Tx
                            </a>
                          )}
                          {alert.counterparty && (
                            <button
                              onClick={() => handleCopy(alert.counterparty!, alert.id)}
                              className="inline-flex items-center gap-1 font-mono text-[9px] text-pyth-text-muted hover:text-pyth-text transition-colors"
                            >
                              {copiedId === alert.id ? (
                                <Check className="w-2.5 h-2.5 text-pyth-green" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                              {shortenAddress(alert.counterparty)}
                            </button>
                          )}
                          <button
                            onClick={() => onDismiss(alert.id)}
                            className="font-mono text-[9px] text-pyth-text-muted hover:text-pyth-text transition-colors ml-auto"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Recommended Actions */}
            {hasCritical && (
              <div className="px-5 py-3 border-t border-pyth-red/15 bg-pyth-red/[0.03]">
                <div className="font-mono text-[9px] text-pyth-red font-bold uppercase tracking-wider mb-2">
                  Immediate Actions Recommended
                </div>
                <div className="space-y-1.5">
                  {[
                    'Create a new wallet and transfer remaining funds immediately',
                    'Revoke all token approvals via Phantom or Solflare settings',
                    'Document suspicious transactions on Solscan for reporting',
                    'Enable hardware wallet (Ledger) for future transactions',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ArrowRight className="w-3 h-3 text-pyth-red/60 mt-0.5 shrink-0" />
                      <span className="font-mono text-[10px] text-pyth-text-dim">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 px-5 py-3 border-t border-pyth-border bg-pyth-bg/50">
              <button
                onClick={onDismissAll}
                className="flex-1 px-3 py-2 rounded-xl
                  bg-white/5 border border-white/10
                  text-pyth-text-muted hover:text-pyth-text hover:bg-white/10
                  transition-all font-mono text-[10px] font-semibold"
              >
                Dismiss All
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-3 py-2 rounded-xl font-mono text-[10px] font-semibold transition-all"
                style={{
                  backgroundColor: hasCritical ? 'rgba(255,65,98,0.15)' : 'rgba(255,216,107,0.15)',
                  borderWidth: 1,
                  borderColor: hasCritical ? 'rgba(255,65,98,0.3)' : 'rgba(255,216,107,0.3)',
                  color: hasCritical ? '#FF4162' : '#FFD166',
                }}
              >
                Acknowledge & Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
