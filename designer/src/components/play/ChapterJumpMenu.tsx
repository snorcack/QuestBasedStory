import React, { useState } from 'react';
import { ChevronRight, MapPin, Sliders } from 'lucide-react';
import { usePlayStore } from '../../store/usePlayStore';
import { AuthoredChapter, ChapterContract, TraitDefinition } from '../../types';

interface ChapterJumpMenuProps {
  chapters: AuthoredChapter[];
  contracts: ChapterContract[];
  traitVocabulary: TraitDefinition[];
}

const traitTierToScore = (tier: string): number => {
  switch (tier) {
    case 'emerging': return 1;
    case 'established': return 3;
    case 'dominant': return 5;
    default: return 0;
  }
};

export const ChapterJumpMenu: React.FC<ChapterJumpMenuProps> = ({ chapters, contracts, traitVocabulary }) => {
  const { goToChapter, chapterTraitConfigs, setChapterTraitConfig } = usePlayStore();

  // Local trait score state per chapter
  const [localScores, setLocalScores] = useState<Record<string, Record<string, number>>>(() => {
    const init: Record<string, Record<string, number>> = {};
    chapters.forEach((ch, _idx) => {
      const contract = contracts.find(c => c.chapter_id === ch.chapter_id);
      const snapshot = contract?.entry_state?.trait_snapshot || {};
      init[ch.chapter_id] = {};
      for (const t of traitVocabulary) {
        init[ch.chapter_id][t.name] = traitTierToScore(snapshot[t.name] || 'none');
      }
    });
    return init;
  });

  const [expandedChapter, setExpandedChapter] = useState<string | null>(chapters[0]?.chapter_id || null);

  const handleTraitChange = (chapterId: string, traitName: string, value: number) => {
    const updated = { ...localScores[chapterId], [traitName]: value };
    setLocalScores(prev => ({ ...prev, [chapterId]: updated }));
    setChapterTraitConfig(chapterId, updated);
  };

  const handleEnter = (index: number, chapterId: string) => {
    goToChapter(index, chapters as any[], traitVocabulary, localScores[chapterId]);
  };

  const scoreToLabel = (score: number): string => {
    if (score === 0) return 'None';
    if (score <= 2) return 'Emerging';
    if (score <= 4) return 'Established';
    return 'Dominant';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ animation: 'fadeInUp 0.4s ease forwards' }}>
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px w-8 bg-amber-500/50" />
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-400/70">Choose Chapter</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Select Your Entry Point
        </h2>
        <p className="text-xs text-slate-500 mt-1">Configure your trait levels before entering any chapter.</p>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-3">
        {chapters.map((chapter, index) => {
          const contract = contracts.find(c => c.chapter_id === chapter.chapter_id);
          const isExpanded = expandedChapter === chapter.chapter_id;
          const scores = localScores[chapter.chapter_id] || {};

          return (
            <div
              key={chapter.chapter_id}
              className={`rounded-2xl border transition-all overflow-hidden ${isExpanded ? 'border-indigo-500/40 bg-indigo-950/20' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'}`}
            >
              {/* Chapter header row */}
              <button
                onClick={() => setExpandedChapter(isExpanded ? null : chapter.chapter_id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-400 shrink-0">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-200 truncate">{contract?.title || chapter.chapter_id}</div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{contract?.narrative_scope?.slice(0, 80)}…</div>
                </div>
                {contract?.entry_state?.location && (
                  <span className="hidden md:flex items-center gap-1 text-[10px] font-mono text-slate-600 shrink-0">
                    <MapPin className="w-3 h-3" />{contract.entry_state.location}
                  </span>
                )}
                <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              {/* Expanded: trait config + enter */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-800/60 pt-4 space-y-4">
                  {traitVocabulary.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Sliders className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Trait Config for this Chapter</span>
                      </div>
                      <div className="space-y-3">
                        {traitVocabulary.map(trait => {
                          const val = scores[trait.name] ?? 0;
                          return (
                            <div key={trait.name} className="flex items-center gap-4">
                              <span className="text-xs font-medium w-20 shrink-0" style={{ color: trait.color_hex }}>{trait.name}</span>
                              <div className="flex-1 relative">
                                <input
                                  type="range"
                                  min={0}
                                  max={5}
                                  step={1}
                                  value={val}
                                  onChange={e => handleTraitChange(chapter.chapter_id, trait.name, Number(e.target.value))}
                                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                  style={{
                                    background: `linear-gradient(to right, ${trait.color_hex} 0%, ${trait.color_hex} ${val * 20}%, #1e293b ${val * 20}%, #1e293b 100%)`,
                                    accentColor: trait.color_hex,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-mono w-20 text-right shrink-0" style={{ color: val > 0 ? trait.color_hex : '#475569' }}>
                                {scoreToLabel(val)} ({val}/5)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Chapter info pills */}
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-600">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800">{chapter.scenes?.length || 0} scenes</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800">{chapter.dialogue_tree?.length || 0} dialogue nodes</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800">{chapter.quests?.length || 0} quests</span>
                  </div>

                  <button
                    onClick={() => handleEnter(index, chapter.chapter_id)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Enter Chapter {index + 1}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap');
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
