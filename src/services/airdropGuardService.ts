// ── Airdrop Guard Service ──
// Protects wallets from malicious airdrop drain attacks.
// Scans SPL token accounts for suspicious delegations, unknown mints,
// and airdropped tokens that may contain hidden drain mechanisms.

import {
  Connection,
  PublicKey,
  Transaction,
  type ParsedAccountData,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createRevokeInstruction,
} from '@solana/spl-token';

// ── Types ──

export type AirdropRisk = 'safe' | 'caution' | 'suspicious' | 'dangerous';

export interface TokenAccountInfo {
  mint: string;
  address: string; // token account pubkey
  balance: number;
  decimals: number;
  delegate: string | null;
  delegatedAmount: number;
  isNative: boolean;
  owner: string;
  riskLevel: AirdropRisk;
  riskReasons: string[];
  symbol?: string;
  name?: string;
}

export interface AirdropAlert {
  id: string;
  timestamp: number;
  type: 'malicious_delegation' | 'scam_token' | 'unknown_airdrop' | 'drain_attempt' | 'approval_risk' | 'sweep_detected' | 'key_compromise';
  severity: AirdropRisk;
  title: string;
  description: string;
  tokenMint?: string;
  tokenAccount?: string;
  delegate?: string;
  actionRequired: boolean;
  actionLabel?: string;
}

export interface AirdropGuardState {
  isScanning: boolean;
  lastScanTime: number;
  tokenAccounts: TokenAccountInfo[];
  alerts: AirdropAlert[];
  riskScore: number; // 0–100 (100 = safe)
  totalDelegations: number;
  suspiciousTokenCount: number;
  notificationsEnabled: boolean;
}

// ── Known Scam Token Mints (Community-sourced) ──
// In production, these would be fetched from Solana scam token databases
// like Solana Token List, Jupiter strict list, or community reports
const KNOWN_SCAM_MINTS = new Set([
  // Example scam mints (not real — illustrative)
  'ScamToken11111111111111111111111111111111',
  'FakeDrop222222222222222222222222222222222',
  'DrainerMint33333333333333333333333333333',
  'PhishToken4444444444444444444444444444444',
  'MaliciousAirdrop5555555555555555555555555',
]);

// Well-known legitimate token mints (safe list) with metadata
const TRUSTED_MINTS_META: Record<string, { symbol: string; name: string }> = {
  'So11111111111111111111111111111111111111112':  { symbol: 'wSOL', name: 'Wrapped SOL' },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD' },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', name: 'Pyth Network' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN':  { symbol: 'JUP', name: 'Jupiter' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So':  { symbol: 'mSOL', name: 'Marinade SOL' },
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL':  { symbol: 'JTO', name: 'Jito' },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'WETH', name: 'Wrapped ETH' },
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof':  { symbol: 'RNDR', name: 'Render' },
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1':  { symbol: 'bSOL', name: 'BlazeStake SOL' },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF', name: 'dogwifhat' },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY', name: 'Raydium' },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6k8FHGhQjfT': { symbol: 'ORCA', name: 'Orca' },
  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt':  { symbol: 'SRM', name: 'Serum' },
  'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey':  { symbol: 'MNDE', name: 'Marinade' },
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux':  { symbol: 'HNT', name: 'Helium' },
  '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ': { symbol: 'W', name: 'Wormhole' },
  'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p91oHk':   { symbol: 'WEN', name: 'Wen' },
};
const TRUSTED_MINTS = new Set(Object.keys(TRUSTED_MINTS_META));

// Known drainer program IDs (malicious programs that steal funds)
const KNOWN_DRAINER_PROGRAMS = new Set([
  'DrainProg111111111111111111111111111111111',
  'TokenThief2222222222222222222222222222222',
  'WalletDrain33333333333333333333333333333',
]);

// ── Red-flag token name patterns ──
const SUSPICIOUS_NAME_PATTERNS = [
  /airdrop/i,
  /claim/i,
  /reward/i,
  /free\s*(sol|token|nft|mint)/i,
  /bonus/i,
  /congratulation/i,
  /\.com$/i,    // URLs in token names
  /\.io$/i,
  /\.xyz$/i,
  /http/i,
  /visit/i,
  /redeem/i,
];

// ── Initial State ──
export const EMPTY_AIRDROP_STATE: AirdropGuardState = {
  isScanning: false,
  lastScanTime: 0,
  tokenAccounts: [],
  alerts: [],
  riskScore: 100,
  totalDelegations: 0,
  suspiciousTokenCount: 0,
  notificationsEnabled: true,
};

