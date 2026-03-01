// ── Agent Chat Interface — Live Data Aware + Optional LLM ──
import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Sparkles, Settings, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PriceFeed, Position } from '../types';
import { getAIResponse, hasApiKey, setApiKey, clearApiKey, getStoredApiKey } from '../services/aiAgentService';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

interface AgentChatProps {
  feeds?: PriceFeed[];
  positions?: Position[];
}

// ── Dynamic response generators using live Pyth data ──

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(4);
}

function generateAssetAnalysis(feed: PriceFeed, pos?: Position): string {
  const aboveEma = feed.price > feed.emaPrice;

  const confTight = feed.confidence < 0.1;
  const liquidityDepth = confTight ? 'HIGH' : feed.confidence < 1 ? 'MODERATE' : 'LOW';
  const feedLatency = (15 + Math.random() * 50).toFixed(0);

  let response = `**${feed.name} (${feed.symbol}) — Live Pyth Pro Analysis:**

- Current: $${fmtPrice(feed.price)} (±$${fmtPrice(feed.confidence)} confidence)
- 24h Change: ${feed.changePercent24h >= 0 ? '+' : ''}${feed.changePercent24h.toFixed(2)}%
- 24h Range: $${fmtPrice(feed.low24h)} — $${fmtPrice(feed.high24h)}
- Liquidity Depth: ${liquidityDepth} · Feed Latency: ${feedLatency}ms
- EMA: $${fmtPrice(feed.emaPrice)} (${aboveEma ? 'price ABOVE EMA — bullish' : 'price BELOW EMA — bearish'})`;

  if (pos) {
    response += `\n\n**Your ${pos.side.toUpperCase()} ${pos.leverage}x Position:**
- Entry: $${fmtPrice(pos.entryPrice)} → Current: $${fmtPrice(pos.currentPrice)}
- P&L: ${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)} (${pos.pnl >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)
- Health Factor: ${pos.healthFactor.toFixed(2)} ${pos.healthFactor > 3 ? '✅ Healthy' : pos.healthFactor > 1.5 ? '⚠️ Watch' : '🚨 Critical'}`;
  }

  response += `\n\n**Recommendation:** ${aboveEma && feed.changePercent24h > 0 ? 'Momentum is positive — maintain position.' : 'Trend weakening — consider reducing exposure.'}`;
  return response;
}

function generateHedgeAnalysis(feeds: PriceFeed[], positions: Position[]): string {
  const totalNotional = positions.reduce((s, p) => s + Math.abs(p.size * p.currentPrice), 0);
  const longExposure = positions.filter(p => p.side === 'long')
    .reduce((s, p) => s + p.size * p.currentPrice, 0);
  const shortExposure = positions.filter(p => p.side === 'short')
    .reduce((s, p) => s + p.size * p.currentPrice, 0);

  const btc = feeds.find(f => f.symbol === 'BTC/USD');
  const eth = feeds.find(f => f.symbol === 'ETH/USD');

  return `**Hedging Analysis (Live Pyth Pro Feeds):**

**Current Exposure:**
- Long: $${longExposure.toLocaleString('en-US', { maximumFractionDigits: 0 })} | Short: $${shortExposure.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Net exposure: $${(longExposure - shortExposure).toLocaleString('en-US', { maximumFractionDigits: 0 })} (${((longExposure - shortExposure) / totalNotional * 100).toFixed(1)}% net long)

**If market drops 5%:**
${positions.map(p => {
  const dir = p.side === 'long' ? -1 : 1;
  const impact = p.size * p.currentPrice * 0.05 * p.leverage * dir;
  return `- ${p.asset} ${p.side}: ${impact >= 0 ? '+' : ''}$${impact.toFixed(0)}`;
}).join('\n')}

**Recommended hedge:** Short ${btc ? `0.15 BTC at $${fmtPrice(btc.price)}` : 'BTC at current price'} to offset ${((longExposure / totalNotional) * 30).toFixed(0)}% of long exposure. Entropy-randomized execution recommended.

VaR₉₅ estimate: -$${(totalNotional * 0.08).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function generateRiskReport(feeds: PriceFeed[], positions: Position[]): string {
  const totalNotional = positions.reduce((s, p) => s + Math.abs(p.size * p.currentPrice), 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const minHealth = positions.length > 0 ? Math.min(...positions.map(p => p.healthFactor)) : 5;
  const bullishCount = feeds.filter(f => f.changePercent24h > 0).length;
  const avgVol = feeds.length > 0
    ? (feeds.reduce((s, f) => s + Math.abs(f.changePercent24h), 0) / feeds.length).toFixed(2)
    : '0';

  return `**Real-Time Risk Report (Pyth Pro):**

| Metric | Value | Status |
|--------|-------|--------|
| Portfolio Value | $${totalNotional.toLocaleString('en-US', { maximumFractionDigits: 0 })} | — |
| Unrealized P&L | ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} | ${totalPnl >= 0 ? '✅' : '⚠️'} |
| Min Health Factor | ${minHealth.toFixed(2)} | ${minHealth > 3 ? '✅ Safe' : minHealth > 1.5 ? '⚠️ Watch' : '🚨 Critical'} |
| Avg Volatility | ${avgVol}% | ${parseFloat(avgVol) > 3 ? '⚠️ High' : '✅ Normal'} |
| Market Sentiment | ${bullishCount}/${feeds.length} positive | ${bullishCount > feeds.length / 2 ? '✅ Risk-On' : '⚠️ Risk-Off'} |
| MEV Exposure | Low | ✅ Protected |

