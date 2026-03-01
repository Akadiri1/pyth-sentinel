// ── Airdrop Guard Service ──
// Protects wallets from malicious airdrop drain attacks.
// Scans SPL token accounts for suspicious delegations, unknown mints,
// and airdropped tokens that may contain hidden drain mechanisms.

import {
  Connection,
  PublicKey,
  Transaction,
  type ParsedAccountData,
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
  type: 'malicious_delegation' | 'scam_token' | 'unknown_airdrop' | 'drain_attempt' | 'approval_risk';
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

// Well-known legitimate token mints (safe list)
const TRUSTED_MINTS = new Set([
  'So11111111111111111111111111111111111111112',  // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // WETH
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',  // RNDR
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',  // bSOL
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
]);

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
 * Scan all SPL token accounts for a wallet and assess airdrop risks.
 */
export async function scanTokenAccounts(
  connection: Connection,
  walletAddress: string,
): Promise<{ accounts: TokenAccountInfo[]; alerts: AirdropAlert[] }> {
  const pubkey = new PublicKey(walletAddress);
  const accounts: TokenAccountInfo[] = [];
  const alerts: AirdropAlert[] = [];
  const now = Date.now();

  try {
    // Fetch all SPL token accounts owned by this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: TOKEN_PROGRAM_ID },
    );

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

  return { accounts, alerts };
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

  for (const alert of alerts) {
    switch (alert.severity) {
      case 'dangerous': deductions += 25; break;
      case 'suspicious': deductions += 12; break;
      case 'caution': deductions += 5; break;
    }
  }

  // Extra deductions for active delegations
  const delegations = accounts.filter(a => a.delegate !== null);
  deductions += delegations.length * 15;

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

// ── Utility ──

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export { shortenAddr as shortenAirdropAddress };
