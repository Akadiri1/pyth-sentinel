// ── Extended Price History Service ──
// Stores detailed price history with timestamps for historical charts
// Separate from the 24-point sparkline used in PriceTicker cards

export interface PricePoint {
  timestamp: number; // ms
  price: number;
  confidence: number;
  emaPrice: number;
}

export interface OHLCBar {
  timestamp: number; // ms (bar open time)
  open: number;
  high: number;
  low: number;
  close: number;
  confidence: number; // avg confidence during bar
}

// ── In-memory price history store ──
const extendedHistory: Map<string, PricePoint[]> = new Map();
const MAX_HISTORY_POINTS = 600; // ~10 minutes at 1 update/sec via SSE

/** Record a new price point for a feed */
export function recordPricePoint(
  feedId: string,
  price: number,
  confidence: number,
  emaPrice: number,
): void {
  const cleanId = feedId.replace(/^0x/, '');
  const points = extendedHistory.get(cleanId) || [];
  points.push({ timestamp: Date.now(), price, confidence, emaPrice });
  // Trim to max length
  if (points.length > MAX_HISTORY_POINTS) {
    points.splice(0, points.length - MAX_HISTORY_POINTS);
  }
  extendedHistory.set(cleanId, points);
}

/** Get raw price history for a feed */
export function getPriceHistory(feedId: string): PricePoint[] {
  const cleanId = feedId.replace(/^0x/, '');
  return extendedHistory.get(cleanId) || [];
}

/** Get all feed IDs with history */
export function getHistoryFeedIds(): string[] {
  return Array.from(extendedHistory.keys());
}

/** Aggregate price points into OHLC bars */
export function aggregateOHLC(
  feedId: string,
  barDurationMs: number = 60_000, // default 1-minute bars
): OHLCBar[] {
  const points = getPriceHistory(feedId);
  if (points.length === 0) return [];

  const bars: OHLCBar[] = [];
  let barStart = Math.floor(points[0].timestamp / barDurationMs) * barDurationMs;
  let open = points[0].price;
  let high = points[0].price;
  let low = points[0].price;
  let close = points[0].price;
  let confSum = points[0].confidence;
  let confCount = 1;

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    const ptBar = Math.floor(pt.timestamp / barDurationMs) * barDurationMs;

    if (ptBar !== barStart) {
      // Close current bar
      bars.push({
        timestamp: barStart,
        open,
        high,
        low,
        close,
        confidence: confSum / confCount,
      });

      // Start new bar
      barStart = ptBar;
      open = pt.price;
      high = pt.price;
      low = pt.price;
      close = pt.price;
      confSum = pt.confidence;
      confCount = 1;
    } else {
      high = Math.max(high, pt.price);
      low = Math.min(low, pt.price);
      close = pt.price;
      confSum += pt.confidence;
      confCount++;
    }
  }

  // Push last bar
  bars.push({
    timestamp: barStart,
    open,
    high,
    low,
    close,
    confidence: confSum / confCount,
  });

  return bars;
}

/** Get price stats for a feed */
export function getPriceStats(feedId: string): {
  min: number;
  max: number;
  avg: number;
  stdDev: number;
  count: number;
  durationMs: number;
} | null {
  const points = getPriceHistory(feedId);
  if (points.length < 2) return null;

  const prices = points.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + (p - avg) ** 2, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const durationMs = points[points.length - 1].timestamp - points[0].timestamp;

  return { min, max, avg, stdDev, count: points.length, durationMs };
}
