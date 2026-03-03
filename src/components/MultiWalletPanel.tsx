// ── Multi-Wallet Comparison Panel ──
// Compare risk profiles across multiple Solana wallets side-by-side

import { useState, useCallback, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  Coins,
  ExternalLink,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import {
  scanTokenAccounts,
  computeAirdropRiskScore,
  airdropRiskColor,
  airdropRiskLabel,
  type AirdropGuardState,
  type AirdropRisk,
  type TokenAccountInfo,
} from '../services/airdropGuardService';
import InfoTooltip from './InfoTooltip';

interface WalletProfile {
  address: string;
  label: string;
  state: AirdropGuardState | null;
  isScanning: boolean;
  error?: string;
  solBalance?: number;
  isCompromised?: boolean;
  drainerAddress?: string;
  scanPartial?: boolean;
}

const STORAGE_KEY = 'sentinel1_multi_wallets';

function loadSavedWallets(): WalletProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{ address: string; label: string }>;
      return parsed.map(w => ({
        address: w.address,
        label: w.label,
        state: null,
        isScanning: false,
      }));
    }
  } catch { /* ignore */ }
  return [];
}

function saveWallets(wallets: WalletProfile[]) {
  const slim = wallets.map(w => ({ address: w.address, label: w.label }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

export default memo(function MultiWalletPanel() {
  const { connection } = useConnection();
  const [wallets, setWallets] = useState<WalletProfile[]>(loadSavedWallets);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addWarning, setAddWarning] = useState<string | null>(null);
  const scanCooldowns = useRef<Map<string, number>>(new Map());

  // ── Try to derive public key from a secret key ──
  const tryDeriveFromSecretKey = useCallback((input: string): { publicKey: string } | null => {
    try {
      const decoded = bs58.decode(input);
      // Solana secret keys are exactly 64 bytes
      if (decoded.length === 64) {
        const kp = Keypair.fromSecretKey(decoded);
        return { publicKey: kp.publicKey.toBase58() };
      }
    } catch { /* not a valid secret key */ }
    return null;
  }, []);

  // ── Validate input (address or secret key) → returns resolved public address ──
  const validateAndResolve = useCallback((input: string): { valid: boolean; address?: string; error?: string; warning?: string } => {
    if (!input || input.length === 0) return { valid: false, error: 'Input is empty' };
    // Check base58 characters first
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(input)) return { valid: false, error: 'Invalid characters — Solana uses Base58 (no 0, O, I, l).' };

    // If it's a normal-length address (32-44 chars), validate as public key
    if (input.length >= 32 && input.length <= 44) {
      try {
        new PublicKey(input);
        return { valid: true, address: input };
      } catch {
        return { valid: false, error: 'Invalid Solana address format.' };
      }
    }

    // If it's longer (likely a secret key ~87-88 chars, or tx sig ~88 chars), try to derive
    if (input.length > 44) {
      const derived = tryDeriveFromSecretKey(input);
      if (derived) {
        return {
          valid: true,
          address: derived.publicKey,
          warning: `⚠️ SECRET KEY DETECTED — Never share your private key! We derived the public address (${derived.publicKey.slice(0, 6)}...${derived.publicKey.slice(-4)}) and will scan that instead. Your key is NOT stored.`,
        };
      }
      return { valid: false, error: `Input is ${input.length} chars — not a valid address (32-44 chars) or secret key. Could be a transaction signature.` };
    }

    return { valid: false, error: `Too short (${input.length} chars) — Solana addresses are 32-44 characters.` };
  }, [tryDeriveFromSecretKey]);

  // ── Scan a single wallet ──
  const scanWallet = useCallback(async (address: string) => {
    // Rate limit: 30s cooldown between scans per wallet to prevent RPC spam
    const lastScan = scanCooldowns.current.get(address) ?? 0;
    if (Date.now() - lastScan < 30000) return;
    scanCooldowns.current.set(address, Date.now());

    setWallets(prev => prev.map(w =>
      w.address === address ? { ...w, isScanning: true, error: undefined } : w
    ));

    try {
      const { accounts, alerts, isCompromised, drainerAddress, solBalance: returnedBalance, scanPartial } = await scanTokenAccounts(connection, address);
      const { score } = computeAirdropRiskScore(accounts, alerts);

      // Use SOL balance from scanTokenAccounts (already fetched there)
      const solBalance = returnedBalance ?? 0;

      const totalDelegations = accounts.filter(a => a.delegate !== null).length;
      const suspiciousTokenCount = accounts.filter(
        a => a.riskLevel === 'suspicious' || a.riskLevel === 'dangerous'
      ).length;

      setWallets(prev => prev.map(w =>
        w.address === address ? {
          ...w,
          isScanning: false,
          solBalance,
          isCompromised,
          drainerAddress,
          scanPartial,
          state: {
            isScanning: false,
            lastScanTime: Date.now(),
            tokenAccounts: accounts,
            alerts,
            riskScore: isCompromised ? Math.min(score, 10) : score, // Cap at 10 if compromised
            totalDelegations,
            suspiciousTokenCount,
            notificationsEnabled: false,
          },
        } : w
      ));
    } catch (err) {
      setWallets(prev => prev.map(w =>
        w.address === address ? {
          ...w,
          isScanning: false,
          error: err instanceof Error ? err.message : 'Scan failed',
        } : w
      ));
    }
  }, [connection]);

  // ── Add wallet ──
  const handleAddWallet = useCallback(() => {
    const trimmedInput = newAddress.trim();
    setAddError(null);
    setAddWarning(null);

    const result = validateAndResolve(trimmedInput);
    if (!result.valid || !result.address) {
      setAddError(result.error || 'Invalid input');
      return;
    }

    const resolvedAddress = result.address;

    if (wallets.some(w => w.address === resolvedAddress)) {
      setAddError('This wallet is already in the list.');
      return;
    }

    if (result.warning) {
      setAddWarning(result.warning);
    }

    const profile: WalletProfile = {
      address: resolvedAddress,
      label: newLabel.trim() || `Wallet ${wallets.length + 1}`,
      state: null,
      isScanning: false,
    };
    const updated = [...wallets, profile];
    setWallets(updated);
    saveWallets(updated);
    setNewAddress('');
    setNewLabel('');

    // Auto-scan the newly added wallet
    setTimeout(() => scanWallet(resolvedAddress), 300);
  }, [newAddress, newLabel, wallets, validateAndResolve, scanWallet]);

  // ── Remove wallet ──
  const handleRemoveWallet = useCallback((address: string) => {
    const updated = wallets.filter(w => w.address !== address);
    setWallets(updated);
    saveWallets(updated);
  }, [wallets]);

  // ── Scan all wallets ──
  const scanAll = useCallback(async () => {
    for (const wallet of wallets) {
      await scanWallet(wallet.address);
    }
  }, [wallets, scanWallet]);

  // ── Copy address ──
  const handleCopy = useCallback((addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  // ── Chart data ──
  const chartData = wallets
    .filter(w => w.state)
    .map(w => ({
      name: w.label,
      riskScore: w.state!.riskScore,
      tokens: w.state!.tokenAccounts.length,
      delegations: w.state!.totalDelegations,
      suspicious: w.state!.suspiciousTokenCount,
      alerts: w.state!.alerts.length,
    }));

  const scannedCount = wallets.filter(w => w.state).length;

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-pyth-cyan" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Multi-Wallet Comparison
          </h2>
          <InfoTooltip
            title="Wallet Risk Comparison"
            content="Compare security and risk profiles across multiple Solana wallets. Add any wallet address to scan its SPL token accounts, delegations, and potential threats. Useful for monitoring team wallets, DAO treasuries, or tracking suspicious addresses."
          />
          {wallets.length > 0 && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-pyth-cyan/10 text-pyth-cyan">
              {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto sm:ml-0 p-1 rounded hover:bg-pyth-surface/50 text-pyth-text-muted"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!isCollapsed && wallets.length > 0 && (
          <button
            onClick={scanAll}
            className="flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded
              bg-pyth-cyan/10 border border-pyth-cyan/20 text-pyth-cyan
              hover:bg-pyth-cyan/20 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Scan All
          </button>
        )}
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Add wallet input */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <input
                type="text"
                value={newAddress}
                onChange={e => { setNewAddress(e.target.value); setAddError(null); setAddWarning(null); }}
                onKeyDown={e => e.key === 'Enter' && handleAddWallet()}
                placeholder="Paste wallet address or secret key..."
                className="flex-1 font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-3 py-2 
                  text-pyth-text placeholder:text-pyth-text-muted/40 outline-none focus:border-pyth-cyan/30"
              />
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddWallet()}
                placeholder="Label (optional)"
                className="w-full sm:w-32 font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-3 py-2 
                  text-pyth-text placeholder:text-pyth-text-muted/40 outline-none focus:border-pyth-cyan/30"
              />
              <button
                onClick={handleAddWallet}
                disabled={!newAddress.trim()}
                className="flex items-center justify-center gap-1 font-mono text-[10px] px-3 py-2 rounded
                  bg-pyth-cyan/10 border border-pyth-cyan/20 text-pyth-cyan
                  hover:bg-pyth-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Plus className="w-3 h-3" />
                Add & Scan
              </button>
            </div>

            {/* Validation error */}
            {addError && (
              <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded bg-pyth-red/5 border border-pyth-red/10">
                <AlertTriangle className="w-3 h-3 text-pyth-red shrink-0" />
                <span className="font-mono text-[9px] text-pyth-red">{addError}</span>
              </div>
            )}

            {/* Secret key warning */}
            {addWarning && (
              <div className="flex items-start gap-1.5 mb-3 px-2 py-2 rounded bg-pyth-yellow/5 border border-pyth-yellow/20">
                <Shield className="w-3.5 h-3.5 text-pyth-yellow shrink-0 mt-0.5" />
                <span className="font-mono text-[9px] text-pyth-yellow leading-relaxed">{addWarning}</span>
              </div>
            )}

            {/* Comparison chart */}
            {chartData.length >= 2 && (
              <div className="mb-4">
                <h3 className="font-mono text-[10px] text-pyth-text-muted mb-2 uppercase">
                  Safety Score Comparison
                </h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: '#8A8EA0' }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(171,135,255,0.1)' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: '#8A8EA0' }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(171,135,255,0.1)' }}
                      />
                      <Tooltip content={<ComparisonTooltip />} />
                      <Bar dataKey="riskScore" name="Safety Score" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => {
                          const score = entry.riskScore;
                          const color = score >= 80 ? '#00FFA3' : score >= 60 ? '#FFD166' : score >= 35 ? '#FF8C42' : '#FF4162';
                          return <Cell key={i} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Wallet cards */}
            {wallets.length === 0 ? (
              <div className="text-center py-8">
                <Search className="w-8 h-8 text-pyth-text-muted/20 mx-auto mb-2" />
                <p className="font-mono text-xs text-pyth-text-muted">No wallets added yet</p>
                <p className="font-mono text-[10px] text-pyth-text-muted/60 mt-1">
                  Add Solana wallet addresses above to compare risk profiles
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {wallets.map(wallet => (
                  <WalletCard
                    key={wallet.address}
                    wallet={wallet}
                    onScan={() => scanWallet(wallet.address)}
                    onRemove={() => handleRemoveWallet(wallet.address)}
                    onCopy={() => handleCopy(wallet.address)}
                    isCopied={copied === wallet.address}
                  />
                ))}
              </div>
            )}

            {/* Summary stats */}
            {scannedCount >= 2 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    label: 'Avg Safety',
                    value: (wallets.filter(w => w.state).reduce((s, w) => s + (w.state?.riskScore || 0), 0) / scannedCount).toFixed(0),
                    color: 'text-pyth-purple',
                  },
                  {
                    label: 'Total Tokens',
                    value: wallets.filter(w => w.state).reduce((s, w) => s + (w.state?.tokenAccounts.length || 0), 0).toString(),
                    color: 'text-pyth-cyan',
                  },
                  {
                    label: 'Active Delegations',
                    value: wallets.filter(w => w.state).reduce((s, w) => s + (w.state?.totalDelegations || 0), 0).toString(),
                    color: 'text-pyth-yellow',
                  },
                  {
                    label: 'Total Alerts',
                    value: wallets.filter(w => w.state).reduce((s, w) => s + (w.state?.alerts.length || 0), 0).toString(),
                    color: 'text-pyth-red',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-pyth-surface/40 rounded-lg p-2 text-center">
                    <div className="font-mono text-[9px] text-pyth-text-muted uppercase">{label}</div>
                    <div className={`font-mono text-sm font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Wallet Card ──

function WalletCard({
  wallet,
  onScan,
  onRemove,
  onCopy,
  isCopied,
}: {
  wallet: WalletProfile;
  onScan: () => void;
  onRemove: () => void;
  onCopy: () => void;
  isCopied: boolean;
}) {
  const { state, isScanning, error, solBalance } = wallet;
  const [showTokens, setShowTokens] = useState(false);
  const isCompromised = wallet.isCompromised;
  const riskLevel: AirdropRisk = state
    ? (isCompromised ? 'dangerous' 
    : state.riskScore >= 80 ? 'safe'
    : state.riskScore >= 60 ? 'caution'
    : state.riskScore >= 35 ? 'suspicious'
    : 'dangerous')
    : 'safe';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-lg border p-3 transition-all ${
        state
          ? riskLevel === 'safe' 
            ? 'bg-pyth-surface/50 border-pyth-green/20' 
            : riskLevel === 'caution'
            ? 'bg-pyth-surface/50 border-pyth-yellow/20'
            : 'bg-pyth-surface/50 border-pyth-red/20'
          : 'bg-pyth-surface/30 border-pyth-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs font-bold text-pyth-text truncate">{wallet.label}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onCopy} className="p-1 rounded text-pyth-text-muted hover:text-pyth-text transition-colors" title="Copy address">
            {isCopied ? <CheckCircle2 className="w-3 h-3 text-pyth-green" /> : <Copy className="w-3 h-3" />}
          </button>
          <button onClick={onRemove} className="p-1 rounded text-pyth-text-muted hover:text-pyth-red transition-colors" title="Remove">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Address */}
      <div className="font-mono text-[10px] text-pyth-text-muted mb-2 truncate">
        {shortenAddress(wallet.address)}
      </div>

      {/* Scan state */}
      {isScanning ? (
        <div className="flex items-center justify-center py-4 gap-2">
          <div className="w-4 h-4 border-2 border-pyth-cyan/30 border-t-pyth-cyan rounded-full animate-spin" />
          <span className="font-mono text-[10px] text-pyth-text-muted">Scanning...</span>
        </div>
      ) : error ? (
        <div className="text-center py-3">
          <AlertTriangle className="w-4 h-4 text-pyth-red mx-auto mb-1" />
          <p className="font-mono text-[9px] text-pyth-red">{error}</p>
          <button onClick={onScan} className="font-mono text-[9px] text-pyth-cyan mt-1 hover:underline">Retry</button>
        </div>
      ) : state ? (
        <div>
          {/* 🔴 Compromise Banner */}
          {isCompromised && (
            <div className="mb-2 p-2 rounded-md bg-pyth-red/10 border border-pyth-red/30 animate-pulse">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-pyth-red" />
                <span className="font-mono text-[10px] font-bold text-pyth-red uppercase">
                  ⛔ WALLET COMPROMISED
                </span>
              </div>
              <p className="font-mono text-[8px] text-pyth-red/80 leading-relaxed">
                Sweeper bot detected — any funds sent to this wallet will be immediately drained.
                {wallet.drainerAddress && (
                  <span className="block mt-0.5">
                    Drainer: <span className="font-bold">{wallet.drainerAddress}</span>
                  </span>
                )}
              </p>
              <p className="font-mono text-[7px] text-pyth-red/60 mt-1">
                🚫 DO NOT deposit any funds into this wallet. Transfer remaining assets to a new wallet with a fresh key pair.
              </p>
            </div>
          )}

          {/* Partial scan indicator */}
          {wallet.scanPartial && !isCompromised && (
            <div className="mb-1.5 flex items-center gap-1 px-2 py-1 rounded bg-pyth-yellow/5 border border-pyth-yellow/10">
              <AlertTriangle className="w-3 h-3 text-pyth-yellow shrink-0" />
              <span className="font-mono text-[8px] text-pyth-yellow">
                Partial Scan — RPC rate limited, heuristic result only.
              </span>
            </div>
          )}

          {/* Safety score */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[8px] text-pyth-text-muted uppercase">Safety</span>
            <div className="flex-1 h-2 bg-pyth-surface rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${state.riskScore}%`,
                  backgroundColor: airdropRiskColor(riskLevel),
                }}
              />
            </div>
            <span className="font-mono text-xs font-bold" style={{ color: airdropRiskColor(riskLevel) }}>
              {state.riskScore}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-1.5 text-center mb-2">
            <div className="bg-pyth-surface/30 rounded p-1.5">
              <div className="font-mono text-[8px] text-pyth-text-muted uppercase">SOL</div>
              <div className="font-mono text-[10px] text-pyth-text font-bold">
                {solBalance !== undefined ? solBalance.toFixed(3) : '—'}
              </div>
            </div>
            <div className="bg-pyth-surface/30 rounded p-1.5">
              <div className="font-mono text-[8px] text-pyth-text-muted uppercase">Tokens</div>
              <div className="font-mono text-[10px] text-pyth-text font-bold">{state.tokenAccounts.length}</div>
            </div>
            <div className="bg-pyth-surface/30 rounded p-1.5">
              <div className="font-mono text-[8px] text-pyth-text-muted uppercase">Delegations</div>
              <div className={`font-mono text-[10px] font-bold ${state.totalDelegations > 0 ? 'text-pyth-red' : 'text-pyth-green'}`}>
                {state.totalDelegations}
              </div>
            </div>
            <div className="bg-pyth-surface/30 rounded p-1.5">
              <div className="font-mono text-[8px] text-pyth-text-muted uppercase">Alerts</div>
              <div className={`font-mono text-[10px] font-bold ${state.alerts.length > 0 ? 'text-pyth-yellow' : 'text-pyth-green'}`}>
                {state.alerts.length}
              </div>
            </div>
          </div>

          {/* Risk label + token toggle */}
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: airdropRiskColor(riskLevel) + '20',
                color: airdropRiskColor(riskLevel),
              }}
            >
              {airdropRiskLabel(riskLevel)}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] text-pyth-text-muted/60">
                {state.lastScanTime > 0 ? new Date(state.lastScanTime).toLocaleTimeString() : ''}
              </span>
              {state.tokenAccounts.length > 0 && (
                <button
                  onClick={() => setShowTokens(!showTokens)}
                  className="flex items-center gap-0.5 font-mono text-[8px] text-pyth-cyan hover:text-pyth-text transition-colors"
                  title={showTokens ? 'Hide tokens' : 'Show tokens'}
                >
                  {showTokens ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showTokens ? 'Hide' : 'Tokens'}
                </button>
              )}
            </div>
          </div>

          {/* Alerts list (if any) */}
          {state.alerts.length > 0 && (
            <div className="mb-2 space-y-1">
              {state.alerts.slice(0, 3).map(alert => (
                <div
                  key={alert.id}
                  className={`rounded px-2 py-1 border text-left ${
                    alert.severity === 'dangerous'
                      ? 'bg-pyth-red/5 border-pyth-red/10'
                      : alert.severity === 'suspicious'
                      ? 'bg-pyth-yellow/5 border-pyth-yellow/10'
                      : 'bg-pyth-surface/30 border-pyth-border'
                  }`}
                >
                  <div className="font-mono text-[8px] font-bold text-pyth-text truncate">{alert.title}</div>
                  <div className="font-mono text-[7px] text-pyth-text-muted truncate">{alert.description.slice(0, 100)}</div>
                </div>
              ))}
              {state.alerts.length > 3 && (
                <div className="font-mono text-[8px] text-pyth-text-muted text-center">
                  +{state.alerts.length - 3} more alert{state.alerts.length - 3 > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Expandable Token List */}
          <AnimatePresence>
            {showTokens && state.tokenAccounts.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-pyth-border pt-2 mt-1">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Coins className="w-3 h-3 text-pyth-text-muted" />
                    <span className="font-mono text-[8px] text-pyth-text-muted uppercase">
                      Token Accounts ({state.tokenAccounts.length})
                    </span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-pyth-border">
                    {state.tokenAccounts
                      .sort((a, b) => {
                        // Sort: dangerous first, then suspicious, caution, safe
                        const order: Record<string, number> = { dangerous: 0, suspicious: 1, caution: 2, safe: 3 };
                        return (order[a.riskLevel] ?? 3) - (order[b.riskLevel] ?? 3);
                      })
                      .map(token => (
                        <TokenRow key={token.address} token={token} />
                      ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rescan button */}
          <button
            onClick={onScan}
            className="w-full mt-2 flex items-center justify-center gap-1 font-mono text-[9px] py-1 rounded
              bg-pyth-surface/40 border border-pyth-border text-pyth-text-muted
              hover:text-pyth-cyan hover:border-pyth-cyan/20 transition-all"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            Rescan
          </button>
        </div>
      ) : (
        <div className="text-center py-3">
          <Shield className="w-5 h-5 text-pyth-text-muted/20 mx-auto mb-1" />
          <button
            onClick={onScan}
            className="font-mono text-[10px] px-3 py-1 rounded bg-pyth-cyan/10 border border-pyth-cyan/20 
              text-pyth-cyan hover:bg-pyth-cyan/20 transition-all"
          >
            Scan Wallet
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Token Row ──

const riskBadgeStyles: Record<AirdropRisk, string> = {
  safe: 'bg-pyth-green/10 text-pyth-green border-pyth-green/20',
  caution: 'bg-pyth-yellow/10 text-pyth-yellow border-pyth-yellow/20',
  suspicious: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  dangerous: 'bg-pyth-red/10 text-pyth-red border-pyth-red/20',
};

function TokenRow({ token }: { token: TokenAccountInfo }) {
  const solscanUrl = `https://solscan.io/token/${token.mint}`;

  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1.5 border ${
        token.riskLevel === 'dangerous'
          ? 'bg-pyth-red/5 border-pyth-red/10'
          : token.riskLevel === 'suspicious'
          ? 'bg-orange-500/5 border-orange-500/10'
          : token.riskLevel === 'caution'
          ? 'bg-pyth-yellow/5 border-pyth-yellow/10'
          : 'bg-pyth-surface/20 border-pyth-border'
      }`}
    >
      {/* Token info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] font-bold text-pyth-text truncate">
            {token.symbol || 'UNKNOWN'}
          </span>
          <span className={`font-mono text-[7px] font-bold px-1 py-0 rounded border ${riskBadgeStyles[token.riskLevel]}`}>
            {token.riskLevel.toUpperCase()}
          </span>
        </div>
        <div className="font-mono text-[8px] text-pyth-text-muted truncate">
          {token.name || `${token.mint.slice(0, 6)}...${token.mint.slice(-4)}`}
        </div>
        {token.riskReasons.length > 0 && (
          <div className="font-mono text-[7px] text-pyth-text-muted/60 mt-0.5 truncate">
            ⚠ {token.riskReasons[0]}
          </div>
        )}
      </div>

      {/* Balance */}
      <div className="text-right shrink-0">
        <div className="font-mono text-[9px] text-pyth-text font-bold">
          {token.balance > 0 ? (token.balance < 0.001 ? '<0.001' : token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })) : '0'}
        </div>
        {token.delegate && (
          <div className="font-mono text-[7px] text-pyth-red">
            🔓 delegated
          </div>
        )}
      </div>

      {/* Solscan link */}
      <a
        href={solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 p-0.5 text-pyth-text-muted/40 hover:text-pyth-cyan transition-colors"
        title="View on Solscan"
      >
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
    </div>
  );
}

// ── Comparison Tooltip ──

function ComparisonTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: Record<string, number> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-pyth-surface/95 backdrop-blur-md border border-pyth-border rounded-lg p-2 shadow-xl">
      <p className="font-mono text-[10px] text-pyth-text font-bold mb-1">{label}</p>
      <div className="space-y-0.5">
        <div className="font-mono text-[9px] text-pyth-text-muted">Safety Score: <span className="text-pyth-text font-bold">{d.riskScore}</span></div>
        <div className="font-mono text-[9px] text-pyth-text-muted">Tokens: <span className="text-pyth-text">{d.tokens}</span></div>
        <div className="font-mono text-[9px] text-pyth-text-muted">Delegations: <span className="text-pyth-text">{d.delegations}</span></div>
        <div className="font-mono text-[9px] text-pyth-text-muted">Alerts: <span className="text-pyth-text">{d.alerts}</span></div>
      </div>
    </div>
  );
}
