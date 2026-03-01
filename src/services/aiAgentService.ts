// ── AI Agent Service ──
// Optional LLM integration for enhanced agent responses
// Falls back to local response generation if no API key configured

import type { PriceFeed, Position, RiskMetrics } from '../types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Stored in localStorage for user convenience (never sent to our servers)
const API_KEY_STORAGE = 'sentinel1_openai_key';

export function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem(API_KEY_STORAGE, key);
  } catch {
    // Silently fail in restrictive environments
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    // Silently fail
  }
}

export function hasApiKey(): boolean {
  return !!getStoredApiKey();
}

// Build context from current dashboard state
function buildContext(
  feeds: PriceFeed[],
  positions: Position[],
  riskMetrics?: RiskMetrics
): string {
  const feedSummary = feeds.map(f =>
    `${f.symbol}: $${f.price >= 1 ? f.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : f.price.toFixed(4)} ` +
    `(${f.changePercent24h >= 0 ? '+' : ''}${f.changePercent24h.toFixed(2)}%, ` +
    `conf: ±$${f.confidence.toFixed(4)}, EMA: $${f.emaPrice >= 1 ? f.emaPrice.toFixed(2) : f.emaPrice.toFixed(4)})`
  ).join('\n');

  const posSummary = positions.length > 0
    ? positions.map(p =>
        `${p.asset} ${p.side.toUpperCase()} ${p.leverage}x: ` +
        `entry $${p.entryPrice.toFixed(2)} → $${p.currentPrice.toFixed(2)}, ` +
        `PnL: ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)} (${p.pnlPercent.toFixed(2)}%), ` +
        `health: ${p.healthFactor.toFixed(2)}`
      ).join('\n')
    : 'No active positions.';

  const riskSummary = riskMetrics
    ? `Risk Score: ${riskMetrics.overallScore}/100 (${riskMetrics.trend}), ` +
      `Volatility: ${riskMetrics.volatilityIndex.toFixed(1)}%, ` +
      `Correlation: ${riskMetrics.correlationRisk.toFixed(1)}%, ` +
      `Liquidation Proximity: ${riskMetrics.liquidationProximity.toFixed(1)}%`
    : '';

  return `CURRENT MARKET STATE (from Pyth Hermes real-time feeds):
${feedSummary}

PORTFOLIO POSITIONS:
${posSummary}

${riskSummary ? `RISK METRICS:\n${riskSummary}` : ''}`;
}

const SYSTEM_PROMPT = `You are SENTINEL-1, an autonomous AI risk warden for cryptocurrency trading.
You analyze real-time Pyth Network price feeds and manage portfolio risk.
You speak in concise, technical language like a senior quant trader.
Keep responses under 200 words. Use bullet points for clarity.
Reference specific prices, health factors, and risk metrics in your analysis.
When recommending actions, always mention risk/reward tradeoffs.
You have access to live Pyth Hermes price data and the user's portfolio state.`;

export async function getAIResponse(
  query: string,
  feeds: PriceFeed[],
  positions: Position[],
  riskMetrics?: RiskMetrics
): Promise<{ content: string; isAI: boolean }> {
  const apiKey = getStoredApiKey();

  if (!apiKey) {
    return { content: '', isAI: false };
  }

  const context = buildContext(feeds, positions, riskMetrics);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${context}\n\nUser query: ${query}` },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn('AI API error:', response.status, errData);
      return { content: '', isAI: false };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content) {
      return { content, isAI: true };
    }

    return { content: '', isAI: false };
  } catch (err) {
    console.warn('AI API call failed:', err);
    return { content: '', isAI: false };
  }
}
