// ── Header Component ──
import { Shield, Activity, Wifi, Clock, Zap } from 'lucide-react';
import { formatUptime } from '../hooks';
import WalletButton from './WalletButton';
import type { AgentState } from '../types';

interface HeaderProps {
  agentState: AgentState;
  latency: number;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error' | 'mock';
  dataSource: 'live' | 'mock';
}

export default function Header({ agentState, latency, connectionStatus, dataSource }: HeaderProps) {
  const statusColors = {
    monitoring: 'text-pyth-green',
    analyzing: 'text-pyth-cyan',
    executing: 'text-pyth-purple',
    idle: 'text-pyth-text-dim',
    alert: 'text-pyth-red',
  };

  const statusLabels = {
    monitoring: 'MONITORING',
    analyzing: 'ANALYZING',
    executing: 'EXECUTING',
    idle: 'IDLE',
    alert: 'ALERT',
  };

  return (
    <header className="glass-card px-2 sm:px-6 py-2 sm:py-3">
      <div className="flex items-center justify-between gap-2">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-pyth-purple/20 flex items-center justify-center glow-purple">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-pyth-purple" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 glow-dot glow-dot-green" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-bold tracking-wider gradient-text font-mono">
            SENTINEL-1
          </h1>
          <p className="text-[8px] sm:text-[10px] text-pyth-text-muted tracking-[0.15em] sm:tracking-[0.2em] uppercase truncate">
            Autonomous Risk Warden
          </p>
        </div>
      </div>

      {/* Center: Agent Status */}
      <div className="hidden md:flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${statusColors[agentState.status]}`} />
          <span className={`font-mono text-xs font-semibold tracking-wider ${statusColors[agentState.status]}`}>
            {statusLabels[agentState.status]}
          </span>
        </div>
        <div className="h-4 w-px bg-pyth-border" />
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-pyth-text-dim" />
          <span className="font-mono text-xs text-pyth-text-dim">
            {formatUptime(agentState.uptime)}
          </span>
        </div>
        <div className="h-4 w-px bg-pyth-border" />
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-pyth-yellow" />
          <span className="font-mono text-xs text-pyth-text-dim">
            {agentState.decisionsToday} decisions · {agentState.accuracy}% acc
          </span>
        </div>
      </div>

      {/* Right: Wallet + Connection Status */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <WalletButton />
        <div className={`flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border ${
          connectionStatus === 'connected'
            ? 'bg-pyth-green/10 border-pyth-green/20'
            : connectionStatus === 'mock'
            ? 'bg-pyth-yellow/10 border-pyth-yellow/20'
            : connectionStatus === 'connecting'
            ? 'bg-pyth-cyan/10 border-pyth-cyan/20'
            : 'bg-pyth-red/10 border-pyth-red/20'
        }`}>
          <Wifi className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
            connectionStatus === 'connected' ? 'text-pyth-green' :
            connectionStatus === 'mock' ? 'text-pyth-yellow' :
            connectionStatus === 'connecting' ? 'text-pyth-cyan animate-pulse' :
            'text-pyth-red'
          }`} />
          <span className={`font-mono text-[10px] sm:text-xs font-medium ${
            connectionStatus === 'connected' ? 'text-pyth-green' :
            connectionStatus === 'mock' ? 'text-pyth-yellow' :
            connectionStatus === 'connecting' ? 'text-pyth-cyan' :
            'text-pyth-red'
          }`}>
            <span className="hidden sm:inline">{dataSource === 'live' ? 'PYTH LIVE' : 'PYTH MOCK'}</span>
            <span className="sm:hidden">{dataSource === 'live' ? 'LIVE' : 'MOCK'}</span>
          </span>
          {connectionStatus === 'connected' && (
            <span className="font-mono text-[9px] sm:text-[10px] text-pyth-green/60 hidden sm:inline">
              {latency.toFixed(1)}ms
            </span>
          )}
          {connectionStatus === 'mock' && (
            <span className="font-mono text-[9px] sm:text-[10px] text-pyth-yellow/60 hidden sm:inline">
              simulated
            </span>
          )}
        </div>
        <div className="hidden lg:block text-right">
          <p className="font-mono text-[10px] text-pyth-text-muted">POWERED BY</p>
          <p className="font-mono text-xs text-pyth-purple font-semibold tracking-wider">PYTH NETWORK</p>
        </div>
      </div>
      </div>
    </header>
  );
}
