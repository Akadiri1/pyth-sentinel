// ── Real Pyth Hermes Data Service ──
// Connects to Pyth Hermes API for live production price feeds

import type { PriceFeed } from '../types';
import { recordPricePoint } from './priceHistoryService';

// ── Real Pyth Mainnet Feed IDs ──
export const PYTH_FEEDS = [
  {
    id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    symbol: 'BTC/USD',
    name: 'Bitcoin',
    category: 'crypto' as const,
  },
  {
    id: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    symbol: 'ETH/USD',
    name: 'Ethereum',
    category: 'crypto' as const,
  },
  {
    id: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    symbol: 'SOL/USD',
    name: 'Solana',
    category: 'crypto' as const,
  },
  {
    id: '0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff',
    symbol: 'PYTH/USD',
    name: 'Pyth Network',
    category: 'crypto' as const,
  },
  {
    id: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
    symbol: 'LINK/USD',
    name: 'Chainlink',
    category: 'crypto' as const,
  },
  {
    id: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
    symbol: 'AVAX/USD',
    name: 'Avalanche',
    category: 'crypto' as const,
  },
  {
    id: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    symbol: 'USDT/USD',
    name: 'Tether',
    category: 'crypto' as const,
  },
  {
    id: '0xc96458d393fe9deb7a7d63a0ac41e2898a67a7750dbd166673279e06c868df0a',
    symbol: 'DOGE/USD',
    name: 'Dogecoin',
    category: 'crypto' as const,
  },
];

const HERMES_ENDPOINT = 'https://hermes.pyth.network';

// ── Parse Pyth price from raw integer + exponent ──
function parsePythPrice(priceStr: string, expo: number): number {
  return Number(priceStr) * Math.pow(10, expo);
}

// ── Parsed price update shape from Hermes API ──
interface HermesParsedUpdate {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  metadata?: {
    prev_publish_time?: number | null;
    proof_available_time?: number | null;
    slot?: number | null;
  };
}

interface HermesResponse {
  binary: { data: string[]; encoding: string };
  parsed: HermesParsedUpdate[];
}

// ── Sparkline history store (we accumulate real prices in memory) ──
const priceHistory: Map<string, number[]> = new Map();
const SPARKLINE_LENGTH = 24;

function updateSparkline(feedId: string, price: number): number[] {
  const history = priceHistory.get(feedId) || [];
  history.push(price);
  if (history.length > SPARKLINE_LENGTH) {
    history.splice(0, history.length - SPARKLINE_LENGTH);
  }
  priceHistory.set(feedId, history);
  const padded = [...history];
  while (padded.length < SPARKLINE_LENGTH) {
    padded.unshift(padded[0]);
  }
  return padded;
}

// ── Track previous prices for change detection ──
const previousPrices: Map<string, number> = new Map();
const initialPrices: Map<string, number> = new Map();

// ── Convert Hermes parsed update → our PriceFeed type ──
function hermesToPriceFeed(update: HermesParsedUpdate): PriceFeed | null {
  const cleanId = update.id.replace(/^0x/, '');
  const feedConfig = PYTH_FEEDS.find(f => f.id.replace(/^0x/, '') === cleanId);
  if (!feedConfig) return null;

  const price = parsePythPrice(update.price.price, update.price.expo);
  const confidence = parsePythPrice(update.price.conf, update.price.expo);
  const emaPrice = parsePythPrice(update.ema_price.price, update.ema_price.expo);

  const prevPrice = previousPrices.get(cleanId) || price;
  previousPrices.set(cleanId, price);

  if (!initialPrices.has(cleanId)) {
    initialPrices.set(cleanId, price);
  }
  const firstPrice = initialPrices.get(cleanId) || price;
  const change = price - firstPrice;
  const changePercent = firstPrice !== 0 ? (change / firstPrice) * 100 : 0;

  const sparkline = updateSparkline(cleanId, price);

  // Record to extended history for historical charts
  recordPricePoint(feedConfig.id, price, confidence, emaPrice);

  return {
    id: feedConfig.id,
    symbol: feedConfig.symbol,
    name: feedConfig.name,
    category: feedConfig.category,
    price,
    previousPrice: prevPrice,
    change24h: change,
    changePercent24h: changePercent,
    confidence,
    publishTime: update.price.publish_time * 1000,
    emaPrice,
    high24h: Math.max(...sparkline),
    low24h: Math.min(...sparkline),
    volume24h: 0,
    sparkline,
  };
}

