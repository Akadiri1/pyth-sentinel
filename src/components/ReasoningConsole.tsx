// ── AI Reasoning Console ──
import { useEffect, useRef } from 'react';
import { Terminal, Brain, AlertTriangle, CheckCircle, Info, Crosshair, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentLog } from '../types';
import { formatTimestamp } from '../hooks';

interface ReasoningConsoleProps {
  logs: AgentLog[];
}

const typeConfig: Record<AgentLog['type'], { icon: typeof Terminal; color: string; label: string; bg: string; glowClass: string }> = {
  info: { icon: Info, color: 'text-pyth-cyan', label: 'SYSTEM', bg: 'bg-pyth-cyan/10', glowClass: '' },
  warning: { icon: AlertTriangle, color: 'text-pyth-yellow', label: 'ALERT', bg: 'bg-pyth-yellow/10', glowClass: 'ring-1 ring-pyth-yellow/20' },
  critical: { icon: AlertTriangle, color: 'text-pyth-red', label: 'ALERT', bg: 'bg-pyth-red/10', glowClass: 'ring-1 ring-pyth-red/30 shadow-[0_0_12px_rgba(255,65,98,0.15)]' },
  success: { icon: CheckCircle, color: 'text-pyth-green', label: 'SUCCESS', bg: 'bg-pyth-green/10', glowClass: '' },
  analysis: { icon: Brain, color: 'text-pyth-purple', label: 'ANALYSIS', bg: 'bg-pyth-purple/10', glowClass: '' },
  action: { icon: Zap, color: 'text-pyth-lavender', label: 'ACTION', bg: 'bg-pyth-lavender/10', glowClass: 'ring-1 ring-pyth-lavender/20' },
};

const sourceColors: Record<string, string> = {
  'pyth-pro': 'text-pyth-green',
  'entropy': 'text-pyth-purple',
  'agent': 'text-pyth-cyan',
  'risk-engine': 'text-pyth-yellow',
  'executor': 'text-pyth-lavender',
};

export default function ReasoningConsole({ logs }: ReasoningConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  return (
    <div className="glass-card flex flex-col h-full scanline-overlay">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-pyth-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-pyth-purple" />
          <h2 className="font-mono text-xs font-semibold text-pyth-text-dim tracking-wider">
            REASONING ENGINE
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-pyth-green/70">
            LATENCY: {(0.3 + Math.random() * 0.6).toFixed(0)}ms
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-pyth-green animate-pulse" />
          <span className="font-mono text-[10px] text-pyth-text-muted">
            {logs.length} events
          </span>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 max-h-[400px]"
      >
        <AnimatePresence initial={false}>
          {logs.map((log, index) => {
            const config = typeConfig[log.type];
            const Icon = config.icon;

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                transition={{ duration: 0.3 }}
                className={`flex items-start gap-2 px-2.5 py-1.5 rounded-md ${
                  index === 0 ? config.bg : 'hover:bg-white/[0.02]'
                } ${index === 0 ? config.glowClass : ''} transition-colors`}
              >
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.color} ${
                  index === 0 && (log.type === 'critical' || log.type === 'warning') ? 'animate-pulse' : ''
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-mono text-[9px] font-bold tracking-wider ${config.color}`}>
                      [{config.label}]
                    </span>
                    <span className={`font-mono text-[9px] ${sourceColors[log.source] || 'text-pyth-text-muted'}`}>
                      {log.source}
                    </span>
                    <span className="font-mono text-[9px] text-pyth-text-muted ml-auto shrink-0">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <p className={`font-mono text-[11px] leading-relaxed ${
                    index === 0 ? 'text-pyth-text typing-cursor' : 'text-pyth-text-dim'
                  }`}>
                    {log.message}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer — SENTINEL status line */}
      <div className="px-4 py-2 border-t border-pyth-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="w-3 h-3 text-pyth-purple animate-spin" style={{ animationDuration: '3s' }} />
          <span className="font-mono text-[10px] text-pyth-text-muted">
            Chain-of-Thought reasoning active
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-pyth-green sentinel-blink" />
          <span className="font-mono text-[9px] text-pyth-green/80 tracking-widest sentinel-blink">
            SENTINEL_V1.0_READY
          </span>
        </div>
      </div>
    </div>
  );
}
