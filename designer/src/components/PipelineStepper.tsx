import React from 'react';
import { useStoryStore } from '../store/useStoryStore';
import {
  Check,
  ChevronRight,
  CircleDot,
  Loader2,
  Clock,
  Sparkles,
  Layers,
  ArrowRightLeft,
  PenTool,
  Compass,
  Download,
  Users2,
} from 'lucide-react';

interface Step {
  id: string;
  stageKey: string;
  number: number | string;
  label: string;
  sublabel: string;
  icon: any;
  targetView: 'overview' | 'quests' | 'dialogue' | 'traits' | 'cast-world' | 'export' | 'debug';
}

const STEPS: Step[] = [
  {
    id: 'step_1',
    stageKey: 'stage_1_story_arc',
    number: 1,
    label: 'Story Arc',
    sublabel: 'Director & Traits',
    icon: Sparkles,
    targetView: 'overview',
  },
  {
    id: 'step_2',
    stageKey: 'stage_3_5_world_cast',
    number: 2,
    label: 'Cast & World',
    sublabel: 'Characters & Bible',
    icon: Users2,
    targetView: 'cast-world',
  },
  {
    id: 'step_3',
    stageKey: 'stage_2_chapter_breakdown',
    number: 3,
    label: 'Chapter Contracts',
    sublabel: 'Entry/Exit Gates',
    icon: Layers,
    targetView: 'overview',
  },
  {
    id: 'step_4',
    stageKey: 'stage_3_transitions',
    number: 4,
    label: 'Transitions',
    sublabel: 'Narrative Bridges',
    icon: ArrowRightLeft,
    targetView: 'overview',
  },
  {
    id: 'step_5',
    stageKey: 'stage_4_chapter_authoring',
    number: 5,
    label: 'Chapter Authoring',
    sublabel: 'Narrator ↔ Critic',
    icon: PenTool,
    targetView: 'dialogue',
  },
  {
    id: 'step_6',
    stageKey: 'stage_5_quest_mapping',
    number: 6,
    label: 'Quest Mapping',
    sublabel: 'Architect Annotations',
    icon: Compass,
    targetView: 'quests',
  },
  {
    id: 'step_7',
    stageKey: 'export_complete',
    number: 7,
    label: 'Game Package',
    sublabel: 'JSON Export',
    icon: Download,
    targetView: 'export',
  },
];

export const PipelineStepper: React.FC = () => {
  const { currentStage, activeCheckpoint, isGenerating, setActiveView } = useStoryStore();

  const getStageIndex = (stage: string) => {
    switch (stage) {
      case 'stage_1_story_arc': return 0;
      case 'stage_3_5_world_cast': return 1;
      case 'stage_2_chapter_breakdown': return 2;
      case 'stage_3_transitions': return 3;
      case 'stage_4_chapter_authoring': return 4;
      case 'stage_5_quest_mapping': return 5;
      case 'export_complete': return 6;
      default: return 0;
    }
  };

  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="w-full bg-[#0a0f1d] border-b border-slate-800 px-6 py-2.5 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isPending = idx > currentIndex;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => setActiveView(step.targetView)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition-all group ${
                  isCurrent
                    ? 'bg-blue-600/15 border border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                    : isCompleted
                    ? 'text-slate-300 hover:bg-slate-900/60'
                    : 'text-slate-600 hover:text-slate-500'
                }`}
              >
                {/* Step Circle Indicator */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold shrink-0 transition-all ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : isCurrent
                      ? isGenerating
                        ? 'bg-blue-500 text-white'
                        : 'bg-amber-500 text-slate-950 font-black animate-pulse'
                      : 'bg-slate-900 text-slate-600 border border-slate-800'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : isCurrent && isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    step.number
                  )}
                </div>

                {/* Step Text */}
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-semibold ${
                        isCurrent
                          ? 'text-blue-200'
                          : isCompleted
                          ? 'text-slate-200'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block">
                    {step.sublabel}
                  </span>
                </div>
              </button>

              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-800 shrink-0 mx-0.5" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Actionable Step Instruction Pill */}
      <div className="hidden xl:flex items-center gap-2 text-xs bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800/80 font-mono">
        <CircleDot className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-slate-400">Step {currentIndex + 1} of 7:</span>
        <span className="text-amber-300 font-medium">
          {activeCheckpoint
            ? `Checkpoint ${activeCheckpoint.checkpoint} Active — Review & Approve`
            : isGenerating
            ? 'Generating Stage Assets...'
            : 'Stage Complete'}
        </span>
      </div>
    </div>
  );
};
