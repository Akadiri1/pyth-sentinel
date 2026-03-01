// ── Wallet Security Service ──
// Monitors connected wallet for suspicious activity, dusting attacks,
// unknown program approvals, and high-risk address interactions.

import { Connection, PublicKey, type ConfirmedSignatureInfo, type ParsedTransactionWithMeta } from '@solana/web3.js';

// ── Types ──

export type ThreatLevel = 'safe' | 'info' | 'warning' | 'critical';

export interface SecurityAlert {
  id: string;
  timestamp: number;
  type: 'large_outflow' | 'dust_attack' | 'unknown_program' | 'flagged_address' | 'rapid_drains' | 'token_approval' | 'anomaly';
  level: ThreatLevel;
  title: string;
  description: string;
  txSignature?: string;
  amount?: number;
  counterparty?: string;
  programId?: string;
  dismissed: boolean;
}

export interface WalletSecurityState {
  overallRisk: ThreatLevel;
  securityScore: number; // 0–100 (100 = safe)
  alerts: SecurityAlert[];
  recentTxCount: number;
  lastScanTime: number;
  isScanning: boolean;
  totalOutflow24h: number;
  totalInflow24h: number;
  uniqueInteractions: number;
  dustTokenCount: number;
}

export interface TransactionAnalysis {
  signature: string;
  timestamp: number;
  type: 'outflow' | 'inflow' | 'program_interaction' | 'token_transfer' | 'unknown';
  amount: number; // in SOL or token units
  counterparty: string;
  programIds: string[];
  isSuspicious: boolean;
  suspicionReasons: string[];
}

// ── Known-Bad Address Database (Community-sourced) ──
// In production, this would be fetched from an API like Nominis, SolanaGuard, or Blowfish
const FLAGGED_ADDRESSES = new Set([
  // Known scam/drainer addresses (examples — not real)
  'ScamWa11etDrainer1111111111111111111111111',
  'PhishAttack222222222222222222222222222222',
  'DustBotSpam333333333333333333333333333333',
]);

// Known system / safe program IDs
const KNOWN_PROGRAMS = new Map<string, string>([
  ['11111111111111111111111111111111', 'System Program'],
  ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'Token Program'],
  ['TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', 'Token-2022'],
  ['ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', 'Associated Token'],
  ['ComputeBudget111111111111111111111111111111', 'Compute Budget'],
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'Jupiter v6'],
  ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', 'Orca Whirlpool'],
  ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium AMM'],
  ['srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', 'Serum DEX'],
  ['metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', 'Metaplex Metadata'],
  ['PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', 'Phoenix DEX'],
  ['DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', 'Orca Legacy'],
  ['MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', 'Memo Program'],
  ['Memo1UhkJBfCR6MNMghtTW6jNryMo1a7jSTKsMEE2RGH', 'Memo v1'],
  ['Vote111111111111111111111111111111111111111', 'Vote Program'],
  ['Stake11111111111111111111111111111111111111', 'Stake Program'],
]);

// ── Dust Attack Thresholds ──
const DUST_THRESHOLD_SOL = 0.001; // <0.001 SOL = likely dust
const LARGE_OUTFLOW_THRESHOLD_PCT = 0.05; // 5% of balance
const RAPID_DRAIN_WINDOW_MS = 5 * 60_000; // 5 minutes
const RAPID_DRAIN_TX_COUNT = 3; // 3+ outflows in 5 min = suspicious

// ── Core Analysis Functions ──

/**
 * Fetch and analyze recent transactions for a wallet address.
 */
