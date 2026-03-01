// ── Airdrop Guard Panel ──
// Visual dashboard for airdrop security: token scanning, delegation monitoring,
// one-click revocation, and transaction approval notifications.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  AlertTriangle, CheckCircle2, RefreshCw,
  Wallet, Lock, Unlock, Trash2, Eye, EyeOff,
  ExternalLink, Bell, BellOff, Zap, Search,
  ChevronDown, ChevronUp, XCircle, Info,
} from 'lucide-react';
import type {
  AirdropGuardState,
  TokenAccountInfo,
  AirdropAlert,
  AirdropRisk,
} from '../services/airdropGuardService';
import {
  airdropRiskColor,
  airdropRiskLabel,
  shortenAirdropAddress,
} from '../services/airdropGuardService';

interface AirdropGuardPanelProps {
  guard: AirdropGuardState;
  isConnected: boolean;
  walletAddress?: string;
  onRescan: () => void;
  onRevokeDelegation: (tokenAccount: string) => void;
  onRevokeAll: () => void;
}

import { memo } from 'react';

export default memo(function AirdropGuardPanel({
  guard,
  isConnected,
  walletAddress,
  onRescan,
  onRevokeDelegation,
  onRevokeAll,
}: AirdropGuardPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tokens' | 'alerts'>('overview');
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [showSafeTokens, setShowSafeTokens] = useState(false);

  const dangerousAlerts = guard.alerts.filter(a => a.severity === 'dangerous');
  const suspiciousAlerts = guard.alerts.filter(a => a.severity === 'suspicious');
  const delegatedAccounts = guard.tokenAccounts.filter(a => a.delegate !== null);
  const riskyTokens = guard.tokenAccounts.filter(a => a.riskLevel !== 'safe');
  const safeTokens = guard.tokenAccounts.filter(a => a.riskLevel === 'safe');
  const displayTokens = showSafeTokens ? guard.tokenAccounts : riskyTokens;

  const riskColor = airdropRiskColor(
    guard.riskScore >= 80 ? 'safe' :
    guard.riskScore >= 60 ? 'caution' :
    guard.riskScore >= 35 ? 'suspicious' : 'dangerous'
  );

  const ShieldIcon = guard.riskScore >= 80 ? ShieldCheck
    : guard.riskScore >= 35 ? ShieldAlert
    : ShieldX;

  // Not connected state
  if (!isConnected) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-pyth-green" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Airdrop Guard
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Lock className="w-10 h-10 text-pyth-text-muted/30 mb-3" />
          <p className="font-mono text-sm text-pyth-text-muted mb-1">
            Wallet Not Connected
          </p>
          <p className="font-mono text-[10px] text-pyth-text-muted/60 max-w-xs">
            Connect your Solana wallet to enable Airdrop Guard protection.
            We'll scan your token accounts for malicious delegations, scam tokens,
            and dangerous approvals that could drain your wallet.
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
            Airdrop Guard
          </h2>
          {guard.isScanning && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-3 h-3 text-pyth-green" />
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dangerousAlerts.length > 0 && (
            <span className="relative flex items-center gap-1 px-2 py-0.5 rounded-full
              font-mono text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              <AlertTriangle className="w-3 h-3" />
              {dangerousAlerts.length} DANGER
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
            </span>
          )}
          {delegatedAccounts.length > 0 && (
            <button
              onClick={onRevokeAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px]
                bg-red-500/10 border border-red-500/30 text-red-400
                hover:bg-red-500/20 transition-all"
            >
              <Unlock className="w-3 h-3" />
              Revoke All ({delegatedAccounts.length})
            </button>
          )}
          <button
            onClick={onRescan}
            disabled={guard.isScanning}
            className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px]
              bg-pyth-bg-secondary border border-pyth-border text-pyth-text-muted
              hover:text-pyth-green hover:border-pyth-green/30 transition-all
              disabled:opacity-50"
          >
            <Search className="w-3 h-3" />
            Scan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-pyth-border pb-2">
        {(['overview', 'tokens', 'alerts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-t-lg font-mono text-[10px] uppercase tracking-wider transition-all
              ${activeTab === tab
                ? 'bg-pyth-green/10 text-pyth-green border-b-2 border-pyth-green font-bold'
                : 'text-pyth-text-muted hover:text-pyth-text-dim'
              }`}
          >
            {tab}
            {tab === 'alerts' && guard.alerts.length > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[8px]">
                {guard.alerts.length}
              </span>
            )}
            {tab === 'tokens' && riskyTokens.length > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[8px]">
                {riskyTokens.length}
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Risk Score */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={riskColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${guard.riskScore * 2.64} 264`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-lg font-bold" style={{ color: riskColor }}>
                    {guard.riskScore}
                  </span>
                  <span className="font-mono text-[8px] text-pyth-text-muted">SCORE</span>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-2">
                <MetricCard
                  icon={<Eye className="w-3 h-3" />}
                  label="Token Accounts"
                  value={guard.tokenAccounts.length.toString()}
                  color="text-pyth-purple"
                />
                <MetricCard
                  icon={<Unlock className="w-3 h-3" />}
                  label="Active Delegations"
                  value={guard.totalDelegations.toString()}
                  color={guard.totalDelegations > 0 ? 'text-red-400' : 'text-pyth-green'}
                />
                <MetricCard
                  icon={<AlertTriangle className="w-3 h-3" />}
                  label="Suspicious Tokens"
                  value={guard.suspiciousTokenCount.toString()}
                  color={guard.suspiciousTokenCount > 0 ? 'text-yellow-400' : 'text-pyth-green'}
                />
                <MetricCard
                  icon={<Shield className="w-3 h-3" />}
                  label="Risk Level"
                  value={airdropRiskLabel(
                    guard.riskScore >= 80 ? 'safe' :
                    guard.riskScore >= 60 ? 'caution' :
                    guard.riskScore >= 35 ? 'suspicious' : 'dangerous'
                  )}
                  color={`text-[${riskColor}]`}
                  style={{ color: riskColor }}
                />
              </div>
            </div>

            {/* Quick Actions */}
            {delegatedAccounts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-xl bg-red-500/5 border border-red-500/20"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-mono text-xs text-red-400 font-bold mb-1">
                      ⚠️ {delegatedAccounts.length} Active Delegation{delegatedAccounts.length > 1 ? 's' : ''} Found
                    </p>
                    <p className="font-mono text-[10px] text-pyth-text-muted mb-2">
                      Third parties can transfer tokens from these accounts without your approval.
                      This is the primary mechanism used in airdrop drain attacks.
                    </p>
                    <button
                      onClick={onRevokeAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold
                        bg-red-500/20 border border-red-500/40 text-red-300
                        hover:bg-red-500/30 hover:border-red-500/60 transition-all"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Revoke All Delegations — Protect Your Wallet
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {delegatedAccounts.length === 0 && guard.suspiciousTokenCount === 0 && guard.tokenAccounts.length > 0 && (
              <div className="p-3 rounded-xl bg-pyth-green/5 border border-pyth-green/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-pyth-green" />
                  <div>
                    <p className="font-mono text-xs text-pyth-green font-bold">All Clear</p>
                    <p className="font-mono text-[10px] text-pyth-text-muted">
                      No dangerous delegations or suspicious tokens detected. Your wallet is safe.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* How It Works */}
            <div className="p-3 rounded-xl bg-pyth-bg-secondary/50 border border-pyth-border">
              <p className="font-mono text-[10px] text-pyth-text-dim font-bold mb-2 flex items-center gap-1">
                <Info className="w-3 h-3" /> HOW AIRDROP GUARD PROTECTS YOU
              </p>
              <div className="space-y-1.5">
                {[
                  '🔍 Scans all SPL token accounts for hidden delegations',
                  '🚫 Flags known scam tokens from community databases',
                  '🔓 Detects unauthorized third-party approvals',
                  '⚡ One-click revoke to remove dangerous delegations',
                  '🔔 Real-time browser notifications for new threats',
                  '🔄 Auto-scans every 60 seconds while connected',
                ].map((text, i) => (
                  <p key={i} className="font-mono text-[9px] text-pyth-text-muted">{text}</p>
                ))}
              </div>
            </div>

            {/* Last Scan */}
            {guard.lastScanTime > 0 && (
              <p className="font-mono text-[9px] text-pyth-text-muted/50 text-right">
                Last scan: {new Date(guard.lastScanTime).toLocaleTimeString()}
              </p>
            )}
          </motion.div>
        )}

        {activeTab === 'tokens' && (
          <motion.div
            key="tokens"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {/* Toggle safe tokens */}
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[10px] text-pyth-text-muted">
                {riskyTokens.length > 0
                  ? `${riskyTokens.length} token${riskyTokens.length > 1 ? 's' : ''} need attention`
                  : 'All tokens look safe'}
              </p>
              <button
                onClick={() => setShowSafeTokens(!showSafeTokens)}
                className="flex items-center gap-1 font-mono text-[9px] text-pyth-text-muted
                  hover:text-pyth-text-dim transition-colors"
              >
                {showSafeTokens ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showSafeTokens ? 'Hide safe' : `Show all (${safeTokens.length} safe)`}
              </button>
            </div>

            {displayTokens.length === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-pyth-green/30 mx-auto mb-2" />
                <p className="font-mono text-xs text-pyth-text-muted">No risky tokens found</p>
              </div>
            )}

            {displayTokens.map(token => (
              <TokenCard
                key={token.address}
                token={token}
                isExpanded={expandedToken === token.address}
                onToggle={() => setExpandedToken(expandedToken === token.address ? null : token.address)}
                onRevoke={() => onRevokeDelegation(token.address)}
              />
            ))}
          </motion.div>
        )}

        {activeTab === 'alerts' && (
          <motion.div
            key="alerts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {guard.alerts.length === 0 && (
              <div className="text-center py-6">
                <ShieldCheck className="w-8 h-8 text-pyth-green/30 mx-auto mb-2" />
                <p className="font-mono text-xs text-pyth-text-muted">No alerts — your wallet looks safe</p>
              </div>
            )}

            {guard.alerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} onAction={() => {
                if (alert.tokenAccount) {
                  onRevokeDelegation(alert.tokenAccount);
                } else {
                  onRevokeAll();
                }
              }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Sub-Components ──

function MetricCard({
  icon,
  label,
  value,
  color,
  style,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="p-2 rounded-lg bg-pyth-bg-secondary/50 border border-pyth-border">
      <div className={`flex items-center gap-1 mb-0.5 ${color}`} style={style}>
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-mono text-sm font-bold text-pyth-text" style={style}>{value}</p>
    </div>
  );
}

function TokenCard({
  token,
  isExpanded,
  onToggle,
  onRevoke,
}: {
  token: TokenAccountInfo;
  isExpanded: boolean;
  onToggle: () => void;
  onRevoke: () => void;
}) {
  const riskColor = airdropRiskColor(token.riskLevel);
  const borderClass = token.riskLevel === 'dangerous'
    ? 'border-red-500/30 bg-red-500/5'
    : token.riskLevel === 'suspicious'
    ? 'border-yellow-500/30 bg-yellow-500/5'
    : token.riskLevel === 'caution'
    ? 'border-orange-500/20 bg-orange-500/5'
    : 'border-pyth-border bg-pyth-bg-secondary/30';

  return (
    <div className={`rounded-xl border ${borderClass} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: riskColor }}
          />
          <div className="text-left">
            <p className="font-mono text-xs text-pyth-text">
              {shortenAirdropAddress(token.mint)}
            </p>
            <p className="font-mono text-[9px] text-pyth-text-muted">
              Balance: {token.balance.toLocaleString()} · {airdropRiskLabel(token.riskLevel)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {token.delegate && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full
              bg-red-500/20 text-red-400 font-mono text-[8px] font-bold">
              <Unlock className="w-2.5 h-2.5" />
              DELEGATED
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-3 h-3 text-pyth-text-muted" /> : <ChevronDown className="w-3 h-3 text-pyth-text-muted" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-pyth-border/50"
          >
            <div className="p-3 space-y-2">
              {/* Details */}
              <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                <div>
                  <span className="text-pyth-text-muted">Mint:</span>{' '}
                  <a
                    href={`https://solscan.io/token/${token.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pyth-purple hover:underline inline-flex items-center gap-0.5"
                  >
                    {shortenAirdropAddress(token.mint)}
                    <ExternalLink className="w-2 h-2" />
                  </a>
                </div>
                <div>
                  <span className="text-pyth-text-muted">Account:</span>{' '}
                  <span className="text-pyth-text">{shortenAirdropAddress(token.address)}</span>
                </div>
                <div>
                  <span className="text-pyth-text-muted">Decimals:</span>{' '}
                  <span className="text-pyth-text">{token.decimals}</span>
                </div>
                <div>
                  <span className="text-pyth-text-muted">Balance:</span>{' '}
                  <span className="text-pyth-text">{token.balance.toLocaleString()}</span>
                </div>
              </div>

              {/* Delegate info */}
              {token.delegate && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="font-mono text-[9px] text-red-400 font-bold mb-1">
                    ⚠️ Active Delegation
                  </p>
                  <p className="font-mono text-[9px] text-pyth-text-muted mb-0.5">
                    Delegate: {shortenAirdropAddress(token.delegate)}
                  </p>
                  <p className="font-mono text-[9px] text-pyth-text-muted mb-2">
                    Delegated Amount: {token.delegatedAmount.toLocaleString()} tokens
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRevoke(); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px] font-bold
                      bg-red-500/20 border border-red-500/40 text-red-300
                      hover:bg-red-500/30 transition-all"
                  >
                    <Lock className="w-3 h-3" />
                    Revoke This Delegation
                  </button>
                </div>
              )}

              {/* Risk reasons */}
              {token.riskReasons.length > 0 && (
                <div className="space-y-1">
                  <p className="font-mono text-[9px] text-pyth-text-dim font-bold">Risk Factors:</p>
                  {token.riskReasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-2.5 h-2.5 mt-0.5 shrink-0" style={{ color: riskColor }} />
                      <p className="font-mono text-[9px] text-pyth-text-muted">{reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {token.riskReasons.length === 0 && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-pyth-green" />
                  <p className="font-mono text-[9px] text-pyth-green">No risk factors detected</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AlertRow({
  alert,
  onAction,
}: {
  alert: AirdropAlert;
  onAction: () => void;
}) {
  const severityConfig = {
    dangerous: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: ShieldX },
    suspicious: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: AlertTriangle },
    caution: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', icon: Info },
    safe: { bg: 'bg-pyth-green/10', border: 'border-pyth-green/20', text: 'text-pyth-green', icon: CheckCircle2 },
  };

  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div className={`p-3 rounded-xl ${config.bg} border ${config.border}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 ${config.text} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className={`font-mono text-[11px] font-bold ${config.text}`}>
              {alert.title}
            </p>
            <span className="font-mono text-[8px] text-pyth-text-muted/50">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="font-mono text-[9px] text-pyth-text-muted leading-relaxed mb-2">
            {alert.description}
          </p>
          {alert.actionRequired && (
            <button
              onClick={onAction}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px] font-bold
                ${config.bg} border ${config.border} ${config.text}
                hover:brightness-125 transition-all`}
            >
              <Zap className="w-3 h-3" />
              {alert.actionLabel ?? 'Take Action'}
            </button>
          )}
          {alert.tokenMint && (
            <a
              href={`https://solscan.io/token/${alert.tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[9px] text-pyth-purple hover:underline mt-1"
            >
              View on Solscan <ExternalLink className="w-2 h-2" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
