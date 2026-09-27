import React from 'react';
import { MapPin, ChevronRight } from 'lucide-react';
import { usePlayStore } from '../../store/usePlayStore';
import { AuthoredChapter, ChapterContract } from '../../types';

interface ChapterIntroProps {
  chapter: AuthoredChapter;
  contract: ChapterContract | undefined;
  chapterIndex: number;
  totalChapters: number;
}

export const ChapterIntro: React.FC<ChapterIntroProps> = ({ chapter, contract, chapterIndex, totalChapters }) => {
  const dismissChapterIntro = usePlayStore(s => s.dismissChapterIntro);

  // Determine which act this chapter belongs to
  const actNumber = chapterIndex < Math.ceil(totalChapters / 3) ? 1
    : chapterIndex < Math.ceil((2 * totalChapters) / 3) ? 2 : 3;

  return (
    <div
      className="relative flex flex-col items-center justify-center h-full w-full cursor-pointer overflow-hidden"
      onClick={dismissChapterIntro}
      style={{ animation: 'chapterFadeIn 0.6s ease forwards' }}
    >
      {/* Deep backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050810] via-[#08102a] to-[#060911]" />

      {/* Decorative grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/8 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-2xl gap-6">
        {/* Act badge */}
        <div className="text-7xl font-bold font-mono text-slate-800 select-none leading-none" aria-hidden>
          {String(chapterIndex + 1).padStart(2, '0')}
        </div>

        <div className="flex items-center gap-3 -mt-2">
          <div className="h-px w-12 bg-amber-500/40" />
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400/70">Act {actNumber} · Chapter {chapterIndex + 1}</span>
          <div className="h-px w-12 bg-amber-500/40" />
        </div>

        {/* Chapter title */}
        <h2 className="text-5xl font-bold text-slate-100 leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {contract?.title || chapter.chapter_id}
        </h2>

        {/* Scope */}
        {contract?.narrative_scope && (
          <p className="text-slate-400 text-base leading-relaxed max-w-lg" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {contract.narrative_scope}
          </p>
        )}

        {/* Location */}
        {contract?.entry_state?.location && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-800">
            <MapPin className="w-3.5 h-3.5 text-blue-500/60" />
            <span>{contract.entry_state.location}</span>
          </div>
        )}

        {/* Click to continue */}
        <div className="flex items-center gap-2 mt-4 text-slate-600 text-xs animate-pulse">
          <span>Click anywhere to begin</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Edge fades */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#060911] to-transparent pointer-events-none" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap');
        @keyframes chapterFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