// ── Fetch latest prices via REST ──
export async function fetchLatestPrices(): Promise<PriceFeed[]> {
  const ids = PYTH_FEEDS.map(f => f.id.replace(/^0x/, ''));
  const url = new URL(`${HERMES_ENDPOINT}/v2/updates/price/latest`);
  ids.forEach(id => url.searchParams.append('ids[]', id));
  url.searchParams.set('parsed', 'true');
  url.searchParams.set('ignore_invalid_price_ids', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
    }

    const data: HermesResponse = await response.json();
    const feeds: PriceFeed[] = [];

    for (const update of data.parsed) {
      const feed = hermesToPriceFeed(update);
      if (feed) feeds.push(feed);
    }

    return feeds;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Callback types ──
export type PriceUpdateCallback = (feeds: PriceFeed[]) => void;
export type ConnectionStatusCallback = (status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;

// ── SSE Streaming with REST fallback ──
// PRIMARY: Server-Sent Events stream from /v2/updates/price/stream
// FALLBACK: REST polling every 1.5s from /v2/updates/price/latest
export function createResilientPoller(
  onUpdate: PriceUpdateCallback,
  onStatus: ConnectionStatusCallback,
  intervalMs = 1500,
): () => void {
  let active = true;
  let eventSource: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let consecutiveFailures = 0;
  const MAX_FAILURES = 10;

  onStatus('connecting');

  // ── Attempt SSE stream first ──
  function startSSE() {
    if (!active) return;

    const ids = PYTH_FEEDS.map(f => f.id.replace(/^0x/, ''));
    const url = new URL(`${HERMES_ENDPOINT}/v2/updates/price/stream`);
    ids.forEach(id => url.searchParams.append('ids[]', id));
    url.searchParams.set('parsed', 'true');
    url.searchParams.set('allow_unordered', 'true');
    url.searchParams.set('benchmarks_only', 'false');

    try {
      eventSource = new EventSource(url.toString());

      eventSource.onopen = () => {
        if (!active) return;
        consecutiveFailures = 0;
        onStatus('connected');
        console.log('[Sentinel-1] SSE stream connected to Pyth Hermes');
      };

      eventSource.onmessage = (event) => {
        if (!active) return;
        try {
          const data: HermesResponse = JSON.parse(event.data);
          const feeds: PriceFeed[] = [];
          for (const update of data.parsed) {
            const feed = hermesToPriceFeed(update);
            if (feed) feeds.push(feed);
          }
          if (feeds.length > 0) {
            consecutiveFailures = 0;
            onStatus('connected');
            onUpdate(feeds);
          }
        } catch (parseErr) {
          console.warn('[Sentinel-1] SSE parse error:', parseErr);
        }
      };

      eventSource.onerror = () => {
        if (!active) return;
        consecutiveFailures++;
        console.warn(`[Sentinel-1] SSE error (${consecutiveFailures}/${MAX_FAILURES})`);

        // Close broken SSE and fall back to REST polling
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        if (consecutiveFailures < MAX_FAILURES) {
          console.log('[Sentinel-1] Falling back to REST polling');
          startRESTPolling();
        } else {
          onStatus('error');
        }
      };
    } catch (err) {
      console.warn('[Sentinel-1] SSE init failed, using REST polling:', err);
      startRESTPolling();
    }
  }

  // ── Fallback REST polling ──
  function startRESTPolling() {
    if (!active || pollTimer) return;

    const poll = async () => {
      if (!active) return;
      try {
        const feeds = await fetchLatestPrices();
        if (!active) return;
        consecutiveFailures = 0;
        onStatus('connected');
        onUpdate(feeds);
      } catch (err) {
        if (!active) return;
        consecutiveFailures++;
        console.warn(`[Sentinel-1] Poll failed (${consecutiveFailures}/${MAX_FAILURES}):`, err);
        if (consecutiveFailures >= MAX_FAILURES) {
          onStatus('error');
        }
      }
    };

    poll();
    pollTimer = setInterval(poll, intervalMs);
  }

  // Start with SSE
  startSSE();

  return () => {
    active = false;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    onStatus('disconnected');
  };
}
