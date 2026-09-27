import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { Quest, TraitDefinition } from '../../types';

interface QuestTrackerProps {
  quests: Quest[];
  activeFlags: string[];
  completedQuestIds: string[];
  traitScores: Record<string, number>;
  traitVocabulary: TraitDefinition[];
  currentChapterId: string;
}

type QuestStatus = 'active' | 'complete' | 'missed' | 'locked';

function getQuestStatus(
  quest: Quest,
  activeFlags: string[],
  completedQuestIds: string[],
  traitScores: Record<string, number>
): QuestStatus {
  if (completedQuestIds.includes(quest.quest_id)) return 'complete';

  // Missed: expires_after_flag fired but not done
  if (quest.expires_after_flag && activeFlags.includes(quest.expires_after_flag)) return 'missed';

  // Locked: required_trait not met
  if (quest.required_trait) {
    const tierScores: Record<string, number> = { none: 0, emerging: 1, established: 3, dominant: 5 };
    const needed = tierScores[quest.required_trait.strength] ?? 0;
    const have = traitScores[quest.required_trait.name] ?? 0;
    if (have < needed) return 'locked';
  }

  return 'active';
}

const statusConfig: Record<QuestStatus, { icon: string; color: string; label: string }> = {
  active: { icon: '🟡', color: '#f59e0b', label: 'Active' },
  complete: { icon: '✅', color: '#10b981', label: 'Complete' },
  missed: { icon: '❌', color: '#ef4444', label: 'Missed' },
  locked: { icon: '🔒', color: '#6b7280', label: 'Locked' },
};

export const QuestTracker: React.FC<QuestTrackerProps> = ({
  quests,
  activeFlags,
  completedQuestIds,
  traitScores,
  traitVocabulary,
  currentChapterId,
}) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const chapterQuests = quests.filter(q => q.chapter_id === currentChapterId);
  const allQuests = quests; // For global view

  const counts = { active: 0, complete: 0, missed: 0, locked: 0 };
  chapterQuests.forEach(q => {
    counts[getQuestStatus(q, activeFlags, completedQuestIds, traitScores)]++;
  });

  if (chapterQuests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-700 text-xs font-mono px-4 text-center">
        No quests for this chapter
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status pills */}
      <div className="flex gap-2 flex-wrap px-4 pb-3 pt-1">
        {Object.entries(counts).map(([status, count]) => count > 0 && (
          <span key={status} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800"
            style={{ color: statusConfig[status as QuestStatus].color }}>
            {statusConfig[status as QuestStatus].icon} {count}
          </span>
        ))}
      </div>

      {/* Quest list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 px-4 pb-4">
        {chapterQuests.map(quest => {
          const status = getQuestStatus(quest, activeFlags, completedQuestIds, traitScores);
          const cfg = statusConfig[status];
          const isOpen = expanded === quest.quest_id;

          return (
            <div key={quest.quest_id} className="rounded-xl border border-slate-800/60 overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : quest.quest_id)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-900/40 transition-colors"
              >
                <span className="text-sm mt-0.5 shrink-0">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium leading-snug" style={{ color: status === 'active' ? '#e2e8f0' : `${cfg.color}` }}>
                    {quest.title}
                  </div>
                  <div className="text-[9px] font-mono text-slate-600 mt-0.5 capitalize">{quest.type?.replace(/_/g, ' ')}</div>
                </div>
                {isOpen
                  ? <ChevronDown className="w-3 h-3 text-slate-600 shrink-0 mt-1" />
                  : <ChevronRight className="w-3 h-3 text-slate-600 shrink-0 mt-1" />
                }
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-800/40 space-y-2">
                  <p className="text-[11px] text-slate-400 leading-relaxed">{quest.objective}</p>
                  {quest.journal_entry && (
                    <p className="text-[10px] text-slate-500 italic leading-relaxed border-l border-slate-700 pl-2">
                      "{quest.journal_entry}"
                    </p>
                  )}
                  {quest.required_trait && (
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-600">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Requires {quest.required_trait.name} ({quest.required_trait.strength})</span>
                    </div>
                  )}
                  {quest.reward_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {quest.reward_flags.map(f => (
                        <span key={f} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-600">+{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