export async function analyzeWalletTransactions(
  connection: Connection,
  walletAddress: string,
  walletBalance: number,
  limit: number = 50,
): Promise<{ analyses: TransactionAnalysis[]; alerts: SecurityAlert[] }> {
  const pubkey = new PublicKey(walletAddress);
  const analyses: TransactionAnalysis[] = [];
  const alerts: SecurityAlert[] = [];

  try {
    // Fetch recent signatures
    const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
      pubkey,
      { limit },
    );

    if (signatures.length === 0) {
      return { analyses, alerts };
    }

    // Batch fetch parsed transactions (max 10 at a time to respect rate limits)
    const batchSize = 10;
    const parsedTxs: (ParsedTransactionWithMeta | null)[] = [];

    for (let i = 0; i < Math.min(signatures.length, limit); i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const results = await connection.getParsedTransactions(
        batch.map(s => s.signature),
        { maxSupportedTransactionVersion: 0 },
      );
      parsedTxs.push(...results);
    }

    // Analyze each transaction
    const now = Date.now();
    const recentOutflows: number[] = []; // timestamps of recent outflows

    for (let i = 0; i < parsedTxs.length; i++) {
      const tx = parsedTxs[i];
      const sig = signatures[i];
      if (!tx || !sig) continue;

      const analysis = analyzeTransaction(tx, sig, walletAddress);
      analyses.push(analysis);

      // Check for suspicious patterns
      if (analysis.isSuspicious) {
        for (const reason of analysis.suspicionReasons) {
          alerts.push(createAlert(analysis, reason, walletBalance));
        }
      }

      // Track outflow timing for rapid drain detection
      if (analysis.type === 'outflow' && analysis.timestamp > 0) {
        recentOutflows.push(analysis.timestamp * 1000);
      }
    }

    // Detect rapid drain pattern
    const recentWindow = recentOutflows.filter(t => now - t < RAPID_DRAIN_WINDOW_MS);
    if (recentWindow.length >= RAPID_DRAIN_TX_COUNT) {
      alerts.push({
        id: `alert-rapid-${now}`,
        timestamp: now,
        type: 'rapid_drains',
        level: 'critical',
        title: 'RAPID DRAIN PATTERN DETECTED',
        description: `${recentWindow.length} outgoing transactions detected within ${Math.round(RAPID_DRAIN_WINDOW_MS / 60000)} minutes. This pattern is consistent with automated wallet draining. Recommend immediate fund transfer to a new wallet.`,
        dismissed: false,
      });
    }

    // Detect dust attacks
    const dustTxs = analyses.filter(
      a => a.type === 'inflow' && a.amount > 0 && a.amount < DUST_THRESHOLD_SOL
    );
    if (dustTxs.length >= 2) {
      alerts.push({
        id: `alert-dust-${now}`,
        timestamp: now,
        type: 'dust_attack',
        level: 'warning',
        title: 'DUST/POISONING ATTACK DETECTED',
        description: `${dustTxs.length} micro-transactions (<${DUST_THRESHOLD_SOL} SOL) received from ${new Set(dustTxs.map(d => d.counterparty)).size} unique addresses. These may be address-poisoning attempts designed to trick you into sending funds to a lookalike address. Do NOT copy addresses from recent transaction history.`,
        dismissed: false,
      });
    }

    // Check large outflows
    const largeOutflows = analyses.filter(
      a => a.type === 'outflow' && a.amount > walletBalance * LARGE_OUTFLOW_THRESHOLD_PCT
    );
    for (const outflow of largeOutflows) {
      if (!alerts.some(a => a.txSignature === outflow.signature)) {
        alerts.push({
          id: `alert-outflow-${outflow.signature.slice(0, 8)}`,
          timestamp: outflow.timestamp * 1000,
          type: 'large_outflow',
          level: 'warning',
          title: 'LARGE OUTFLOW DETECTED',
          description: `${outflow.amount.toFixed(4)} SOL sent to ${shortenAddress(outflow.counterparty)}. This exceeds ${(LARGE_OUTFLOW_THRESHOLD_PCT * 100).toFixed(0)}% of current balance. Verify this was intentional.`,
          txSignature: outflow.signature,
          amount: outflow.amount,
          counterparty: outflow.counterparty,
          dismissed: false,
        });
      }
    }

  } catch (err) {
    console.warn('[WalletSecurity] Analysis failed:', err);
  }

  return { analyses, alerts };
}

/**
 * Analyze a single parsed transaction for threats.
 */
function analyzeTransaction(
  tx: ParsedTransactionWithMeta,
  sig: ConfirmedSignatureInfo,
  walletAddress: string,
): TransactionAnalysis {
  const suspicionReasons: string[] = [];
  let type: TransactionAnalysis['type'] = 'unknown';
  let amount = 0;
  let counterparty = '';
  const programIds: string[] = [];

  // Extract program IDs
  if (tx.transaction?.message?.accountKeys) {
    for (const key of tx.transaction.message.accountKeys) {
      const addr = typeof key === 'string' ? key : key.pubkey.toBase58();
      // Check if it's a program invocation
      if (tx.transaction.message.instructions) {
        for (const ix of tx.transaction.message.instructions) {
          const progId = 'programId' in ix ? ix.programId.toBase58() : '';
          if (progId && !programIds.includes(progId)) {
            programIds.push(progId);
          }
        }
      }
    }
  }

  // Analyze balance changes
  const preBalances = tx.meta?.preBalances ?? [];
  const postBalances = tx.meta?.postBalances ?? [];
  const accountKeys = tx.transaction?.message?.accountKeys ?? [];

  for (let i = 0; i < accountKeys.length; i++) {
    const key = accountKeys[i];
    const addr: string = typeof key === 'string' ? key : key.pubkey.toBase58();

    if (addr === walletAddress) {
      const diff = ((postBalances[i] ?? 0) - (preBalances[i] ?? 0)) / 1e9; // lamports → SOL
      if (diff < -0.000005) { // outflow (excluding fee)
        type = 'outflow';
        amount = Math.abs(diff);
      } else if (diff > 0.000001) {
        type = 'inflow';
        amount = diff;
      }
    } else if (type !== 'unknown' && !counterparty) {
      counterparty = addr;
    }
  }

  // Check for interactions with unknown programs
  for (const progId of programIds) {
    if (!KNOWN_PROGRAMS.has(progId)) {
      suspicionReasons.push(`unknown_program:${progId}`);
    }
  }

  // Check for interactions with flagged addresses
  for (let i = 0; i < accountKeys.length; i++) {
    const key = accountKeys[i];
    const addr: string = typeof key === 'string' ? key : key.pubkey.toBase58();
    if (FLAGGED_ADDRESSES.has(addr)) {
      suspicionReasons.push(`flagged_address:${addr}`);
    }
  }

  // Dust detection per-tx
  if (type === 'inflow' && amount > 0 && amount < DUST_THRESHOLD_SOL) {
    suspicionReasons.push('dust_transaction');
  }

  return {
    signature: sig.signature,
    timestamp: sig.blockTime ?? 0,
    type,
    amount,
    counterparty,
    programIds,
    isSuspicious: suspicionReasons.length > 0,
    suspicionReasons,
  };
}