// ── Core Scanning Functions ──

/**
 * Analyze recent transaction history for signs of a sweeper bot or key compromise.
 * Key indicators:
 *  1. Rapid outflows after inflows (sweeper pattern)
 *  2. All outflows going to the same destination (drainer address)
 *  3. Near-zero SOL balance despite having token accounts
 *  4. High frequency of outbound transfers vs inbound
 */
export async function detectSweepPatterns(
  connection: Connection,
  walletAddress: string,
): Promise<{ alerts: AirdropAlert[]; isCompromised: boolean; drainerAddress?: string; sweepCount: number }> {
  const pubkey = new PublicKey(walletAddress);
  const alerts: AirdropAlert[] = [];
  const now = Date.now();
  let isCompromised = false;
  let drainerAddress: string | undefined;
  let sweepCount = 0;

  try {
    // Fetch recent transaction signatures (last 20)
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 20 });

    if (signatures.length === 0) {
      return { alerts, isCompromised: false, sweepCount: 0 };
    }

    // Fetch parsed transactions (batch up to 10 for performance)
    const txSigs = signatures.slice(0, 10).map(s => s.signature);
    const txs = await connection.getParsedTransactions(txSigs, { maxSupportedTransactionVersion: 0 });

    // Track outflow destinations and patterns
    const outflowDestinations: Map<string, number> = new Map(); // destination → count
    let outflowTxCount = 0;
    let inflowTxCount = 0;
    const transferTimestamps: { time: number; type: 'in' | 'out'; amount: number; destination?: string }[] = [];

    for (const tx of txs) {
      if (!tx?.meta || !tx.transaction) continue;
      const blockTime = (tx.blockTime ?? 0) * 1000;
      const instructions = tx.transaction.message.instructions;

      for (const ix of instructions) {
        if (!('parsed' in ix)) continue;
        const parsed = ix.parsed as Record<string, unknown>;
        const ixType = parsed.type as string;

        // Detect SOL transfers
        if (ixType === 'transfer' && parsed.info) {
          const info = parsed.info as Record<string, unknown>;
          const source = info.source as string;
          const destination = info.destination as string;
          const lamports = info.lamports as number;
          const solAmount = (lamports ?? 0) / LAMPORTS_PER_SOL;

          if (source === walletAddress && destination !== walletAddress) {
            outflowTxCount++;
            outflowDestinations.set(destination, (outflowDestinations.get(destination) ?? 0) + 1);
            transferTimestamps.push({ time: blockTime, type: 'out', amount: solAmount, destination });
          } else if (destination === walletAddress) {
            inflowTxCount++;
            transferTimestamps.push({ time: blockTime, type: 'in', amount: solAmount });
          }
        }

        // Detect SPL token transfers
        if ((ixType === 'transfer' || ixType === 'transferChecked') && parsed.info) {
          const info = parsed.info as Record<string, unknown>;
          const authority = info.authority as string;
          const dest = (info.destination as string) || '';

          if (authority === walletAddress && dest) {
            outflowTxCount++;
            outflowDestinations.set(dest, (outflowDestinations.get(dest) ?? 0) + 1);
            transferTimestamps.push({ time: blockTime, type: 'out', amount: 0, destination: dest });
          }
        }
      }
    }

    // ── Pattern Analysis ──

    // Pattern 1: Majority of transactions are outflows (draining)
    const totalTxs = outflowTxCount + inflowTxCount;
    if (totalTxs >= 3 && outflowTxCount / totalTxs > 0.75) {
      sweepCount += outflowTxCount;
      alerts.push({
        id: `sweep-outflow-ratio-${now}`,
        timestamp: now,
        type: 'sweep_detected',
        severity: 'dangerous',
        title: '🚨 HIGH OUTFLOW RATIO — POSSIBLE DRAIN',
        description: `${outflowTxCount} of the last ${totalTxs} transactions are outbound transfers. This pattern is consistent with an automated sweeper bot draining the wallet.`,
        actionRequired: false,
      });
    }

    // Pattern 2: All outflows going to same destination (sweeper address)
    if (outflowDestinations.size === 1 && outflowTxCount >= 2) {
      drainerAddress = [...outflowDestinations.keys()][0];
      isCompromised = true;
      alerts.push({
        id: `sweep-single-dest-${now}`,
        timestamp: now,
        type: 'key_compromise',
        severity: 'dangerous',
        title: '🔴 KEY COMPROMISE — SWEEPER BOT DETECTED',
        description: `All ${outflowTxCount} outbound transfers go to the same address (${shortenAddr(drainerAddress)}). This is the #1 indicator of a stolen private key with an active sweeper bot. ANY funds sent to this wallet will be immediately drained to the attacker's address.`,
        actionRequired: false,
      });
    }

    // Pattern 3: Dominant destination (>70% of outflows go to one address)
    if (!isCompromised && outflowDestinations.size > 1 && outflowTxCount >= 3) {
      const sortedDests = [...outflowDestinations.entries()].sort((a, b) => b[1] - a[1]);
      const topDest = sortedDests[0];
      if (topDest[1] / outflowTxCount > 0.7) {
        drainerAddress = topDest[0];
        isCompromised = true;
        alerts.push({
          id: `sweep-dominant-dest-${now}`,
          timestamp: now,
          type: 'key_compromise',
          severity: 'dangerous',
          title: '🔴 LIKELY KEY COMPROMISE — DRAIN PATTERN',
          description: `${topDest[1]} of ${outflowTxCount} outbound transfers (${Math.round(topDest[1] / outflowTxCount * 100)}%) go to ${shortenAddr(drainerAddress!)}. This strongly suggests an automated sweeper draining funds from this wallet.`,
          actionRequired: false,
        });
      }
    }

    // Pattern 4: Rapid outflows after inflows (sweeper timing)
    transferTimestamps.sort((a, b) => a.time - b.time);
    let rapidSweepCount = 0;
    for (let i = 0; i < transferTimestamps.length - 1; i++) {
      const current = transferTimestamps[i];
      const next = transferTimestamps[i + 1];
      // If inflow is immediately followed by outflow within 60 seconds
      if (current.type === 'in' && next.type === 'out' && (next.time - current.time) < 60_000) {
        rapidSweepCount++;
      }
    }
    if (rapidSweepCount >= 1) {
      if (!isCompromised) isCompromised = true;
      alerts.push({
        id: `sweep-rapid-${now}`,
        timestamp: now,
        type: 'sweep_detected',
        severity: 'dangerous',
        title: '⚡ RAPID SWEEP PATTERN DETECTED',
        description: `${rapidSweepCount} instance(s) of funds being transferred out within seconds of arriving. This is the hallmark behavior of a sweeper bot monitoring this wallet in real-time.`,
        actionRequired: false,
      });
    }

    // Pattern 5: Check SOL balance (swept wallets usually have near-zero)
    try {
      const lamports = await connection.getBalance(pubkey);
      const solBalance = lamports / LAMPORTS_PER_SOL;
      if (solBalance < 0.001 && outflowTxCount > 0) {
        alerts.push({
          id: `sweep-empty-${now}`,
          timestamp: now,
          type: 'sweep_detected',
          severity: 'suspicious',
          title: '💀 WALLET DRAINED — NEAR-ZERO BALANCE',
          description: `This wallet has only ${solBalance.toFixed(6)} SOL remaining despite outbound transfer activity. Combined with other patterns, this strongly indicates the wallet has been drained.`,
          actionRequired: false,
        });
      }
    } catch { /* ignore balance check failure */ }

  } catch (err) {
    console.warn('[AirdropGuard] Sweep detection failed:', err);
  }

  return { alerts, isCompromised, drainerAddress, sweepCount };
}

