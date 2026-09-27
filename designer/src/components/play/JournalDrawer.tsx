import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { usePlayStore, JournalEntry } from '../../store/usePlayStore';
import { TraitDefinition } from '../../types';

interface JournalDrawerProps {
  traitVocabulary: TraitDefinition[];
}

const entryTypeConfig: Record<JournalEntry['type'], { icon: string; color: string }> = {
  chapter: { icon: '📖', color: '#6366f1' },
  scene: { icon: '🎬', color: '#94a3b8' },
  choice: { icon: '◆', color: '#f59e0b' },
  quest_complete: { icon: '✅', color: '#10b981' },
  transition: { icon: '→', color: '#475569' },
};

export const JournalDrawer: React.FC<JournalDrawerProps> = ({ traitVocabulary }) => {
  const { isJournalOpen, toggleJournal, journalEntries, choiceHistory } = usePlayStore();

  if (!isJournalOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30"
        onClick={toggleJournal}
      />

      {/* Drawer */}
      <div
        className="absolute right-0 top-0 bottom-0 w-80 z-40 flex flex-col border-l border-slate-800 bg-[#080d1c]/98 backdrop-blur-xl"
        style={{ animation: 'slideInRight 0.25s ease forwards' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">Playthrough Journal</span>
          </div>
          <button onClick={toggleJournal} className="text-slate-600 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-5 py-3 border-b border-slate-800/60 flex gap-4 shrink-0">
          <div className="text-center">
            <div className="text-lg font-bold text-slate-200">{choiceHistory.length}</div>
            <div className="text-[9px] font-mono text-slate-600 uppercase">Choices</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-400">
              {journalEntries.filter(e => e.type === 'quest_complete').length}
            </div>
            <div className="text-[9px] font-mono text-slate-600 uppercase">Quests</div>
          </div>
          {traitVocabulary.map(t => (
            <div key={t.name} className="text-center">
              <div className="text-lg font-bold" style={{ color: t.color_hex }}>
                {choiceHistory.filter(c => c.traitTag === t.name).length}
              </div>
              <div className="text-[9px] font-mono text-slate-600 uppercase">{t.name.slice(0, 3)}</div>
            </div>
          ))}
        </div>

        {/* Journal entries */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1">
          {journalEntries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-700 text-xs font-mono">
              No entries yet
            </div>
          ) : (
            [...journalEntries].reverse().map((entry, i) => {
              const cfg = entryTypeConfig[entry.type];
              const traitMatch = entry.type === 'choice'
                ? traitVocabulary.find(t => entry.detail.includes(`[${t.name}]`))
                : null;

              return (
                <div key={i} className="flex items-start gap-3 px-5 py-2.5 hover:bg-slate-900/30 transition-colors">
                  <span className="text-sm shrink-0 mt-0.5 w-4 text-center">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs leading-snug font-medium"
                      style={{
                        color: traitMatch ? traitMatch.color_hex : cfg.color,
                      }}
                    >
                      {entry.label}
                    </div>
                    {entry.detail && (
                      <div className="text-[10px] text-slate-600 mt-0.5 leading-relaxed truncate">
                        {entry.detail.replace(/\[.*?\]/g, '').trim()}
                      </div>
                    )}
                  </div>
                  {traitMatch && (
                    <span
                      className="text-[8px] font-mono px-1 py-0.5 rounded shrink-0"
                      style={{ color: traitMatch.color_hex, background: `${traitMatch.color_hex}15` }}
                    >
                      {traitMatch.name}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
};