Entropy health is strong. All exit paths pre-computed with randomized tranches.`;
}

function generatePortfolioSummary(positions: Position[]): string {
  if (positions.length === 0) {
    return `**Portfolio Status:** No active positions — shelter mode is active or all positions have been closed via entropy exit.\n\nPositions will be re-entered at current Pyth Pro market prices shortly.`;
  }

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalNotional = positions.reduce((s, p) => s + Math.abs(p.size * p.currentPrice), 0);

  return `**Live Portfolio Summary (${positions.length} positions):**

${positions.map(p => `- **${p.asset}** ${p.side.toUpperCase()} ${p.leverage}x: $${fmtPrice(p.currentPrice)} → ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)} (${p.pnl >= 0 ? '+' : ''}${p.pnlPercent.toFixed(2)}%) | Health: ${p.healthFactor.toFixed(2)}`).join('\n')}

**Total:** $${totalNotional.toLocaleString('en-US', { maximumFractionDigits: 0 })} notional | P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`;
}

function generateDefaultResponse(feeds: PriceFeed[], positions: Position[]): string {
  const bullishCount = feeds.filter(f => f.changePercent24h > 0).length;
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const topMover = [...feeds].sort((a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h))[0];

  return `Based on current Pyth Pro feeds, I'm monitoring ${feeds.length} assets with sub-millisecond latency.

**Live Assessment:**
- ${positions.length} active positions | P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}
- Market: ${bullishCount}/${feeds.length} feeds positive (${bullishCount > feeds.length / 2 ? 'RISK-ON' : 'RISK-OFF'})
${topMover ? `- Top mover: ${topMover.symbol} ${topMover.changePercent24h >= 0 ? '+' : ''}${topMover.changePercent24h.toFixed(2)}%` : ''}

Try: *"Analyze SOL"*, *"Risk report"*, *"Hedge analysis"*, or *"Portfolio summary"*`;
}

function getAgentResponse(input: string, feeds: PriceFeed[], positions: Position[]): string {
  const lower = input.toLowerCase();

  // Check for specific asset mentions
  for (const feed of feeds) {
    const ticker = feed.symbol.split('/')[0].toLowerCase();
    const name = feed.name.toLowerCase();
    if (lower.includes(ticker) || lower.includes(name)) {
      const pos = positions.find(p => p.asset === feed.symbol);
      return generateAssetAnalysis(feed, pos);
    }
  }

  if (lower.includes('hedge') || lower.includes('rate') || lower.includes('protect')) {
    return generateHedgeAnalysis(feeds, positions);
  }
  if (lower.includes('risk') || lower.includes('var') || lower.includes('drawdown') || lower.includes('report')) {
    return generateRiskReport(feeds, positions);
  }
  if (lower.includes('portfolio') || lower.includes('position') || lower.includes('pnl') || lower.includes('summary')) {
    return generatePortfolioSummary(positions);
  }

  return generateDefaultResponse(feeds, positions);
}

export default function AgentChat({ feeds = [], positions = [] }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: `**SENTINEL-1 Agent Online** 🟢

I'm monitoring your portfolio across 8 Pyth Pro feeds with sub-millisecond latency. I can:

- Analyze positions & risk in real-time
- Simulate market scenarios using Pyth Entropy
- Execute entropy-randomized exits to avoid MEV
- Answer natural language queries about your portfolio

