import React, { useState, useEffect, useRef, useCallback } from 'react';
import { S } from '@/state/store';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, Zap, Activity, Download, Shield, Settings, Search } from 'lucide-react';

const COMMANDS = [
  { id: 'metrics', label: 'Uppdatera metrics', icon: BarChart2 },
  { id: 'generate', label: 'Generera quests för alla', icon: Zap },
  { id: 'activity', label: 'Visa aktivitetslogg', icon: Activity },
  { id: 'export', label: 'Exportera banddata', icon: Download },
  { id: 'admin', label: 'Växla admin-läge', icon: Shield, shortcut: '⌘A' },
  { id: 'settings', label: 'Öppna Headquarters-inställningar', icon: Settings, shortcut: '⌘,' },
];

interface CommandPaletteProps {
  onClose: () => void;
  isMobile?: boolean;
  onOpenAdminCenter?: () => void;
}

export default function CommandPalette({ onClose, isMobile, onOpenAdminCenter }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIdx];
      if (cmd?.id === 'admin') onOpenAdminCenter?.();
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered.length, onClose]);

  const content = (
    <>
      <div className="cmd-input-wrap">
        <Search size={16} className="cmd-input-icon" />
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Vad vill du göra..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="cmd-list">
        {filtered.map((cmd, i) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.id}
              className={`cmd-item ${i === selectedIdx ? 'selected' : ''}`}
              onClick={() => {
                if (cmd.id === 'admin') onOpenAdminCenter?.();
                onClose();
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <Icon size={16} className="cmd-item-icon" />
              <span className="cmd-item-label">{cmd.label}</span>
              {cmd.shortcut && <span className="cmd-item-shortcut">{cmd.shortcut}</span>}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="cmd-empty">Inga kommandon hittades.</div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          className="cmd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="cmd-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 350, damping: 40 }}
        >
          <div className="cmd-sheet-handle" />
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="cmd-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="cmd-modal"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