/**
 * Scan all SPL token accounts for a wallet and assess airdrop risks.
 */
export async function scanTokenAccounts(
  connection: Connection,
  walletAddress: string,
): Promise<{ accounts: TokenAccountInfo[]; alerts: AirdropAlert[]; isCompromised?: boolean; drainerAddress?: string }> {
  const pubkey = new PublicKey(walletAddress);
  const accounts: TokenAccountInfo[] = [];
  const alerts: AirdropAlert[] = [];
  const now = Date.now();
  let isCompromised = false;
  let drainerAddress: string | undefined;

  try {
    // Fetch Jupiter metadata, token accounts, AND sweep detection in parallel
    const [tokenAccounts, jupMap, sweepResult] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(
        pubkey,
        { programId: TOKEN_PROGRAM_ID },
      ),
      ensureJupiterTokenList(),
      detectSweepPatterns(connection, walletAddress),
    ]);

    // Merge sweep detection results
    if (sweepResult.alerts.length > 0) {
      alerts.push(...sweepResult.alerts);
    }
    isCompromised = sweepResult.isCompromised;
    drainerAddress = sweepResult.drainerAddress;

    for (const { pubkey: tokenPubkey, account } of tokenAccounts.value) {
      const parsed = account.data as ParsedAccountData;
      const info = parsed.parsed?.info;
      if (!info) continue;

      const mint: string = info.mint;
      const balance: number = info.tokenAmount?.uiAmount ?? 0;
      const decimals: number = info.tokenAmount?.decimals ?? 0;
      const delegate: string | null = info.delegate ?? null;
      const delegatedAmount: number = info.delegatedAmount?.uiAmount ?? 0;
      const isNative: boolean = info.isNative ?? false;
      const owner: string = info.owner ?? walletAddress;

      const riskReasons: string[] = [];
      let riskLevel: AirdropRisk = 'safe';

      // ── Risk Check 1: Active Delegation (most dangerous!) ──
      // If a token account has a delegate, that delegate can transfer tokens out
      // without the owner's explicit approval. This is the primary drain vector.
      if (delegate) {
        riskReasons.push(`Active delegation to ${shortenAddr(delegate)} for ${delegatedAmount} tokens`);
        riskLevel = 'dangerous';

        alerts.push({
          id: `airdrop-deleg-${tokenPubkey.toBase58().slice(0, 8)}`,
          timestamp: now,
          type: 'malicious_delegation',
          severity: 'dangerous',
          title: '⚠️ ACTIVE TOKEN DELEGATION DETECTED',
          description: `Token account ${shortenAddr(tokenPubkey.toBase58())} has an active delegate (${shortenAddr(delegate)}) authorized to transfer ${delegatedAmount} tokens. This is the primary mechanism used in airdrop drain attacks. The delegate can move your tokens without further permission.`,
          tokenMint: mint,
          tokenAccount: tokenPubkey.toBase58(),
          delegate,
          actionRequired: true,
          actionLabel: 'Revoke Delegation',
        });
      }

      // ── Risk Check 2: Known Scam Token Mint ──
      if (KNOWN_SCAM_MINTS.has(mint)) {
        riskReasons.push('Known scam token — do NOT interact');
        riskLevel = 'dangerous';

        alerts.push({
          id: `airdrop-scam-${mint.slice(0, 8)}`,
          timestamp: now,
          type: 'scam_token',
          severity: 'dangerous',
          title: '🚫 KNOWN SCAM TOKEN',
          description: `Token mint ${shortenAddr(mint)} is flagged in community scam databases. Do NOT interact with, trade, or attempt to sell this token. It may contain hidden instructions that drain your wallet. Leave it untouched.`,
          tokenMint: mint,
          tokenAccount: tokenPubkey.toBase58(),
          actionRequired: false,
        });
      }

      // ── Risk Check 3: Unknown/Untrusted Token Mint ──
      if (!TRUSTED_MINTS.has(mint) && !KNOWN_SCAM_MINTS.has(mint)) {
        // Unknown token — could be a legitimate new token or a scam
        if (balance > 0 && balance < 1000000) {
          riskReasons.push('Unknown token mint — verify legitimacy before interacting');
          if (riskLevel === 'safe') riskLevel = 'caution';
        }

        // Tiny or dust-like airdrop amounts are extra suspicious
        if (balance > 0 && balance <= 1) {
          riskReasons.push('Very small airdrop amount — common scam pattern');
          riskLevel = riskLevel === 'dangerous' ? 'dangerous' : 'suspicious';
        }
      }

      // ── Risk Check 4: Zero-balance token accounts (residual from scams) ──
      if (balance === 0 && !isNative && !TRUSTED_MINTS.has(mint)) {
        riskReasons.push('Empty token account from unknown mint');
        if (riskLevel === 'safe') riskLevel = 'caution';
      }

      // Resolve token metadata (symbol / name)
      const meta = resolveTokenMeta(mint, jupMap);

      // ── Risk Check 5: Suspicious token name (airdrop/claim/free/URL) ──
      if (meta.name && isNameSuspicious(meta.name)) {
        riskReasons.push(`Suspicious token name pattern: "${meta.name}"`);
        if (riskLevel === 'safe' || riskLevel === 'caution') riskLevel = 'suspicious';

        alerts.push({
          id: `airdrop-name-${mint.slice(0, 8)}`,
          timestamp: now,
          type: 'scam_token',
          severity: 'suspicious',
          title: '⚠️ SUSPICIOUS TOKEN NAME',
          description: `Token "${meta.name}" (${meta.symbol}) has a name that matches common scam patterns (airdrop lures, phishing URLs). Do NOT click any links or interact with this token.`,
          tokenMint: mint,
          tokenAccount: tokenPubkey.toBase58(),
          actionRequired: false,
        });
      }

      // ── Risk Check 6: Suspicious symbol (URLs, suspicious keywords) ──
      if (meta.symbol && meta.symbol !== 'UNKNOWN' && isNameSuspicious(meta.symbol)) {
        riskReasons.push(`Suspicious token symbol: "${meta.symbol}"`);
        if (riskLevel === 'safe' || riskLevel === 'caution') riskLevel = 'suspicious';
      }

      accounts.push({
        mint,
        address: tokenPubkey.toBase58(),
        balance,
        decimals,
        delegate,
        delegatedAmount,
        isNative,
        owner,
        riskLevel,
        riskReasons,
        symbol: meta.symbol,
        name: meta.name,
      });
    }

    // ── Check for unexpected airdrop patterns ──
    const unknownTokens = accounts.filter(
      a => !TRUSTED_MINTS.has(a.mint) && a.balance > 0
    );
    if (unknownTokens.length >= 3) {
      alerts.push({
        id: `airdrop-multi-unknown-${now}`,
        timestamp: now,
        type: 'unknown_airdrop',
        severity: 'suspicious',
        title: '🔍 MULTIPLE UNKNOWN TOKENS DETECTED',
        description: `${unknownTokens.length} unknown token types found in your wallet. Multiple unsolicited airdrops are a common tactic used to lure victims into interacting with malicious token contracts. Do not attempt to swap or transfer these tokens without verifying their legitimacy on trusted sources (e.g., Jupiter strict list, Birdeye, Solscan).`,
        actionRequired: false,
      });
    }

    // ── Check total active delegations ──
    const totalDelegations = accounts.filter(a => a.delegate !== null).length;
    if (totalDelegations > 0) {
      alerts.push({
        id: `airdrop-deleg-summary-${now}`,
        timestamp: now,
        type: 'approval_risk',
        severity: totalDelegations >= 3 ? 'dangerous' : 'suspicious',
        title: `🔓 ${totalDelegations} ACTIVE TOKEN DELEGATION${totalDelegations > 1 ? 'S' : ''}`,
        description: `Your wallet has ${totalDelegations} token account${totalDelegations > 1 ? 's' : ''} with active delegations. Each delegation allows a third party to transfer tokens from your account. Revoke all unnecessary delegations immediately to prevent unauthorized transfers.`,
        actionRequired: true,
        actionLabel: 'Revoke All Delegations',
      });
    }

  } catch (err) {
    console.warn('[AirdropGuard] Token scan failed:', err);
  }

  return { accounts, alerts, isCompromised, drainerAddress };
}

