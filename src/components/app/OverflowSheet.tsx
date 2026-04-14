import React from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_BUILD_STAMP } from '@/lib/buildInfo';

export type OverflowItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  section: string;
};

type OverflowSheetProps = {
  show: boolean;
  items: OverflowItem[];
  activeView: 'home' | 'tab';
  activeTab: string;
  coachIconColor: string;
  onClose: () => void;
  onSelect: (id: string) => void;
};

const sheetSpring = { type: 'spring' as const, stiffness: 400, damping: 35 };

export function OverflowSheet({
  show,
  items,
  activeView,
  activeTab,
  coachIconColor,
  onClose,
  onSelect,
}: OverflowSheetProps) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            className="overflow-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="overflow-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetSpring}
          >
            <div className="overflow-handle" />
            {items.map((item, i) => {
              const Icon = item.icon;
              const previous = items[i - 1];
              const active = activeView === 'tab'
                ? activeTab === item.id
                : item.id === 'home' && activeView === 'home';
              const showSection = !previous || previous.section !== item.section;

              return (
                <React.Fragment key={item.id}>
                  {showSection ? (
                    <div className="overflow-section-title">{item.section}</div>
                  ) : (
                    <div className="overflow-sep" />
                  )}
                  <button
                    className={`overflow-row ${active ? 'is-active' : ''}`}
                    onClick={() => onSelect(item.id)}
                  >
                    <Icon
                      size={20}
                      className="overflow-row-icon"
                      style={item.id === 'coach' ? { color: coachIconColor } : undefined}
                    />
                    <div className="overflow-row-text">
                      <span className="overflow-row-label">{item.label}</span>
                    </div>
                    <div className="overflow-row-meta">
                      {active ? <span className="overflow-row-active">Öppen</span> : null}
                      <ChevronRight size={16} className="overflow-row-chevron" />
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
            <div className="overflow-build-stamp">
              Version {APP_BUILD_STAMP}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
