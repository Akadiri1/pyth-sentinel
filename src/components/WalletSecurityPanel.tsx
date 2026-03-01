// ── Wallet Security Panel ──
// Real-time wallet security monitoring dashboard with transaction analysis,
// threat scoring, and proactive security alerts.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  Eye, RefreshCw, AlertTriangle, CheckCircle2,
  ExternalLink, ArrowUpRight, ArrowDownLeft,
  Fingerprint, Scan, X, ChevronDown, ChevronUp,
  Wallet, Bell, BellOff,
} from 'lucide-react';
import type { WalletSecurityState, SecurityAlert, TransactionAnalysis } from '../services/walletSecurityService';
import { shortenAddress, threatLevelColor, threatLevelLabel } from '../services/walletSecurityService';

interface WalletSecurityPanelProps {
  security: WalletSecurityState;
  analyses: TransactionAnalysis[];
  isConnected: boolean;
  walletAddress?: string;
  onDismissAlert: (id: string) => void;
  onDismissAll: () => void;
  onRescan: () => void;
}

import { memo } from 'react';

export default memo(function WalletSecurityPanel({
  security,
  analyses,
  isConnected,
  walletAddress,
  onDismissAlert,
  onDismissAll,
  onRescan,
}: WalletSecurityPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'transactions'>('overview');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const activeAlerts = security.alerts.filter(a => !a.dismissed);
  const dismissedAlerts = security.alerts.filter(a => a.dismissed);
  const displayAlerts = showDismissed ? security.alerts : activeAlerts;

  const ShieldIcon = security.overallRisk === 'safe' ? ShieldCheck
    : security.overallRisk === 'critical' ? ShieldX
    : ShieldAlert;

  const riskColor = threatLevelColor(security.overallRisk);

  if (!isConnected) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-pyth-purple" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Wallet Security Monitor
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Wallet className="w-10 h-10 text-pyth-text-muted/30 mb-3" />
          <p className="font-mono text-sm text-pyth-text-muted mb-1">
            No Wallet Connected
          </p>
          <p className="font-mono text-[10px] text-pyth-text-muted/60 max-w-xs">
            Connect your Solana wallet to enable real-time security monitoring,
            transaction analysis, and threat detection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldIcon className="w-4 h-4" style={{ color: riskColor }} />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Wallet Security Monitor
          </h2>
          {security.isScanning && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-3 h-3 text-pyth-purple" />
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeAlerts.length > 0 && (
            <span className="relative flex items-center gap-1 px-2 py-0.5 rounded-full
              font-mono text-[10px] font-bold"
              style={{ backgroundColor: `${riskColor}20`, color: riskColor }}
            >
              <Bell className="w-3 h-3" />
              {activeAlerts.length}
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping"
                style={{ backgroundColor: riskColor }}
              />
            </span>
          )}
          <button
            onClick={onRescan}
            disabled={security.isScanning}
            className="font-mono text-[10px] px-2 py-1 rounded-md
              bg-pyth-purple/10 border border-pyth-purple/20
              text-pyth-purple hover:bg-pyth-purple/20
              disabled:opacity-40 disabled:cursor-wait
              transition-all flex items-center gap-1"
          >
            <Scan className="w-3 h-3" />
            Scan
          </button>
        </div>
      </div>

      {/* Security Score + Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Score */}
        <div className="col-span-2 sm:col-span-1 flex flex-col items-center p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase mb-1">Security Score</div>
          <div className="text-2xl font-mono font-bold" style={{ color: riskColor }}>
            {security.securityScore}
          </div>
          <div className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold mt-1"
            style={{ backgroundColor: `${riskColor}15`, color: riskColor }}
          >
            {threatLevelLabel(security.overallRisk)}
          </div>
        </div>

        {/* Outflow 24h */}
        <div className="flex flex-col p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase mb-1">Outflow 24h</div>
          <div className="flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-pyth-red" />
            <span className="font-mono text-sm font-semibold text-pyth-text">
              {security.totalOutflow24h.toFixed(3)}
            </span>
          </div>
          <span className="font-mono text-[9px] text-pyth-text-muted">SOL</span>
        </div>

        {/* Inflow 24h */}
        <div className="flex flex-col p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase mb-1">Inflow 24h</div>
          <div className="flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3 text-pyth-green" />
            <span className="font-mono text-sm font-semibold text-pyth-text">
              {security.totalInflow24h.toFixed(3)}
            </span>
          </div>
          <span className="font-mono text-[9px] text-pyth-text-muted">SOL</span>
        </div>

        {/* Interactions */}
        <div className="flex flex-col p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="text-[9px] font-mono text-pyth-text-muted uppercase mb-1">Interactions</div>
          <div className="flex items-center gap-1">
            <Fingerprint className="w-3 h-3 text-pyth-purple" />
            <span className="font-mono text-sm font-semibold text-pyth-text">
              {security.uniqueInteractions}
            </span>
          </div>
          <span className="font-mono text-[9px] text-pyth-text-muted">unique addresses</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-pyth-border">
        {(['overview', 'alerts', 'transactions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 font-mono text-[10px] uppercase tracking-wider border-b-2 transition-all ${
              activeTab === tab
                ? 'border-pyth-purple text-pyth-purple'
                : 'border-transparent text-pyth-text-muted hover:text-pyth-text-dim'
            }`}
          >
            {tab}
            {tab === 'alerts' && activeAlerts.length > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded-full text-[8px] bg-pyth-red/20 text-pyth-red">
                {activeAlerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Security Summary Bars */}
            <SecurityBar label="Transaction Safety" value={Math.max(0, 100 - activeAlerts.filter(a => a.type === 'large_outflow' || a.type === 'rapid_drains').length * 25)} />
            <SecurityBar label="Program Trust" value={Math.max(0, 100 - activeAlerts.filter(a => a.type === 'unknown_program').length * 20)} />
            <SecurityBar label="Address Reputation" value={Math.max(0, 100 - activeAlerts.filter(a => a.type === 'flagged_address').length * 40)} />
            <SecurityBar label="Dust Resistance" value={Math.max(0, 100 - security.dustTokenCount * 10)} inverted />

            {/* Last Scan */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="font-mono text-[9px] text-pyth-text-muted">
                Last scan: {security.lastScanTime > 0
                  ? new Date(security.lastScanTime).toLocaleTimeString()
                  : 'Never'}
              </span>
              <span className="font-mono text-[9px] text-pyth-text-muted">
                {security.recentTxCount} txs analyzed
              </span>
            </div>

            {/* Wallet Address */}
            {walletAddress && (
              <div className="flex items-center gap-2 pt-1">
                <Eye className="w-3 h-3 text-pyth-text-muted" />
                <span className="font-mono text-[10px] text-pyth-text-dim">
                  Monitoring: {shortenAddress(walletAddress)}
                </span>
                <a
                  href={`https://solscan.io/account/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pyth-purple hover:text-pyth-purple/80 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'alerts' && (
          <motion.div
            key="alerts"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-2"
          >
            {/* Controls */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                className="font-mono text-[9px] text-pyth-text-muted hover:text-pyth-text-dim transition-colors flex items-center gap-1"
              >
                {showDismissed ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                {showDismissed ? 'Hide dismissed' : `Show dismissed (${dismissedAlerts.length})`}
              </button>
              {activeAlerts.length > 0 && (
                <button
                  onClick={onDismissAll}
                  className="font-mono text-[9px] text-pyth-text-muted hover:text-pyth-red transition-colors"
                >
                  Dismiss all
                </button>
              )}
            </div>

            {/* Alert List */}
            <div className="max-h-[280px] overflow-y-auto scrollbar-thin space-y-2">
              {displayAlerts.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-pyth-green/40 mb-2" />
                  <p className="font-mono text-[11px] text-pyth-text-muted">
                    No security alerts
                  </p>
                  <p className="font-mono text-[9px] text-pyth-text-muted/60 mt-1">
                    Wallet appears secure. Monitoring continues...
                  </p>
                </div>
              ) : (
                displayAlerts.map(alert => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    isExpanded={expandedAlert === alert.id}
                    onToggle={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                    onDismiss={() => onDismissAlert(alert.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="max-h-[280px] overflow-y-auto scrollbar-thin space-y-1">
              {analyses.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Scan className="w-8 h-8 text-pyth-text-muted/30 mb-2" />
                  <p className="font-mono text-[11px] text-pyth-text-muted">
                    {security.isScanning ? 'Scanning transactions...' : 'No transactions found'}
                  </p>
                </div>
              ) : (
                analyses.slice(0, 30).map((tx, i) => (
                  <TransactionRow key={tx.signature || i} tx={tx} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Sub-components ──

function SecurityBar({ label, value, inverted = false }: { label: string; value: number; inverted?: boolean }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = inverted
    ? pct > 70 ? '#00FFA3' : pct > 40 ? '#FFD166' : '#FF4162'
    : pct > 70 ? '#00FFA3' : pct > 40 ? '#FFD166' : '#FF4162';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-pyth-text-dim">{label}</span>
        <span className="font-mono text-[10px] font-semibold" style={{ color }}>
          {pct.toFixed(0)}%
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

function AlertCard({
  alert,
  isExpanded,
  onToggle,
  onDismiss,
}: {
  alert: SecurityAlert;
  isExpanded: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  const color = threatLevelColor(alert.level);
  const timeStr = alert.timestamp > 0
    ? new Date(alert.timestamp).toLocaleString()
    : 'Unknown time';

  return (
    <motion.div
      layout
      className={`rounded-lg border p-3 transition-all ${
        alert.dismissed ? 'opacity-40 border-white/5' : ''
      }`}
      style={{
        borderColor: alert.dismissed ? undefined : `${color}30`,
        backgroundColor: alert.dismissed ? 'transparent' : `${color}05`,
      }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-[10px] font-bold" style={{ color }}>
              {alert.title}
            </span>
            <span className="px-1.5 py-0.5 rounded-full font-mono text-[8px]"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {alert.level.toUpperCase()}
            </span>
          </div>
          <p className="font-mono text-[10px] text-pyth-text-dim leading-relaxed">
            {isExpanded ? alert.description : alert.description.slice(0, 100) + (alert.description.length > 100 ? '...' : '')}
          </p>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-1"
              >
                <div className="font-mono text-[9px] text-pyth-text-muted">
                  {timeStr}
                </div>
                {alert.txSignature && (
                  <a
                    href={`https://solscan.io/tx/${alert.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[9px] text-pyth-purple hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    View on Solscan
                  </a>
                )}
                {alert.counterparty && (
                  <div className="font-mono text-[9px] text-pyth-text-muted">
                    Counterparty: {shortenAddress(alert.counterparty)}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggle} className="p-1 rounded hover:bg-white/5 transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-pyth-text-muted" />
            ) : (
              <ChevronDown className="w-3 h-3 text-pyth-text-muted" />
            )}
          </button>
          {!alert.dismissed && (
            <button onClick={onDismiss} className="p-1 rounded hover:bg-white/5 transition-colors">
              <X className="w-3 h-3 text-pyth-text-muted hover:text-pyth-red" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TransactionRow({ tx }: { tx: TransactionAnalysis }) {
  const isOutflow = tx.type === 'outflow';
  const isInflow = tx.type === 'inflow';
  const Icon = isOutflow ? ArrowUpRight : isInflow ? ArrowDownLeft : Fingerprint;
  const color = tx.isSuspicious ? '#FF4162' : isOutflow ? '#FF8C42' : isInflow ? '#00FFA3' : '#6E56CF';
  const timeStr = tx.timestamp > 0
    ? new Date(tx.timestamp * 1000).toLocaleTimeString()
    : '—';

  return (
    <div className={`flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors ${
      tx.isSuspicious ? 'border border-pyth-red/20 bg-pyth-red/[0.02]' : ''
    }`}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-pyth-text-dim capitalize">{tx.type}</span>
          {tx.isSuspicious && (
            <span className="px-1 py-0.5 rounded font-mono text-[7px] bg-pyth-red/15 text-pyth-red font-bold">
              SUSPICIOUS
            </span>
          )}
        </div>
        {tx.counterparty && (
          <span className="font-mono text-[9px] text-pyth-text-muted truncate block">
            {shortenAddress(tx.counterparty)}
          </span>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-[10px] font-semibold" style={{ color }}>
          {isOutflow ? '-' : isInflow ? '+' : ''}{tx.amount.toFixed(4)} SOL
        </div>
        <div className="font-mono text-[8px] text-pyth-text-muted">{timeStr}</div>
      </div>
      <a
        href={`https://solscan.io/tx/${tx.signature}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 p-1 text-pyth-text-muted hover:text-pyth-purple transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
