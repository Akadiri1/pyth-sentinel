// ── Wallet Connect Button + Balance Display ──
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';

export default function WalletButton() {
  const { publicKey, connected, connect, disconnect, connecting, wallet, select, wallets } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  // Position dropdown relative to button
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showDropdown]);

  // Fetch SOL balance
  useEffect(() => {
    if (!publicKey || !connected) {
      setBalance(null);
      return;
    }

    let cancelled = false;

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL);
      } catch {
        if (!cancelled) setBalance(null);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 15000); // refresh every 15s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicKey, connected, connection]);

  const handleConnect = useCallback(async () => {
    try {
      if (!wallet && wallets.length > 0) {
        select(wallets[0].adapter.name);
      }
      await connect();
    } catch (err) {
      console.warn('Wallet connect failed:', err);
    }
  }, [connect, wallet, wallets, select]);

  const handleCopyAddress = useCallback(() => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [publicKey]);

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  if (!connected) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-pyth-purple/15 border border-pyth-purple/30
          text-pyth-purple hover:bg-pyth-purple/25 hover:border-pyth-purple/50
          disabled:opacity-50 disabled:cursor-wait
          transition-all font-mono text-xs"
      >
        <Wallet className="w-3.5 h-3.5" />
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </motion.button>
    );
  }

  return (
    <div className="relative">
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-pyth-green/10 border border-pyth-green/25
          hover:bg-pyth-green/15 hover:border-pyth-green/40
          transition-all font-mono text-xs"
      >
        <div className="w-2 h-2 rounded-full bg-pyth-green animate-pulse" />
        <span className="text-pyth-green font-semibold">{shortAddress}</span>
        {balance !== null && (
          <span className="text-pyth-text-dim">
            {balance.toFixed(3)} SOL
          </span>
        )}
      </motion.button>

      {/* Dropdown — rendered via portal to body to escape all stacking contexts */}
      {createPortal(
        <AnimatePresence>
          {showDropdown && (
            <>
              {/* Click outside handler */}
              <div
                className="fixed inset-0"
                style={{ zIndex: 99998 }}
                onClick={() => setShowDropdown(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="fixed w-64
                  bg-pyth-surface border border-pyth-border rounded-xl
                  shadow-2xl shadow-black/40 overflow-hidden"
                style={{ top: dropdownPos.top, right: dropdownPos.right, zIndex: 99999 }}
              >
            {/* Balance section */}
            <div className="p-4 border-b border-pyth-border">
              <div className="text-[9px] font-mono text-pyth-text-muted uppercase tracking-wider mb-1">
                Wallet Balance
              </div>
              <div className="text-xl font-mono font-bold text-pyth-text">
                {balance !== null ? `${balance.toFixed(4)} SOL` : '—'}
              </div>
              {balance !== null && (
                <div className="text-[10px] font-mono text-pyth-text-dim mt-0.5">
                  ≈ ${((balance || 0) * 88.27).toFixed(2)} USD
                </div>
              )}
            </div>

            {/* Address */}
            <div className="px-4 py-3 border-b border-pyth-border">
              <div className="text-[9px] font-mono text-pyth-text-muted uppercase tracking-wider mb-1">
                Address
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-pyth-text truncate flex-1">
                  {publicKey?.toBase58()}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 rounded hover:bg-pyth-bg transition-colors shrink-0"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-pyth-green" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-pyth-text-dim" />
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="p-2 space-y-0.5">
              <a
                href={`https://solscan.io/account/${publicKey?.toBase58()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg
                  hover:bg-pyth-bg transition-colors text-pyth-text-dim
                  font-mono text-[11px]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on Solscan
              </a>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  localStorage.removeItem('walletName');
                  disconnect();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                  hover:bg-pyth-purple/10 transition-colors text-pyth-purple
                  font-mono text-[11px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Switch Wallet
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('walletName');
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                  hover:bg-pyth-red/10 transition-colors text-pyth-red
                  font-mono text-[11px]"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
