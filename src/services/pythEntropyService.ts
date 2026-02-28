// ── Real Pyth Entropy (Fortuna) Service ──
// Connects to the Pyth Fortuna API to fetch genuine entropy revelations
// and recent on-chain entropy request logs.

const FORTUNA_ENDPOINT = 'https://fortuna.dourolabs.app';

// ── Types matching Fortuna API responses ──

export interface EntropyChain {
  id: string;
}

export interface EntropyRevelation {
  value: {
    data: string;        // hex-encoded random bytes
    encoding: string;    // "hex"
  };
}

export interface EntropyRequestLog {
  chain_id: string;
  network_id: number;
  sequence: number;
  sender: string;
  provider: string;
  request_tx_hash: string;
  request_block_number: number;
  created_at: string;
  last_updated_at: string;
  gas_limit: string;
  user_random_number: string;
  state: EntropyRequestState;
}

export type EntropyRequestState =
  | { state: 'pending' }
  | {
      state: 'completed';
      reveal_block_number: number;
      reveal_tx_hash: string;
      provider_random_number: string;
      combined_random_number: string;  // the actual random output
      gas_used: string;
      callback_failed: boolean;
      callback_gas_used: string;
      callback_return_value: string;
    }
  | { state: 'failed'; reason: string };

export interface EntropyExplorerResponse {
  requests: EntropyRequestLog[];
  total_results: number;
}

// ── Processed types for the dashboard ──

export interface LiveEntropySeed {
  /** Hex string of the random value from Fortuna */
  seed: string;
  /** Shortened display version (0xabcd...ef01) */
  seedShort: string;
  /** Which chain this came from */
  chain: string;
  /** Sequence number on-chain */
  sequence: number;
  /** Transaction hash of the reveal */
  txHash: string;
  /** When this was fulfilled */
  timestamp: string;
  /** Whether this is a real seed from Fortuna or a local fallback */
  isLive: boolean;
}

// ── Cache ──
let cachedChains: string[] = [];
let cachedSeeds: LiveEntropySeed[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 15_000; // refresh every 15s

// ── Fetch supported chains ──
export async function fetchEntropyChains(): Promise<string[]> {
  if (cachedChains.length > 0) return cachedChains;
  try {
    const res = await fetch(`${FORTUNA_ENDPOINT}/v1/chains`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chains: string[] = await res.json();
    cachedChains = chains;
    return chains;
  } catch {
    return [];
  }
}

// ── Fetch recent completed entropy requests from the explorer ──
export async function fetchRecentEntropyLogs(
  limit = 10,
): Promise<LiveEntropySeed[]> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS && cachedSeeds.length > 0) {
    return cachedSeeds;
  }

  try {
    const params = new URLSearchParams({
      limit: String(limit),
      state: 'Completed',
    });
    const res = await fetch(`${FORTUNA_ENDPOINT}/v1/logs?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: EntropyExplorerResponse = await res.json();

    const seeds: LiveEntropySeed[] = data.requests
      .filter(r => r.state.state === 'completed')
      .map(r => {
        const st = r.state as Extract<EntropyRequestState, { state: 'completed' }>;
        const raw = st.combined_random_number;
        const hex = raw.startsWith('0x') ? raw : `0x${raw}`;
        return {
          seed: hex,
          seedShort: `${hex.slice(0, 6)}...${hex.slice(-4)}`,
          chain: r.chain_id,
          sequence: r.sequence,
          txHash: st.reveal_tx_hash,
          timestamp: r.last_updated_at,
          isLive: true,
        };
      });

    cachedSeeds = seeds;
    lastFetchTime = now;
    return seeds;
  } catch {
    // Fallback: return cached or empty
    return cachedSeeds;
  }
}

// ── Get a single entropy seed (latest completed) ──
export async function getLatestEntropySeed(): Promise<LiveEntropySeed> {
  const seeds = await fetchRecentEntropyLogs(5);
  if (seeds.length > 0) return seeds[0];

  // Local fallback if Fortuna is unreachable
  const fallbackHex = '0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return {
    seed: fallbackHex,
    seedShort: `${fallbackHex.slice(0, 6)}...${fallbackHex.slice(-4)}`,
    chain: 'local',
    sequence: 0,
    txHash: '',
    timestamp: new Date().toISOString(),
    isLive: false,
  };
}

// ── Fetch a specific revelation for a chain + sequence ──
export async function fetchRevelation(
  chainId: string,
  sequence: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${FORTUNA_ENDPOINT}/v1/chains/${chainId}/revelations/${sequence}?encoding=hex`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data: EntropyRevelation = await res.json();
    const raw = data.value.data;
    return raw.startsWith('0x') ? raw : `0x${raw}`;
  } catch {
    return null;
  }
}

// ── Deterministic pseudo-random from a hex seed ──
// Use real entropy bytes to seed scenario parameters instead of Math.random()
export function seedToNumber(hexSeed: string, offset = 0): number {
  // Take 8 hex chars starting at offset, convert to a 0-1 float
  const start = 2 + ((offset * 8) % Math.max(1, hexSeed.length - 10));
  const slice = hexSeed.slice(start, start + 8);
  const n = parseInt(slice, 16);
  return (n >>> 0) / 0xFFFFFFFF;
}

// ── Connection status ──
export type EntropyConnectionStatus = 'connecting' | 'live' | 'fallback' | 'error';
