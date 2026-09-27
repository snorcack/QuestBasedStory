import React from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { ChapterTransition } from '../../types';

interface TransitionCardProps {
  transition: ChapterTransition;
  onContinue: () => void;
}

export const TransitionCard: React.FC<TransitionCardProps> = ({ transition, onContinue }) => {
  const deltas = Object.entries(transition.state_delta || {});

  return (
    <div className="flex items-center justify-center h-full w-full px-8" style={{ animation: 'fadeInUp 0.5s ease forwards' }}>
      <div className="max-w-xl w-full space-y-8">
        {/* Transition label */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700" />
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
            <ArrowRight className="w-3 h-3" />
            <span>{transition.from_chapter_id} → {transition.to_chapter_id}</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700" />
        </div>

        {/* Scene summary prose */}
        <p className="text-slate-300 text-lg leading-[1.9] text-center italic" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          "{transition.scene_summary}"
        </p>

        {/* State delta pills */}
        {deltas.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {deltas.map(([k, v]) => (
              <span key={k} className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-500">
                {k}: <span className="text-slate-300">{String(v)}</span>
              </span>
            ))}
          </div>
        )}

        {/* Narrative hook */}
        {transition.narrative_hook && (
          <div className="border-l-2 border-amber-500/50 pl-5">
            <p className="text-amber-300/80 text-sm leading-relaxed" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {transition.narrative_hook}
            </p>
          </div>
        )}

        {/* Continue */}
        <div className="flex justify-center">
          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-8 py-3 rounded-xl border border-slate-700 hover:border-indigo-500/50 bg-slate-900/60 hover:bg-indigo-950/30 text-slate-300 hover:text-white text-sm font-medium transition-all"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
