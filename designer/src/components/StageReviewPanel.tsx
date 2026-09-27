import React, { useState } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import { Sparkles, X, BookOpen, Layers, ArrowRightLeft, Compass, Download, Users2 } from 'lucide-react';

const STAGE_DEFAULTS: Record<string, { headline: string; bullets: string[]; review_guidance: string }> = {
  stage_1_story_arc: {
    headline: 'Story Arc and Trait Vocabulary generated.',
    bullets: [
      'A complete story arc with protagonist, antagonist, and central conflict was created.',
      'Two narrative trait dimensions defined to drive player choices.',
      'Acts I-III outlined with thematic summaries.',
    ],
    review_guidance: 'Review the Story Overview tab. Verify tone, genre, and central conflict match your vision.',
  },
  stage_2_chapter_breakdown: {
    headline: 'Chapter Contracts generated across all acts.',
    bullets: [
      'Each chapter has fixed entry/exit location gates and trait snapshots.',
      'Attachment points reserved for optional side quest injection.',
      'Act structure preserved across all contracts.',
    ],
    review_guidance: 'Review the Story Overview tab. Check that chapter count, order, and states make narrative sense.',
  },
  stage_3_transitions: {
    headline: 'Chapter transitions authored as narrative bridges.',
    bullets: [
      'Each pair of adjacent chapters has a transition scene summary.',
      'State deltas (inventory, flags, traits) bridged between chapters.',
      'Narrative hooks set to draw the player forward.',
    ],
    review_guidance: 'Inspect transitions in Story Overview. Verify each bridge feels narratively motivated.',
  },
  stage_3_5_world_cast: {
    headline: 'Characters and World Bible generated.',
    bullets: [
      'Full cast created with backstory, motivation, flaw, and arc.',
      'World Bible generated: locations, factions, NPCs, rules, and timeline.',
      'Character relationship map built with directed edges.',
    ],
    review_guidance: 'Open the Cast & World tab. You can inline-edit any field or provide feedback for regeneration before chapter authoring begins.',
  },
  stage_4_chapter_authoring: {
    headline: 'Chapter prose and dialogue authored by Narrator and Critic.',
    bullets: [
      'Scene-by-scene prose authored for this chapter.',
      'Dialogue tree with branching choices and trait tags created.',
      'Critic evaluated and approved the chapter quality.',
    ],
    review_guidance: 'Open the Dialogue tab to review scenes and dialogue tree. Check emotional beats and trait choices.',
  },
  stage_5_quest_mapping: {
    headline: 'Quest map generated with gating and achievements.',
    bullets: [
      'Main blocking quests generated for each chapter.',
      'Latent advantage and side quests identified across the story.',
      'Trait reachability validated for all blocking quest gates.',
    ],
    review_guidance: 'Open the Quest Graph tab. Verify all main quests are achievable with available trait choices.',
  },
};

const STAGE_ICONS: Record<string, any> = {
  stage_1_story_arc: Sparkles,
  stage_2_chapter_breakdown: Layers,
  stage_3_transitions: ArrowRightLeft,
  stage_3_5_world_cast: Users2,
  stage_4_chapter_authoring: BookOpen,
  stage_5_quest_mapping: Compass,
  export_complete: Download,
};

export const StageReviewPanel: React.FC = () => {
  const { currentStage, activeCheckpoint, chapterContracts, characters, worldBible, questGraph } = useStoryStore();
  const [dismissed, setDismissed] = useState(false);

  if (!activeCheckpoint || dismissed) return null;
  const summary = STAGE_DEFAULTS[currentStage];
  if (!summary) return null;

  const Icon = STAGE_ICONS[currentStage] || Sparkles;

  const counts: Record<string, number> = {};
  if (currentStage === 'stage_2_chapter_breakdown') counts['Chapters'] = chapterContracts.length;
  if (currentStage === 'stage_3_5_world_cast') {
    counts['Characters'] = characters.length;
    counts['Locations'] = worldBible?.locations?.length ?? 0;
    counts['NPCs'] = worldBible?.npcs?.length ?? 0;
  }
  if (currentStage === 'stage_5_quest_mapping') counts['Quests'] = questGraph.length;

  return (
    <div className="w-full bg-gradient-to-r from-[#0d1525] via-[#0a1020] to-[#0d1525] border-b border-blue-500/30 px-6 py-4 shrink-0">
      <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest">Stage Complete</span>
              {Object.entries(counts).map(([label, val]) => (
                <span key={label} className="text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                  {val} {label}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold text-slate-100 mb-2">{summary.headline}</p>
            <ul className="space-y-1 mb-3">
              {summary.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-blue-400 mt-0.5 shrink-0">•</span>{b}
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-2 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-800">
              <span className="text-amber-400 text-sm shrink-0">👀</span>
              <p className="text-xs text-slate-300 leading-relaxed">{summary.review_guidance}</p>
            </div>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