/**
 * Check if a specific token mint name looks suspicious.
 */
export function isNameSuspicious(name: string): boolean {
  return SUSPICIOUS_NAME_PATTERNS.some(p => p.test(name));
}

/**
 * Build a transaction to revoke delegation for a specific token account.
 */
export function buildRevokeDelegationTx(
  ownerPublicKey: PublicKey,
  tokenAccountPublicKey: PublicKey,
): Transaction {
  const tx = new Transaction();
  tx.add(
    createRevokeInstruction(
      tokenAccountPublicKey,  // token account
      ownerPublicKey,         // owner
      [],                     // multi-signers (none)
      TOKEN_PROGRAM_ID,
    )
  );
  return tx;
}

/**
 * Build a batch transaction to revoke ALL delegations.
 */
export function buildRevokeAllDelegationsTx(
  ownerPublicKey: PublicKey,
  tokenAccountPublicKeys: PublicKey[],
): Transaction {
  const tx = new Transaction();
  for (const acctKey of tokenAccountPublicKeys) {
    tx.add(
      createRevokeInstruction(
        acctKey,          // token account
        ownerPublicKey,   // owner
        [],               // multi-signers
        TOKEN_PROGRAM_ID,
      )
    );
  }
  return tx;
}

/**
 * Compute overall airdrop risk score based on findings.
 */
