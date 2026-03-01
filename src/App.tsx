// ── Sentinel-1: Autonomous Risk Warden ──
// Built for Pyth Playground Community Hackathon
// Uses Pyth Pro (real-time feeds) + Pyth Entropy (randomized execution)

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from './components/Header';
import PriceTicker from './components/PriceTicker';
import ReasoningConsole from './components/ReasoningConsole';
import RiskGauge from './components/RiskGauge';
import ActionButtons from './components/ActionButtons';
import PositionsPanel from './components/PositionsPanel';
import EntropyPanel from './components/EntropyPanel';
import AgentChat from './components/AgentChat';
import PublisherRadar from './components/PublisherRadar';
import ReportPanel from './components/ReportPanel';
import BacktestPanel from './components/BacktestPanel';
import WalletProvider from './components/WalletProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { usePriceFeeds, useAgentLogs, useLiveRiskMetrics, useAgentState, useLivePositions, useLiveEntropy, usePublisherRadar } from './hooks';

export default function App() {
  const { feeds, updatedId, connectionStatus, dataSource } = usePriceFeeds();
  const agentState = useAgentState();
  const { logs, addLog } = useAgentLogs(3500, feeds);
  const { positions, shelterAll, entropyExit, guardianShield, isSheltered, isCritical } = useLivePositions(feeds, addLog);
  const riskMetrics = useLiveRiskMetrics(feeds, positions);
  const { simulations, entropyStatus, latestSeed } = useLiveEntropy(feeds, positions);
  const publisherRadar = usePublisherRadar(feeds);
  const [latency, setLatency] = useState(0.8);
  const [reportOpen, setReportOpen] = useState(false);

  // Simulate fluctuating latency indicator
  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(0.5 + Math.random() * 1.2);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleShelter = () => {
    shelterAll();
  };

  const handleEntropyExit = () => {
    entropyExit();
  };

  const handleGuardianShield = () => {
    guardianShield();
  };

  // Find the critical position info for the override box
  const criticalPosition = positions.find(p => p.healthFactor < 1.0);
  const criticalPrice = criticalPosition?.currentPrice;

  return (
    <WalletProvider>
    <div className={`min-h-screen bg-pyth-bg grid-bg ${isCritical ? 'danger-pulse' : ''}`}>
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-pyth-purple/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pyth-purple/3 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pyth-purple/[0.02] rounded-full blur-[150px]" />
      </div>

      {/* Main content */}
      <main role="main" aria-label="SENTINEL-1 Dashboard" className="relative z-10 max-w-[1600px] mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Header agentState={agentState} latency={latency} connectionStatus={connectionStatus} dataSource={dataSource} />
        </motion.div>

        {/* Price Ticker - Full Width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ErrorBoundary>
            <PriceTicker feeds={feeds} updatedId={updatedId} isLive={dataSource === 'live'} />
          </ErrorBoundary>
        </motion.div>

        {/* Main Grid: Console + Risk + Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left: Reasoning Console */}
          <motion.div
            className="lg:col-span-5 flex flex-col"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <ErrorBoundary>
              <ReasoningConsole logs={logs} />
            </ErrorBoundary>
          </motion.div>

          {/* Center: Risk Gauge + Actions */}
          <motion.div
            className="lg:col-span-3 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ErrorBoundary>
              <RiskGauge metrics={riskMetrics} />
            </ErrorBoundary>
            <ActionButtons
              onShelter={handleShelter}
              onEntropyExit={handleEntropyExit}
              onGuardianShield={handleGuardianShield}
              isCritical={isCritical}
              criticalAsset={criticalPosition?.asset}
              criticalPrice={criticalPrice}
            />
          </motion.div>

          {/* Right: Agent Chat */}
          <motion.div
            className="lg:col-span-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <ErrorBoundary>
              <AgentChat feeds={feeds} positions={positions} />
            </ErrorBoundary>
          </motion.div>
        </div>

        {/* Middle Row: Publisher Radar (Full Width) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          role="region"
          aria-label="Publisher Radar"
        >
          <ErrorBoundary>
            <PublisherRadar radar={publisherRadar} />
          </ErrorBoundary>
        </motion.div>

        {/* Historical Replay / Backtest (Full Width) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          role="region"
          aria-label="Historical Backtest"
        >
          <ErrorBoundary>
            <BacktestPanel feeds={feeds} />
          </ErrorBoundary>
        </motion.div>

        {/* Bottom Row: Positions + Entropy */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <ErrorBoundary>
              <PositionsPanel positions={positions} isSheltered={isSheltered} />
            </ErrorBoundary>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <ErrorBoundary>
              <EntropyPanel simulations={simulations} entropyStatus={entropyStatus} latestSeed={latestSeed} />
            </ErrorBoundary>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.footer
          className="text-center py-4 border-t border-pyth-border"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex items-center justify-center gap-4 mb-2">
            <button
              onClick={() => setReportOpen(true)}
              className="font-mono text-[10px] px-3 py-1.5 rounded-lg
                bg-pyth-purple/10 border border-pyth-purple/20
                text-pyth-purple hover:bg-pyth-purple/20 hover:border-pyth-purple/40
                transition-all inline-flex items-center gap-1.5"
            >
              📄 Export Risk Report
            </button>
          </div>
          <p className="font-mono text-[10px] text-pyth-text-muted tracking-wider">
            SENTINEL-1 · Autonomous Risk Warden · Powered by{' '}
            <span className="text-pyth-purple font-semibold">Pyth Network</span>
            {' '}· Built for Pyth Playground Hackathon
          </p>
          <p className="font-mono text-[9px] text-pyth-text-muted/50 mt-1">
            Pyth Pro Real-Time Feeds · Pyth Entropy Randomized Execution · Apache 2.0
          </p>
        </motion.footer>
      </main>

      {/* Report Modal */}
      <ReportPanel
        feeds={feeds}
        positions={positions}
        riskMetrics={riskMetrics}
        simulations={simulations}
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
    </WalletProvider>
  );
}
