// ── Educational Info Tooltip ──
// Hover/click tooltips that explain Pyth concepts throughout the dashboard.
// Targets "Best Educational Content" hackathon category.

import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InfoTooltipProps {
  /** Short title shown in tooltip header */
  title: string;
  /** Educational description */
  content: string;
  /** Optional "Learn more" URL */
  learnMoreUrl?: string;
  /** Icon size in pixels */
  size?: number;
  /** Custom classes for the icon */
  className?: string;
}

export default function InfoTooltip({
  title,
  content,
  learnMoreUrl,
  size = 12,
  className = '',
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside / escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`text-pyth-text-muted/40 hover:text-pyth-purple transition-colors cursor-help ${className}`}
        aria-label={`Learn about ${title}`}
      >
        <HelpCircle style={{ width: size, height: size }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[9999]
              w-64 sm:w-72 p-3 rounded-xl
              bg-[#1a1a2e]/95 backdrop-blur-xl
              border border-pyth-purple/30 shadow-lg shadow-pyth-purple/10"
            style={{ pointerEvents: 'auto' }}
          >
            <p className="font-mono text-[10px] font-bold text-pyth-purple uppercase tracking-wider mb-1.5">
              {title}
            </p>
            <p className="font-mono text-[10px] text-pyth-text-dim leading-relaxed">
              {content}
            </p>
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 font-mono text-[9px] text-pyth-purple hover:underline"
              >
                Learn more →
              </a>
            )}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 rotate-45 bg-[#1a1a2e]/95 border-r border-b border-pyth-purple/30" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
