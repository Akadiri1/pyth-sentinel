// ── Alert Notifications Panel ──
// Configure webhook alerts for Telegram, Discord, and custom endpoints

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellRing,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  TestTube2,
  Settings,
  History,
  Zap,
} from 'lucide-react';
import {
  loadRules,
  saveRules,
  loadWebhooks,
  saveWebhooks,
  loadAlertHistory,
  saveAlertHistory,
  testWebhook,
  sendAlert,
  formatAlertMessage,
  type AlertRule,
  type WebhookConfig,
  type AlertNotification,
} from '../services/alertService';
import type { PriceFeed, RiskMetrics } from '../types';
import InfoTooltip from './InfoTooltip';

interface AlertNotificationsPanelProps {
  feeds: PriceFeed[];
  riskMetrics: RiskMetrics;
  securityAlertCount: number;
}

type Tab = 'rules' | 'webhooks' | 'history';

export default memo(function AlertNotificationsPanel({
  feeds,
  riskMetrics,
  securityAlertCount,
}: AlertNotificationsPanelProps) {
  const [rules, setRules] = useState<AlertRule[]>(loadRules);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(loadWebhooks);
  const [history, setHistory] = useState<AlertNotification[]>(loadAlertHistory);
  const [activeTab, setActiveTab] = useState<Tab>('rules');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; error?: string } | null>(null);

  // Save on changes
  useEffect(() => { saveRules(rules); }, [rules]);
  useEffect(() => { saveWebhooks(webhooks); }, [webhooks]);
  useEffect(() => { saveAlertHistory(history); }, [history]);

  // ── Rule evaluation engine ──
  useEffect(() => {
    if (feeds.length === 0) return;

    const now = Date.now();
    const enabledWebhooks = webhooks.filter(w => w.enabled);
    if (enabledWebhooks.length === 0) return;

    const updatedRules = [...rules];
    let changed = false;

    for (const rule of updatedRules) {
      if (!rule.enabled) continue;
      if (now - rule.lastTriggered < rule.cooldownMs) continue;

      let triggered = false;
      let details = '';
      let severity: 'info' | 'warning' | 'critical' = 'info';

      switch (rule.type) {
        case 'price_above': {
          const feed = feeds.find(f => f.symbol === rule.feedSymbol);
          if (feed && feed.price > rule.threshold) {
            triggered = true;
            details = `${feed.symbol} is at $${feed.price.toLocaleString()} (above $${rule.threshold.toLocaleString()})`;
            severity = 'warning';
          }
          break;
        }
        case 'price_below': {
          const feed = feeds.find(f => f.symbol === rule.feedSymbol);
          if (feed && feed.price < rule.threshold) {
            triggered = true;
            details = `${feed.symbol} is at $${feed.price.toLocaleString()} (below $${rule.threshold.toLocaleString()})`;
            severity = 'warning';
          }
          break;
        }
        case 'price_change': {
          const feed = feeds.find(f => f.symbol === rule.feedSymbol);
          if (feed) {
            const change = feed.changePercent24h;
            if (rule.threshold < 0 && change <= rule.threshold) {
              triggered = true;
              details = `${feed.symbol} dropped ${change.toFixed(2)}% (threshold: ${rule.threshold}%)`;
              severity = 'critical';
            } else if (rule.threshold > 0 && change >= rule.threshold) {
              triggered = true;
              details = `${feed.symbol} gained ${change.toFixed(2)}% (threshold: +${rule.threshold}%)`;
              severity = 'info';
            }
          }
          break;
        }
        case 'risk_score': {
          if (riskMetrics.overallScore > rule.threshold) {
            triggered = true;
            details = `Risk score is ${riskMetrics.overallScore.toFixed(1)} (threshold: ${rule.threshold})`;
            severity = riskMetrics.overallScore > 85 ? 'critical' : 'warning';
          }
          break;
        }
        case 'security_alert': {
          if (securityAlertCount > 0) {
            triggered = true;
            details = `${securityAlertCount} critical security alert${securityAlertCount > 1 ? 's' : ''} detected`;
            severity = 'critical';
          }
          break;
        }
      }

      if (triggered) {
        changed = true;
        rule.lastTriggered = now;

        const message = formatAlertMessage(rule.name, details, severity);

        // Send asynchronously (don't block)
        sendAlert(enabledWebhooks, message, severity).then(({ sent, errors }) => {
          const notification: AlertNotification = {
            id: `${rule.id}-${now}`,
            timestamp: now,
            ruleId: rule.id,
            ruleName: rule.name,
            message: details,
            severity,
            sent: sent.length > 0,
            channel: sent.length > 0 ? sent.join(', ') : Object.keys(errors).join(', '),
          };
          setHistory(prev => [...prev, notification].slice(-100));
        });
      }
    }

    if (changed) {
      setRules(updatedRules);
    }
  }, [feeds, riskMetrics, securityAlertCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──

  const handleToggleRule = useCallback((id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, []);

  const handleDeleteRule = useCallback((id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleAddRule = useCallback(() => {
    const newRule: AlertRule = {
      id: `custom-${Date.now()}`,
      name: 'New Alert Rule',
      enabled: false,
      type: 'price_above',
      feedSymbol: feeds[0]?.symbol || 'BTC/USD',
      threshold: 0,
      cooldownMs: 300_000,
      lastTriggered: 0,
    };
    setRules(prev => [...prev, newRule]);
  }, [feeds]);

  const handleUpdateRule = useCallback((id: string, updates: Partial<AlertRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const handleUpdateWebhook = useCallback((id: string, updates: Partial<WebhookConfig>) => {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  const handleTestWebhook = useCallback(async (wh: WebhookConfig) => {
    setTesting(wh.id);
    setTestResult(null);
    const result = await testWebhook(wh);
    setTestResult({ id: wh.id, ...result });
    setTesting(null);
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveAlertHistory([]);
  }, []);

  const enabledRuleCount = rules.filter(r => r.enabled).length;
  const enabledWebhookCount = webhooks.filter(w => w.enabled).length;

  return (
    <div className="glass-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-pyth-yellow" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider uppercase">
            Alert Notifications
          </h2>
          <InfoTooltip
            title="Webhook Alert System"
            content="Configure real-time alerts via Telegram bot, Discord webhook, or custom HTTP endpoints. Set price thresholds, risk score limits, and security event triggers. Alerts are evaluated against live Pyth price feeds and sent instantly when conditions are met."
          />
          {enabledRuleCount > 0 && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-pyth-green/10 text-pyth-green">
              {enabledRuleCount} active
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto sm:ml-0 p-1 rounded hover:bg-pyth-surface/50 text-pyth-text-muted"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-pyth-text-muted">
              {enabledWebhookCount} webhook{enabledWebhookCount !== 1 ? 's' : ''} · {history.length} sent
            </span>
          </div>
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
            {/* Tabs */}
            <div className="flex gap-1 mb-3 bg-pyth-surface/30 rounded-lg p-0.5">
              {([
                { id: 'rules' as Tab, label: 'Alert Rules', icon: Zap },
                { id: 'webhooks' as Tab, label: 'Webhooks', icon: Settings },
                { id: 'history' as Tab, label: 'History', icon: History },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 font-mono text-[10px] px-3 py-1.5 rounded-md transition-all ${
                    activeTab === id
                      ? 'bg-pyth-purple/15 text-pyth-purple'
                      : 'text-pyth-text-muted hover:text-pyth-text'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'rules' && (
              <RulesTab
                rules={rules}
                feeds={feeds}
                onToggle={handleToggleRule}
                onDelete={handleDeleteRule}
                onAdd={handleAddRule}
                onUpdate={handleUpdateRule}
              />
            )}
            {activeTab === 'webhooks' && (
              <WebhooksTab
                webhooks={webhooks}
                onUpdate={handleUpdateWebhook}
                onTest={handleTestWebhook}
                testing={testing}
                testResult={testResult}
              />
            )}
            {activeTab === 'history' && (
              <HistoryTab history={history} onClear={handleClearHistory} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Rules Tab ──

function RulesTab({
  rules,
  feeds,
  onToggle,
  onDelete,
  onAdd,
  onUpdate,
}: {
  rules: AlertRule[];
  feeds: PriceFeed[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<AlertRule>) => void;
}) {
  return (
    <div className="space-y-2">
      {rules.map(rule => (
        <div
          key={rule.id}
          className={`rounded-lg border p-3 transition-all ${
            rule.enabled
              ? 'bg-pyth-surface/50 border-pyth-purple/20'
              : 'bg-pyth-surface/20 border-pyth-border'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {/* Toggle */}
            <button
              onClick={() => onToggle(rule.id)}
              className={`w-8 h-4 rounded-full relative transition-all ${
                rule.enabled ? 'bg-pyth-green' : 'bg-pyth-surface'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                  rule.enabled ? 'left-4' : 'left-0.5'
                }`}
              />
            </button>

            {/* Name (editable) */}
            <input
              type="text"
              value={rule.name}
              onChange={e => onUpdate(rule.id, { name: e.target.value })}
              className="flex-1 font-mono text-xs bg-transparent text-pyth-text border-none outline-none"
            />

            <button
              onClick={() => onDelete(rule.id)}
              className="p-1 rounded text-pyth-text-muted hover:text-pyth-red transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Type */}
            <select
              value={rule.type}
              onChange={e => onUpdate(rule.id, { type: e.target.value as AlertRule['type'] })}
              className="font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-2 py-1 text-pyth-text outline-none"
            >
              <option value="price_above">Price Above</option>
              <option value="price_below">Price Below</option>
              <option value="price_change">% Change</option>
              <option value="risk_score">Risk Score &gt;</option>
              <option value="security_alert">Security Alert</option>
            </select>

            {/* Feed selector (for price rules) */}
            {(rule.type === 'price_above' || rule.type === 'price_below' || rule.type === 'price_change') && (
              <select
                value={rule.feedSymbol || ''}
                onChange={e => onUpdate(rule.id, { feedSymbol: e.target.value })}
                className="font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-2 py-1 text-pyth-text outline-none"
              >
                {feeds.map(f => (
                  <option key={f.id} value={f.symbol}>{f.symbol}</option>
                ))}
              </select>
            )}

            {/* Threshold */}
            {rule.type !== 'security_alert' && (
              <input
                type="number"
                value={rule.threshold}
                onChange={e => onUpdate(rule.id, { threshold: Number(e.target.value) })}
                className="w-24 font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-2 py-1 text-pyth-text outline-none"
                placeholder="Threshold"
              />
            )}

            {/* Cooldown */}
            <select
              value={rule.cooldownMs}
              onChange={e => onUpdate(rule.id, { cooldownMs: Number(e.target.value) })}
              className="font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-2 py-1 text-pyth-text outline-none"
            >
              <option value={60000}>1m cooldown</option>
              <option value={300000}>5m cooldown</option>
              <option value={600000}>10m cooldown</option>
              <option value={1800000}>30m cooldown</option>
            </select>
          </div>
        </div>
      ))}

      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-1.5 font-mono text-[10px] py-2 rounded-lg
          border border-dashed border-pyth-border hover:border-pyth-purple/40 text-pyth-text-muted
          hover:text-pyth-purple transition-all"
      >
        <Plus className="w-3 h-3" />
        Add Alert Rule
      </button>
    </div>
  );
}

// ── Webhooks Tab ──

function WebhooksTab({
  webhooks,
  onUpdate,
  onTest,
  testing,
  testResult,
}: {
  webhooks: WebhookConfig[];
  onUpdate: (id: string, updates: Partial<WebhookConfig>) => void;
  onTest: (wh: WebhookConfig) => void;
  testing: string | null;
  testResult: { id: string; ok: boolean; error?: string } | null;
}) {
  const webhookLabels: Record<string, { name: string; icon: string; placeholder: string }> = {
    telegram: {
      name: 'Telegram Bot',
      icon: '📨',
      placeholder: 'Bot Token',
    },
    discord: {
      name: 'Discord Webhook',
      icon: '💬',
      placeholder: 'https://discord.com/api/webhooks/...',
    },
    custom: {
      name: 'Custom Webhook',
      icon: '🔗',
      placeholder: 'https://your-api.com/webhook',
    },
  };

  return (
    <div className="space-y-3">
      {webhooks.map(wh => {
        const meta = webhookLabels[wh.id] || { name: wh.id, icon: '🔔', placeholder: '' };
        return (
          <div
            key={wh.id}
            className={`rounded-lg border p-3 transition-all ${
              wh.enabled
                ? 'bg-pyth-surface/50 border-pyth-purple/20'
                : 'bg-pyth-surface/20 border-pyth-border'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{meta.icon}</span>
              <span className="font-mono text-xs font-bold text-pyth-text">{meta.name}</span>

              <button
                onClick={() => onUpdate(wh.id, { enabled: !wh.enabled })}
                className={`ml-auto w-8 h-4 rounded-full relative transition-all ${
                  wh.enabled ? 'bg-pyth-green' : 'bg-pyth-surface'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                    wh.enabled ? 'left-4' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {wh.id === 'telegram' ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={wh.botToken || ''}
                  onChange={e => onUpdate(wh.id, { botToken: e.target.value })}
                  placeholder="Bot Token (from @BotFather)"
                  className="w-full font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-2 py-1.5 text-pyth-text placeholder:text-pyth-text-muted/40 outline-none focus:border-pyth-purple/30"
                />
                <input
                  type="text"
                  value={wh.chatId || ''}
                  onChange={e => onUpdate(wh.id, { chatId: e.target.value })}
                  placeholder="Chat ID (e.g., -1001234567890)"
                  className="w-full font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-2 py-1.5 text-pyth-text placeholder:text-pyth-text-muted/40 outline-none focus:border-pyth-purple/30"
                />
              </div>
            ) : (
              <input
                type="text"
                value={wh.url}
                onChange={e => onUpdate(wh.id, { url: e.target.value })}
                placeholder={meta.placeholder}
                className="w-full font-mono text-[10px] bg-pyth-surface border border-pyth-border rounded px-2 py-1.5 text-pyth-text placeholder:text-pyth-text-muted/40 outline-none focus:border-pyth-purple/30"
              />
            )}

            {/* Test button */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => onTest(wh)}
                disabled={testing === wh.id || (!wh.url && !wh.botToken)}
                className="flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded
                  bg-pyth-purple/10 border border-pyth-purple/20 text-pyth-purple
                  hover:bg-pyth-purple/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {testing === wh.id ? (
                  <div className="w-3 h-3 border-2 border-pyth-purple/30 border-t-pyth-purple rounded-full animate-spin" />
                ) : (
                  <TestTube2 className="w-3 h-3" />
                )}
                Test
              </button>

              {testResult?.id === wh.id && (
                <span className={`font-mono text-[9px] flex items-center gap-1 ${
                  testResult.ok ? 'text-pyth-green' : 'text-pyth-red'
                }`}>
                  {testResult.ok ? (
                    <><CheckCircle2 className="w-3 h-3" /> Sent successfully</>
                  ) : (
                    <><XCircle className="w-3 h-3" /> {testResult.error}</>
                  )}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── History Tab ──

function HistoryTab({
  history,
  onClear,
}: {
  history: AlertNotification[];
  onClear: () => void;
}) {
  const reversedHistory = [...history].reverse();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-pyth-text-muted">
          {history.length} alert{history.length !== 1 ? 's' : ''} sent
        </span>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="font-mono text-[9px] text-pyth-text-muted hover:text-pyth-red transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {reversedHistory.length === 0 ? (
        <div className="text-center py-6">
          <Bell className="w-6 h-6 text-pyth-text-muted/20 mx-auto mb-2" />
          <p className="font-mono text-[10px] text-pyth-text-muted">No alerts sent yet</p>
          <p className="font-mono text-[9px] text-pyth-text-muted/60 mt-1">
            Enable rules and configure webhooks to start receiving alerts
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-pyth-border">
          {reversedHistory.map(alert => (
            <div
              key={alert.id}
              className={`flex items-start gap-2 rounded-lg p-2 border ${
                alert.severity === 'critical'
                  ? 'bg-pyth-red/5 border-pyth-red/10'
                  : alert.severity === 'warning'
                  ? 'bg-pyth-yellow/5 border-pyth-yellow/10'
                  : 'bg-pyth-surface/30 border-pyth-border'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                alert.severity === 'critical' ? 'bg-pyth-red' :
                alert.severity === 'warning' ? 'bg-pyth-yellow' : 'bg-pyth-cyan'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-pyth-text truncate">{alert.ruleName}</span>
                  {alert.sent ? (
                    <Send className="w-2.5 h-2.5 text-pyth-green shrink-0" />
                  ) : (
                    <XCircle className="w-2.5 h-2.5 text-pyth-red shrink-0" />
                  )}
                </div>
                <p className="font-mono text-[9px] text-pyth-text-muted truncate">{alert.message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[8px] text-pyth-text-muted/60">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="font-mono text-[8px] text-pyth-text-muted/40">
                    via {alert.channel}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
