import React, { useState } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import { Check, RotateCcw, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

export const CheckpointBanner: React.FC = () => {
  const {
    activeCheckpoint,
    resumePipeline,
    isGenerating,
    currentStage,
  } = useStoryStore();

  const [notes, setNotes] = useState('');

  if (!activeCheckpoint) return null;

  const stageTitles: Record<string, string> = {
    stage_1_story_arc: 'Stage 1: Story Arc & Trait Vocabulary Review',
    stage_2_chapter_breakdown: 'Stage 2: Chapter Contracts Review (6-8 Contracts)',
    stage_3_transitions: 'Stage 3: Chapter Transitions Review',
    stage_4_chapter_authoring: 'Stage 4: Chapter Content Review (Prose & Dialogue)',
    stage_5_quest_mapping: 'Stage 5: Quest Mapping & Gating Review',
  };

  const currentTitle = stageTitles[currentStage] || `Checkpoint ${activeCheckpoint.checkpoint} Review`;

  return (
    <div className="w-full bg-gradient-to-r from-[#181308] via-[#121929] to-[#181308] border-b-2 border-amber-500/60 px-6 py-3.5 shadow-2xl z-20 shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Checkpoint Status Indicator */}
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/60 flex items-center justify-center text-amber-400 font-bold shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-300 font-mono tracking-wide uppercase">
                Checkpoint {activeCheckpoint.checkpoint} Active
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold border border-amber-500/30">
                Action Required
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              {currentTitle}
            </h3>
            <span className="text-[11px] text-slate-400 block -mt-0.5">
              Inspect generated assets below. Approve to unlock next pipeline stage, or request targeted edits.
            </span>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter revision notes (e.g. 'darker tone', 'add conflict')..."
              className="w-72 md:w-80 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 shadow-inner"
            />
          </div>

          {/* Regenerate Button */}
          <button
            onClick={() => {
              resumePipeline('regenerate', notes);
              setNotes('');
            }}
            disabled={isGenerating}
            title="Re-run agent pass with your notes"
            className="px-3.5 py-2 bg-slate-900 hover:bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:border-amber-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Regenerate</span>
          </button>

          {/* Approve & Continue Primary Button */}
          <button
            onClick={() => resumePipeline('approve')}
            disabled={isGenerating}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Approve & Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
