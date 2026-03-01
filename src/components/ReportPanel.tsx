// ── Exportable Risk Report Generator ──
// Generates a styled HTML report of current dashboard state, downloadable as HTML or printable as PDF

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, X, Printer, Shield, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
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

export default function ReportPanel({ feeds, positions, riskMetrics, simulations, isOpen, onClose }: ReportPanelProps) {
  const [generating, setGenerating] = useState(false);

  const handleDownloadHTML = () => {
    setGenerating(true);
    const html = generateReportHTML(feeds, positions, riskMetrics, simulations);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-1-report-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTimeout(() => setGenerating(false), 500);
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
            className="relative w-full max-w-lg bg-pyth-surface border border-pyth-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-pyth-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-pyth-purple/20 flex items-center justify-center">
                  <FileText className="w-4.5 h-4.5 text-pyth-purple" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-pyth-text font-mono tracking-wide">
                    EXPORT RISK REPORT
                  </h2>
                  <p className="text-[10px] text-pyth-text-muted font-mono">
                    Snapshot of current dashboard state
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-pyth-bg transition-colors text-pyth-text-muted hover:text-pyth-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="px-5 py-4 space-y-3">
              {/* Risk summary */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-pyth-bg border border-pyth-border">
                <div className="text-center">
                  <div className="text-2xl font-black font-mono" style={{ color: riskColor }}>
                    {riskMetrics.overallScore}
                  </div>
                  <div className="text-[8px] font-mono font-bold tracking-wider" style={{ color: riskColor }}>
                    {riskLabel}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-pyth-purple" />
                    <span className="text-[10px] font-mono text-pyth-text-dim">
                      {feeds.length} feeds · {positions.length} positions
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-pyth-green" />
                    <span className={`text-[10px] font-mono font-bold ${totalPnl >= 0 ? 'text-pyth-green' : 'text-pyth-red'}`}>
                      P&L: {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-pyth-yellow" />
                    <span className="text-[10px] font-mono text-pyth-text-dim">
                      Volatility: {riskMetrics.volatilityIndex.toFixed(1)}% · Corr: {riskMetrics.correlationRisk.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-pyth-cyan" />
                    <span className="text-[10px] font-mono text-pyth-text-dim">
                      {simulations.length} entropy stress tests
                    </span>
                  </div>
                </div>
              </div>

              {/* Report includes */}
              <div className="text-[10px] font-mono text-pyth-text-muted">
                <span className="text-pyth-text-dim font-semibold">Report includes:</span>{' '}
                Risk score & metrics · All live prices · Position details · Entropy stress test results
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-pyth-border bg-pyth-bg/50">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadHTML}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-pyth-purple/20 border border-pyth-purple/30 text-pyth-purple
                  hover:bg-pyth-purple/30 hover:border-pyth-purple/50
                  disabled:opacity-50 transition-all font-mono text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                {generating ? 'Generating...' : 'Download HTML'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-pyth-cyan/10 border border-pyth-cyan/20 text-pyth-cyan
                  hover:bg-pyth-cyan/20 hover:border-pyth-cyan/40
                  transition-all font-mono text-xs font-semibold"
              >
                <Printer className="w-4 h-4" />
                Print / PDF
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