/**
 * Create a SecurityAlert from a suspicious transaction analysis.
 */
function createAlert(
  analysis: TransactionAnalysis,
  reason: string,
  _walletBalance: number,
): SecurityAlert {
  const now = Date.now();

  if (reason.startsWith('unknown_program:')) {
    const progId = reason.replace('unknown_program:', '');
    return {
      id: `alert-prog-${analysis.signature.slice(0, 8)}`,
      timestamp: analysis.timestamp * 1000 || now,
      type: 'unknown_program',
      level: 'warning',
      title: 'UNKNOWN PROGRAM INTERACTION',
      description: `Transaction interacted with unrecognized program ${shortenAddress(progId)}. This may be a legitimate DeFi protocol or a malicious contract. Verify on Solscan before further interaction.`,
      txSignature: analysis.signature,
      programId: progId,
      dismissed: false,
    };
  }

  if (reason.startsWith('flagged_address:')) {
    const addr = reason.replace('flagged_address:', '');
    return {
      id: `alert-flagged-${analysis.signature.slice(0, 8)}`,
      timestamp: analysis.timestamp * 1000 || now,
      type: 'flagged_address',
      level: 'critical',
      title: 'FLAGGED ADDRESS INTERACTION',
      description: `Transaction involved address ${shortenAddress(addr)} which is flagged in community security databases as a known scam/drainer. If you did not authorize this, transfer remaining funds to a new wallet immediately.`,
      txSignature: analysis.signature,
      counterparty: addr,
      dismissed: false,
    };
  }

  if (reason === 'dust_transaction') {
    return {
      id: `alert-dust-tx-${analysis.signature.slice(0, 8)}`,
      timestamp: analysis.timestamp * 1000 || now,
      type: 'dust_attack',
      level: 'info',
      title: 'MICRO-TRANSACTION RECEIVED',
      description: `Received ${analysis.amount.toFixed(6)} SOL from ${shortenAddress(analysis.counterparty)}. This may be a dusting/poisoning attempt. Avoid copying addresses from these transactions.`,
      txSignature: analysis.signature,
      amount: analysis.amount,
      counterparty: analysis.counterparty,
      dismissed: false,
    };
  }

  return {
    id: `alert-generic-${analysis.signature.slice(0, 8)}`,
    timestamp: analysis.timestamp * 1000 || now,
    type: 'anomaly',
    level: 'info',
    title: 'ANOMALOUS TRANSACTION',
    description: `Unusual transaction pattern detected: ${reason}`,
    txSignature: analysis.signature,
    dismissed: false,
  };
}

// ── Compute Overall Security Score ──

export function computeSecurityScore(alerts: SecurityAlert[]): { score: number; level: ThreatLevel } {
  const activeAlerts = alerts.filter(a => !a.dismissed);

  if (activeAlerts.length === 0) {
    return { score: 100, level: 'safe' };
  }

  let deductions = 0;

  for (const alert of activeAlerts) {
    switch (alert.level) {
      case 'critical': deductions += 30; break;
      case 'warning': deductions += 15; break;
      case 'info': deductions += 5; break;
    }
  }

  const score = Math.max(0, 100 - deductions);
  const level: ThreatLevel =
    score >= 80 ? 'safe' :
    score >= 60 ? 'info' :
    score >= 35 ? 'warning' : 'critical';

  return { score, level };
}

// ── Utility ──

export function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function getProgramName(programId: string): string {
  return KNOWN_PROGRAMS.get(programId) ?? 'Unknown Program';
}

export function threatLevelColor(level: ThreatLevel): string {
  switch (level) {
    case 'safe': return '#00FFA3';
    case 'info': return '#6E56CF';
    case 'warning': return '#FFD166';
    case 'critical': return '#FF4162';
  }
}

export function threatLevelLabel(level: ThreatLevel): string {
  switch (level) {
    case 'safe': return 'SECURE';
    case 'info': return 'ADVISORY';
    case 'warning': return 'WARNING';
    case 'critical': return 'CRITICAL';
  }
}