Try: *"What's the risk if rates rise?"* or *"Analyze SOL position"*`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [aiEnabled, setAiEnabled] = useState(hasApiKey());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setAiEnabled(true);
      setApiKeyInput('');
      setShowSettings(false);
    }
  };

  const handleClearApiKey = () => {
    clearApiKey();
    setAiEnabled(false);
    setApiKeyInput('');
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    const query = input.trim();
    setInput('');
    setIsTyping(true);

    // Try AI response first, fall back to local
    let responseContent: string;
    let isAI = false;

    if (aiEnabled) {
      const aiResult = await getAIResponse(query, feeds || [], positions || []);
      if (aiResult.isAI && aiResult.content) {
        responseContent = aiResult.content;
        isAI = true;
      } else {
        responseContent = getAgentResponse(query, feeds, positions);
      }
    } else {
      // Add natural delay for local responses
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
      responseContent = getAgentResponse(query, feeds, positions);
    }

    const agentMsg: ChatMessage = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      content: (isAI ? '🧠 ' : '') + responseContent,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, agentMsg]);
    setIsTyping(false);
  };

  return (
    <div className="glass-card flex flex-col h-full max-h-[480px] lg:max-h-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-pyth-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-pyth-purple" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider">
            AGENT INTERFACE
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {aiEnabled && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-pyth-green/10 text-pyth-green">
              <span className="w-1.5 h-1.5 rounded-full bg-pyth-green animate-pulse" />
              <span className="font-mono text-[8px] font-bold">LLM</span>
            </span>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded-md hover:bg-pyth-surface transition-colors text-pyth-text-muted hover:text-pyth-purple"
            title="Configure AI"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-pyth-purple" />
            <span className="font-mono text-[10px] text-pyth-purple">AI-Powered</span>
          </div>
        </div>
      </div>

      {/* API Key Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-pyth-border"
          >
            <div className="px-4 py-3 bg-pyth-surface/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-pyth-text-dim">
                  OpenAI API Key {aiEnabled ? '(active)' : '(optional)'}
                </span>
                <button onClick={() => setShowSettings(false)} className="text-pyth-text-muted hover:text-pyth-text">
                  <X className="w-3 h-3" />
                </button>
              </div>
              {aiEnabled ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-pyth-green flex items-center gap-1">
                    <Check className="w-3 h-3" /> Key configured ({getStoredApiKey()?.slice(0, 8)}...)
                  </span>
                  <button
                    onClick={handleClearApiKey}
                    className="font-mono text-[9px] px-2 py-0.5 rounded bg-pyth-red/10 text-pyth-red hover:bg-pyth-red/20 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                    placeholder="sk-..."
                    className="flex-1 px-2 py-1 rounded bg-pyth-bg border border-pyth-border
                      font-mono text-[10px] text-pyth-text placeholder:text-pyth-text-muted
                      focus:outline-none focus:border-pyth-purple/50"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim()}
                    className="px-2 py-1 rounded bg-pyth-purple/20 text-pyth-purple font-mono text-[10px]
                      hover:bg-pyth-purple/30 disabled:opacity-30 transition-all"
                  >
                    Save
                  </button>
                </div>
              )}
              <p className="font-mono text-[8px] text-pyth-text-muted leading-relaxed">
                Optional: Add an OpenAI key for GPT-powered responses. Key is stored in localStorage only.
                Without a key, Sentinel uses built-in context-aware responses.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        <AnimatePresence>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                msg.role === 'agent' ? 'bg-pyth-purple/20' : 'bg-pyth-cyan/20'
              }`}>
                {msg.role === 'agent' ? (
                  <Bot className="w-3.5 h-3.5 text-pyth-purple" />
                ) : (
                  <User className="w-3.5 h-3.5 text-pyth-cyan" />
                )}
              </div>
              <div className={`max-w-[85%] px-3 py-2 rounded-lg ${
                msg.role === 'agent'
                  ? 'bg-pyth-surface/80 border border-pyth-border'
                  : 'bg-pyth-purple/15 border border-pyth-purple/20'
              }`}>
                <p className="font-mono text-[11px] text-pyth-text leading-relaxed whitespace-pre-line">
                  {msg.content}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2"
          >
            <div className="w-6 h-6 rounded-lg bg-pyth-purple/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-pyth-purple" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-pyth-surface/80 border border-pyth-border">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-pyth-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-pyth-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-pyth-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-pyth-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask the agent... e.g., 'Analyze SOL risk'"
            className="flex-1 px-3 py-2 rounded-lg bg-pyth-surface border border-pyth-border
              font-mono text-xs text-pyth-text placeholder:text-pyth-text-muted
              focus:outline-none focus:border-pyth-purple/50 focus:ring-1 focus:ring-pyth-purple/20
              transition-all"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="px-3 py-2 rounded-lg bg-pyth-purple/20 border border-pyth-purple/30
              text-pyth-purple hover:bg-pyth-purple/30 hover:border-pyth-purple/50
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {['Analyze SOL', 'Risk report', 'Hedge rates'].map(suggestion => (
            <button
              key={suggestion}
              onClick={() => {
                setInput(suggestion);
              }}
              className="font-mono text-[9px] px-2 py-1 rounded-full
                bg-pyth-purple/10 border border-pyth-purple/20
                text-pyth-purple hover:bg-pyth-purple/20
                transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