export function computeAirdropRiskScore(
  accounts: TokenAccountInfo[],
  alerts: AirdropAlert[],
): { score: number; level: AirdropRisk } {
  if (accounts.length === 0 && alerts.length === 0) {
    return { score: 100, level: 'safe' };
  }

  let deductions = 0;

  // Deduct for alerts
  for (const alert of alerts) {
    switch (alert.type) {
      case 'key_compromise': deductions += 40; break; // Major penalty for confirmed compromise
      case 'sweep_detected': deductions += 20; break; // Sweeper bot evidence
      default:
        switch (alert.severity) {
          case 'dangerous': deductions += 25; break;
          case 'suspicious': deductions += 12; break;
          case 'caution': deductions += 5; break;
        }
    }
  }

  // Deduct for active delegations
  const delegations = accounts.filter(a => a.delegate !== null);
  deductions += delegations.length * 15;

  // Deduct for per-token risk levels (catches tokens w/o explicit alerts)
  for (const acct of accounts) {
    switch (acct.riskLevel) {
      case 'dangerous': deductions += 10; break;
      case 'suspicious': deductions += 6; break;
      case 'caution': deductions += 2; break;
    }
  }

  // Ratio of unknown tokens to total tokens
  const unknownCount = accounts.filter(a => a.symbol === 'UNKNOWN').length;
  if (accounts.length > 0 && unknownCount / accounts.length > 0.5) {
    deductions += 10; // >50% unknown tokens is a red flag
  }

  const score = Math.max(0, 100 - deductions);
  const level: AirdropRisk =
    score >= 80 ? 'safe' :
    score >= 60 ? 'caution' :
    score >= 35 ? 'suspicious' : 'dangerous';

  return { score, level };
}

