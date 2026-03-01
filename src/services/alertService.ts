// ── Alert Notification Service ──
// Configurable webhook alerts for Telegram & Discord
// Sends notifications when price thresholds, risk levels, or security events trigger

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'price_above' | 'price_below' | 'price_change' | 'risk_score' | 'security_alert';
  /** Feed symbol for price rules (e.g., 'BTC/USD') */
  feedSymbol?: string;
  /** Threshold value (price for price rules, 0-100 for risk, % for change) */
  threshold: number;
  /** Cooldown in ms to prevent spam */
  cooldownMs: number;
  /** Timestamp of last trigger */
  lastTriggered: number;
}

export interface WebhookConfig {
  /** Unique identifier */
  id: 'telegram' | 'discord' | 'custom';
  enabled: boolean;
  /** Webhook URL */
  url: string;
  /** For Telegram: bot token */
  botToken?: string;
  /** For Telegram: chat ID */
  chatId?: string;
  /** Last successful send timestamp */
  lastSuccess?: number;
  /** Last error message */
  lastError?: string;
}

export interface AlertNotification {
  id: string;
  timestamp: number;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  sent: boolean;
  channel: string;
}

// ── LocalStorage Keys ──
const RULES_KEY = 'sentinel1_alert_rules';
const WEBHOOKS_KEY = 'sentinel1_webhooks';
const HISTORY_KEY = 'sentinel1_alert_history';

// ── Default alert rules ──
export function getDefaultRules(): AlertRule[] {
  return [
    {
      id: 'btc-above-100k',
      name: 'BTC above $100,000',
      enabled: false,
      type: 'price_above',
      feedSymbol: 'BTC/USD',
      threshold: 100000,
      cooldownMs: 300_000,
      lastTriggered: 0,
    },
    {
      id: 'sol-drop-5pct',
      name: 'SOL drops 5%',
      enabled: false,
      type: 'price_change',
      feedSymbol: 'SOL/USD',
      threshold: -5,
      cooldownMs: 600_000,
      lastTriggered: 0,
    },
    {
      id: 'risk-critical',
      name: 'Risk score > 75',
      enabled: false,
      type: 'risk_score',
      threshold: 75,
      cooldownMs: 300_000,
      lastTriggered: 0,
    },
    {
      id: 'security-critical',
      name: 'Security alert (critical)',
      enabled: false,
      type: 'security_alert',
      threshold: 0,
      cooldownMs: 60_000,
      lastTriggered: 0,
    },
  ];
}

// ── Default webhook configs ──
export function getDefaultWebhooks(): WebhookConfig[] {
  return [
    { id: 'telegram', enabled: false, url: '', botToken: '', chatId: '' },
    { id: 'discord', enabled: false, url: '' },
    { id: 'custom', enabled: false, url: '' },
  ];
}

// ── Persistence ──

export function loadRules(): AlertRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return getDefaultRules();
}

export function saveRules(rules: AlertRule[]): void {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function loadWebhooks(): WebhookConfig[] {
  try {
    const raw = localStorage.getItem(WEBHOOKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return getDefaultWebhooks();
}

export function saveWebhooks(configs: WebhookConfig[]): void {
  localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(configs));
}

export function loadAlertHistory(): AlertNotification[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveAlertHistory(history: AlertNotification[]): void {
  // Keep only last 100 alerts
  const trimmed = history.slice(-100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

// ── Webhook Senders ──

async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram error: ${response.status} ${err}`);
  }
}

async function sendDiscordWebhook(webhookUrl: string, message: string, severity: string): Promise<void> {
  const colorMap: Record<string, number> = {
    info: 0x05D2DD,      // cyan
    warning: 0xFFD700,    // yellow
    critical: 0xFF4162,   // red
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: '🛡️ SENTINEL-1 Alert',
        description: message,
        color: colorMap[severity] || 0xAB87FF,
        footer: { text: 'Sentinel-1 · Pyth Network' },
        timestamp: new Date().toISOString(),
      }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Discord error: ${response.status}`);
  }
}

async function sendCustomWebhook(url: string, message: string, severity: string): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'sentinel-1',
      severity,
      message,
      timestamp: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Webhook error: ${response.status}`);
  }
}

/** Send an alert to all enabled webhooks */
export async function sendAlert(
  webhooks: WebhookConfig[],
  message: string,
  severity: 'info' | 'warning' | 'critical',
): Promise<{ sent: string[]; errors: Record<string, string> }> {
  const sent: string[] = [];
  const errors: Record<string, string> = {};

  for (const wh of webhooks) {
    if (!wh.enabled || !wh.url) continue;

    try {
      if (wh.id === 'telegram' && wh.botToken && wh.chatId) {
        await sendTelegramMessage(wh.botToken, wh.chatId, message);
        sent.push('telegram');
      } else if (wh.id === 'discord') {
        await sendDiscordWebhook(wh.url, message, severity);
        sent.push('discord');
      } else if (wh.id === 'custom') {
        await sendCustomWebhook(wh.url, message, severity);
        sent.push('custom');
      }
    } catch (err) {
      errors[wh.id] = err instanceof Error ? err.message : String(err);
    }
  }

  return { sent, errors };
}

/** Format an alert message */
export function formatAlertMessage(
  ruleName: string,
  details: string,
  severity: string,
): string {
  const icon = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : '🔵';
  return `${icon} <b>SENTINEL-1 Alert</b>\n\n<b>${ruleName}</b>\n${details}\n\n⏰ ${new Date().toLocaleString()}`;
}

/** Test webhook connection */
export async function testWebhook(webhook: WebhookConfig): Promise<{ ok: boolean; error?: string }> {
  const testMessage = '🧪 <b>SENTINEL-1 Connection Test</b>\n\nWebhook is working correctly!\nYou will receive alerts here when configured rules trigger.';
  
  try {
    if (webhook.id === 'telegram' && webhook.botToken && webhook.chatId) {
      await sendTelegramMessage(webhook.botToken, webhook.chatId, testMessage);
    } else if (webhook.id === 'discord' && webhook.url) {
      await sendDiscordWebhook(webhook.url, 'Webhook test successful! You will receive SENTINEL-1 alerts here.', 'info');
    } else if (webhook.id === 'custom' && webhook.url) {
      await sendCustomWebhook(webhook.url, 'Webhook test from SENTINEL-1', 'info');
    } else {
      return { ok: false, error: 'Missing configuration' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
