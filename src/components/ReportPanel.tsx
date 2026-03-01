// ── Exportable Risk Report Generator ──
// Generates a styled HTML report of current dashboard state, downloadable as HTML or printable as PDF

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, X, Printer, Shield, TrendingUp, AlertTriangle, Zap, FileJson, FileSpreadsheet, Code2 } from 'lucide-react';
import type { PriceFeed, Position, RiskMetrics, EntropySimulation } from '../types';

interface ReportPanelProps {
  feeds: PriceFeed[];
  positions: Position[];
  riskMetrics: RiskMetrics;
  simulations: EntropySimulation[];
  isOpen: boolean;
  onClose: () => void;
}

function getRiskLabel(score: number): string {
  if (score <= 25) return 'LOW';
  if (score <= 50) return 'MODERATE';
  if (score <= 75) return 'HIGH';
  return 'CRITICAL';
}

function getRiskColor(score: number): string {
  if (score <= 25) return '#5FE59A';
  if (score <= 50) return '#FFD86B';
  if (score <= 75) return '#FF8C42';
  return '#FF4162';
}

function generateReportHTML(
  feeds: PriceFeed[],
  positions: Position[],
  riskMetrics: RiskMetrics,
  simulations: EntropySimulation[]
): string {
  const now = new Date();
  const totalValue = positions.reduce((s, p) => s + p.size * p.currentPrice, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const riskLabel = getRiskLabel(riskMetrics.overallScore);
  const riskColor = getRiskColor(riskMetrics.overallScore);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SENTINEL-1 Risk Report — ${now.toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; background: #0C0C14; color: #E8E8ED; padding: 40px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid rgba(171,135,255,0.3); }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon { width: 48px; height: 48px; background: rgba(171,135,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
    .title { font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #AB87FF, #D4C1FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { font-size: 10px; color: #8A8A9A; letter-spacing: 0.2em; text-transform: uppercase; }
    .timestamp { text-align: right; font-size: 10px; color: #8A8A9A; }
    .section { margin: 24px 0; padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; }
    .section-title { font-size: 11px; font-weight: 600; color: #8A8A9A; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .risk-score { text-align: center; padding: 24px; }
    .risk-number { font-size: 64px; font-weight: 900; }
    .risk-label { font-size: 14px; font-weight: 600; letter-spacing: 0.3em; margin-top: 4px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
    .metric-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px; text-align: center; }
    .metric-value { font-size: 18px; font-weight: 700; margin: 4px 0; }
    .metric-label { font-size: 9px; color: #8A8A9A; text-transform: uppercase; letter-spacing: 0.1em; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 8px 12px; color: #8A8A9A; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid rgba(255,255,255,0.08); }
    td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .positive { color: #5FE59A; }
    .negative { color: #FF4162; }
    .warning { color: #FFD86B; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center; font-size: 9px; color: #5A5A6A; }
    @media print { body { background: white; color: #222; } .section { border-color: #ddd; } th { color: #666; } .footer { color: #999; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">🛡️</div>
        <div>
          <div class="title">SENTINEL-1</div>
          <div class="subtitle">Autonomous Risk Warden Report</div>
        </div>
      </div>
      <div class="timestamp">
        <div>Generated: ${now.toLocaleString()}</div>
        <div>Data Source: Pyth Hermes (Live)</div>
      </div>
    </div>

    <!-- Risk Score -->
    <div class="section">
      <div class="section-title">⚡ Overall Risk Assessment</div>
      <div class="risk-score">
        <div class="risk-number" style="color: ${riskColor}">${riskMetrics.overallScore}</div>
        <div class="risk-label" style="color: ${riskColor}">${riskLabel}</div>
      </div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Volatility Index</div>
          <div class="metric-value">${riskMetrics.volatilityIndex.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Correlation Risk</div>
          <div class="metric-value ${riskMetrics.correlationRisk > 70 ? 'negative' : ''}">${riskMetrics.correlationRisk.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Liquidation Proximity</div>
          <div class="metric-value ${riskMetrics.liquidationProximity > 80 ? 'negative' : riskMetrics.liquidationProximity > 50 ? 'warning' : 'positive'}">${riskMetrics.liquidationProximity.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Entropy Health</div>
          <div class="metric-value positive">${riskMetrics.entropyHealth.toFixed(1)}%</div>
        </div>
      </div>
    </div>

    <!-- Live Prices -->
    <div class="section">
      <div class="section-title">📊 Live Pyth Price Feeds (${feeds.length} Active)</div>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Price</th>
            <th>24h Change</th>
            <th>Confidence</th>
            <th>24h Range</th>
          </tr>
        </thead>
        <tbody>
          ${feeds.map(f => `
          <tr>
            <td><strong>${f.symbol}</strong></td>
            <td>$${f.price >= 1 ? f.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : f.price.toFixed(4)}</td>
            <td class="${f.changePercent24h >= 0 ? 'positive' : 'negative'}">${f.changePercent24h >= 0 ? '+' : ''}${f.changePercent24h.toFixed(2)}%</td>
            <td>±$${f.confidence.toFixed(4)}</td>
            <td>$${f.low24h >= 1 ? f.low24h.toLocaleString('en-US', { maximumFractionDigits: 2 }) : f.low24h.toFixed(4)} — $${f.high24h >= 1 ? f.high24h.toLocaleString('en-US', { maximumFractionDigits: 2 }) : f.high24h.toFixed(4)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Positions -->
    <div class="section">
      <div class="section-title">💼 Active Positions</div>
      <div style="display: flex; gap: 16px; margin-bottom: 12px;">
        <div>Total Value: <strong>$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong></div>
        <div>Unrealized P&L: <strong class="${totalPnl >= 0 ? 'positive' : 'negative'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Side</th>
            <th>Leverage</th>
            <th>Entry</th>
            <th>Current</th>
            <th>P&L</th>
            <th>Health</th>
          </tr>
        </thead>
        <tbody>
          ${positions.map(p => `
          <tr>
            <td><strong>${p.asset}</strong></td>
            <td class="${p.side === 'long' ? 'positive' : 'negative'}">${p.side.toUpperCase()}</td>
            <td>${p.leverage}x</td>
            <td>$${p.entryPrice >= 1 ? p.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.entryPrice.toFixed(4)}</td>
            <td>$${p.currentPrice >= 1 ? p.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.currentPrice.toFixed(4)}</td>
            <td class="${p.pnl >= 0 ? 'positive' : 'negative'}">${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)} (${p.pnlPercent >= 0 ? '+' : ''}${p.pnlPercent.toFixed(2)}%)</td>
            <td class="${p.healthFactor > 3 ? 'positive' : p.healthFactor > 1.5 ? 'warning' : 'negative'}">${p.healthFactor.toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Entropy Stress Tests -->
    <div class="section">
      <div class="section-title">🎲 Entropy Stress Test Results</div>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Probability</th>
            <th>Impact</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${simulations.map(s => `
          <tr>
            <td>${s.scenario}</td>
            <td>${(s.probability * 100).toFixed(1)}%</td>
            <td class="${s.impact >= 0 ? 'positive' : 'negative'}">${s.impact >= 0 ? '+' : ''}$${s.impact.toLocaleString()}</td>
            <td>${s.status.toUpperCase()}</td>
            <td style="font-size: 10px; color: #8A8A9A;">${s.recommendedAction}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>SENTINEL-1 · Autonomous Risk Warden · Powered by Pyth Network</p>
      <p style="margin-top: 4px;">Pyth Pro Real-Time Feeds · Pyth Entropy Randomized Execution · Apache 2.0</p>
      <p style="margin-top: 4px;">This report was auto-generated from live Pyth Hermes data. Past behavior does not predict future results.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── JSON Report Generator ──
function generateReportJSON(
  feeds: PriceFeed[],
  positions: Position[],
  riskMetrics: RiskMetrics,
  simulations: EntropySimulation[]
): string {
  const now = new Date();
  const totalValue = positions.reduce((s, p) => s + p.size * p.currentPrice, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  const report = {
    meta: {
      generator: 'SENTINEL-1 — Autonomous Risk Warden',
      generatedAt: now.toISOString(),
      dataSource: 'Pyth Hermes (Live)',
      version: '1.0.0',
    },
    riskAssessment: {
      overallScore: Math.round(riskMetrics.overallScore * 100) / 100,
      level: getRiskLabel(riskMetrics.overallScore),
      trend: riskMetrics.trend,
      volatilityIndex: Math.round(riskMetrics.volatilityIndex * 100) / 100,
      correlationRisk: Math.round(riskMetrics.correlationRisk * 100) / 100,
      liquidationProximity: Math.round(riskMetrics.liquidationProximity * 100) / 100,
      entropyHealth: Math.round(riskMetrics.entropyHealth * 100) / 100,
    },
    portfolio: {
      totalValue: Math.round(totalValue * 100) / 100,
      unrealizedPnl: Math.round(totalPnl * 100) / 100,
      positionCount: positions.length,
    },
    priceFeeds: feeds.map(f => ({
      symbol: f.symbol,
      name: f.name,
      price: f.price,
      changePercent24h: Math.round(f.changePercent24h * 100) / 100,
      confidence: f.confidence,
      high24h: f.high24h,
      low24h: f.low24h,
      emaPrice: f.emaPrice,
      publishTime: f.publishTime,
    })),
    positions: positions.map(p => ({
      asset: p.asset,
      side: p.side,
      size: p.size,
      leverage: p.leverage,
      entryPrice: p.entryPrice,
      currentPrice: p.currentPrice,
      pnl: Math.round(p.pnl * 100) / 100,
      pnlPercent: Math.round(p.pnlPercent * 100) / 100,
      healthFactor: Math.round(p.healthFactor * 100) / 100,
    })),
    stressTests: simulations.map(s => ({
      scenario: s.scenario,
      probability: Math.round(s.probability * 10000) / 10000,
      impact: s.impact,
      status: s.status,
      recommendedAction: s.recommendedAction,
      entropySeed: s.entropySeedShort ?? null,
      entropyChain: s.entropyChain ?? null,
      isLiveEntropy: s.entropyIsLive ?? false,
    })),
  };

  return JSON.stringify(report, null, 2);
}

// ── CSV Report Generator ──
function generateReportCSV(
  feeds: PriceFeed[],
  positions: Position[],
  riskMetrics: RiskMetrics,
  simulations: EntropySimulation[]
): string {
  const now = new Date();
  const totalValue = positions.reduce((s, p) => s + p.size * p.currentPrice, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const lines: string[] = [];

  const esc = (v: string | number) => {
    const str = String(v);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  // Header info
  lines.push('SENTINEL-1 Risk Report');
  lines.push(`Generated,${now.toISOString()}`);
  lines.push(`Data Source,Pyth Hermes (Live)`);
  lines.push('');

  // Risk Assessment
  lines.push('=== RISK ASSESSMENT ===');
  lines.push('Metric,Value');
  lines.push(`Overall Score,${riskMetrics.overallScore.toFixed(1)}`);
  lines.push(`Risk Level,${getRiskLabel(riskMetrics.overallScore)}`);
  lines.push(`Trend,${riskMetrics.trend}`);
  lines.push(`Volatility Index,${riskMetrics.volatilityIndex.toFixed(1)}%`);
  lines.push(`Correlation Risk,${riskMetrics.correlationRisk.toFixed(1)}%`);
  lines.push(`Liquidation Proximity,${riskMetrics.liquidationProximity.toFixed(1)}%`);
  lines.push(`Entropy Health,${riskMetrics.entropyHealth.toFixed(1)}%`);
  lines.push('');

  // Portfolio Summary
  lines.push('=== PORTFOLIO SUMMARY ===');
  lines.push(`Total Value,$${totalValue.toFixed(2)}`);
  lines.push(`Unrealized PnL,$${totalPnl.toFixed(2)}`);
  lines.push(`Position Count,${positions.length}`);
  lines.push('');

  // Price Feeds
  lines.push('=== PRICE FEEDS ===');
  lines.push('Symbol,Price,24h Change %,Confidence,High 24h,Low 24h,EMA Price');
  for (const f of feeds) {
    lines.push([
      esc(f.symbol), f.price, f.changePercent24h.toFixed(2),
      f.confidence, f.high24h, f.low24h, f.emaPrice,
    ].join(','));
  }
  lines.push('');

  // Positions
  lines.push('=== POSITIONS ===');
  lines.push('Asset,Side,Size,Leverage,Entry Price,Current Price,PnL ($),PnL (%),Health Factor');
  for (const p of positions) {
    lines.push([
      esc(p.asset), p.side, p.size, `${p.leverage}x`,
      p.entryPrice, p.currentPrice, p.pnl.toFixed(2),
      p.pnlPercent.toFixed(2), p.healthFactor.toFixed(2),
    ].join(','));
  }
  lines.push('');

  // Stress Tests
  lines.push('=== ENTROPY STRESS TESTS ===');
  lines.push('Scenario,Probability,Impact ($),Status,Recommended Action');
  for (const s of simulations) {
    lines.push([
      esc(s.scenario), (s.probability * 100).toFixed(1) + '%',
      s.impact, s.status, esc(s.recommendedAction),
    ].join(','));
  }

  return lines.join('\n');
}

// ── Download helper ──
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import { memo } from 'react';

export default memo(function ReportPanel({ feeds, positions, riskMetrics, simulations, isOpen, onClose }: ReportPanelProps) {
  const [generating, setGenerating] = useState<string | null>(null);

  const dateSuffix = new Date().toISOString().slice(0, 10);

  const handleDownload = (format: 'html' | 'json' | 'csv') => {
    setGenerating(format);
    try {
      switch (format) {
        case 'html': {
          const html = generateReportHTML(feeds, positions, riskMetrics, simulations);
          downloadFile(html, `sentinel-1-report-${dateSuffix}.html`, 'text/html');
          break;
        }
        case 'json': {
          const json = generateReportJSON(feeds, positions, riskMetrics, simulations);
          downloadFile(json, `sentinel-1-report-${dateSuffix}.json`, 'application/json');
          break;
        }
        case 'csv': {
          const csv = generateReportCSV(feeds, positions, riskMetrics, simulations);
          downloadFile(csv, `sentinel-1-report-${dateSuffix}.csv`, 'text/csv');
          break;
        }
      }
    } finally {
      setTimeout(() => setGenerating(null), 500);
    }
  };

  const handlePrint = () => {
    const html = generateReportHTML(feeds, positions, riskMetrics, simulations);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const riskLabel = getRiskLabel(riskMetrics.overallScore);
  const riskColor = getRiskColor(riskMetrics.overallScore);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-pyth-surface border border-pyth-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-pyth-border">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-pyth-purple/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-pyth-purple" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-pyth-text font-mono tracking-wide">
                    EXPORT RISK REPORT
                  </h2>
                  <p className="text-[9px] sm:text-[10px] text-pyth-text-muted font-mono truncate">
                    Snapshot of current dashboard state
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-pyth-bg transition-colors text-pyth-text-muted hover:text-pyth-text shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-3">
              {/* Risk summary */}
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-3 rounded-xl bg-pyth-bg border border-pyth-border">
                <div className="text-center shrink-0">
                  <div className="text-xl sm:text-2xl font-black font-mono" style={{ color: riskColor }}>
                    {riskMetrics.overallScore}
                  </div>
                  <div className="text-[8px] font-mono font-bold tracking-wider" style={{ color: riskColor }}>
                    {riskLabel}
                  </div>
                </div>
                <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-1 gap-1">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Shield className="w-3 h-3 text-pyth-purple shrink-0" />
                    <span className="text-[9px] sm:text-[10px] font-mono text-pyth-text-dim truncate">
                      {feeds.length} feeds · {positions.length} pos
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <TrendingUp className="w-3 h-3 text-pyth-green shrink-0" />
                    <span className={`text-[9px] sm:text-[10px] font-mono font-bold truncate ${totalPnl >= 0 ? 'text-pyth-green' : 'text-pyth-red'}`}>
                      P&L: {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <AlertTriangle className="w-3 h-3 text-pyth-yellow shrink-0" />
                    <span className="text-[9px] sm:text-[10px] font-mono text-pyth-text-dim truncate">
                      Vol: {riskMetrics.volatilityIndex.toFixed(1)}% · Corr: {riskMetrics.correlationRisk.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Zap className="w-3 h-3 text-pyth-cyan shrink-0" />
                    <span className="text-[9px] sm:text-[10px] font-mono text-pyth-text-dim truncate">
                      {simulations.length} stress tests
                    </span>
                  </div>
                </div>
              </div>

              {/* Report includes */}
              <div className="text-[9px] sm:text-[10px] font-mono text-pyth-text-muted">
                <span className="text-pyth-text-dim font-semibold">Report includes:</span>{' '}
                Risk score · Live prices · Positions · Stress tests
              </div>
            </div>

            {/* Actions */}
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-pyth-border bg-pyth-bg/50 space-y-2">
              {/* Download formats */}
              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDownload('json')}
                  disabled={generating !== null}
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl
                    bg-pyth-green/10 border border-pyth-green/20 text-pyth-green
                    hover:bg-pyth-green/20 hover:border-pyth-green/40
                    disabled:opacity-50 transition-all font-mono text-[10px] font-semibold"
                >
                  <FileJson className="w-4 h-4" />
                  {generating === 'json' ? 'Saving...' : 'JSON'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDownload('csv')}
                  disabled={generating !== null}
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl
                    bg-pyth-yellow/10 border border-pyth-yellow/20 text-pyth-yellow
                    hover:bg-pyth-yellow/20 hover:border-pyth-yellow/40
                    disabled:opacity-50 transition-all font-mono text-[10px] font-semibold"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {generating === 'csv' ? 'Saving...' : 'CSV'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDownload('html')}
                  disabled={generating !== null}
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl
                    bg-pyth-purple/10 border border-pyth-purple/20 text-pyth-purple
                    hover:bg-pyth-purple/20 hover:border-pyth-purple/40
                    disabled:opacity-50 transition-all font-mono text-[10px] font-semibold"
                >
                  <Code2 className="w-4 h-4" />
                  {generating === 'html' ? 'Saving...' : 'HTML'}
                </motion.button>
              </div>
              {/* Print */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl
                  bg-pyth-cyan/10 border border-pyth-cyan/20 text-pyth-cyan
                  hover:bg-pyth-cyan/20 hover:border-pyth-cyan/40
                  transition-all font-mono text-[10px] font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / PDF
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