/**
 * Get display color for risk level.
 */
export function airdropRiskColor(level: AirdropRisk): string {
  switch (level) {
    case 'safe': return '#00FFA3';
    case 'caution': return '#FFD166';
    case 'suspicious': return '#FF8C42';
    case 'dangerous': return '#FF4162';
  }
}

/**
 * Get label for risk level.
 */
export function airdropRiskLabel(level: AirdropRisk): string {
  switch (level) {
    case 'safe': return 'SAFE';
    case 'caution': return 'CAUTION';
    case 'suspicious': return 'SUSPICIOUS';
    case 'dangerous': return 'DANGEROUS';
  }
}

// ── Jupiter Token Metadata Cache ──

interface JupiterTokenMeta {
  symbol: string;
  name: string;
  logoURI?: string;
}

let jupiterTokenMap: Map<string, JupiterTokenMeta> | null = null;
let jupiterFetchPromise: Promise<void> | null = null;

/**
 * Fetch the Jupiter token list once and cache it.
 * Falls back gracefully if the fetch fails.
 */
async function ensureJupiterTokenList(): Promise<Map<string, JupiterTokenMeta>> {
  if (jupiterTokenMap) return jupiterTokenMap;
  if (jupiterFetchPromise) {
    await jupiterFetchPromise;
    return jupiterTokenMap ?? new Map();
  }

  jupiterFetchPromise = (async () => {
    try {
      // Use Jupiter's strict verified token list (smaller, faster)
      const res = await fetch('https://token.jup.ag/strict');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tokens: Array<{ address: string; symbol: string; name: string; logoURI?: string }> = await res.json();
      jupiterTokenMap = new Map();
      for (const t of tokens) {
        jupiterTokenMap.set(t.address, { symbol: t.symbol, name: t.name, logoURI: t.logoURI });
      }
      console.log(`[AirdropGuard] Loaded ${jupiterTokenMap.size} tokens from Jupiter`);
    } catch (err) {
      console.warn('[AirdropGuard] Jupiter token list fetch failed, using local metadata only:', err);
      jupiterTokenMap = new Map();
    }
  })();

  await jupiterFetchPromise;
  return jupiterTokenMap ?? new Map();
}

/**
 * Resolve symbol & name for a mint address.
 * Priority: trusted local map → Jupiter list → fallback "Unknown"
 */
function resolveTokenMeta(mint: string, jupMap: Map<string, JupiterTokenMeta>): { symbol: string; name: string } {
  const trusted = TRUSTED_MINTS_META[mint];
  if (trusted) return trusted;

  const jup = jupMap.get(mint);
  if (jup) return { symbol: jup.symbol, name: jup.name };

  return { symbol: 'UNKNOWN', name: `Unknown Token (${shortenAddr(mint)})` };
}

// ── Utility ──

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export { shortenAddr as shortenAirdropAddress };
