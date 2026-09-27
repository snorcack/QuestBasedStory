import React from 'react';
import { Play, BookOpen } from 'lucide-react';
import { usePlayStore } from '../../store/usePlayStore';
import { StoryArc, TraitDefinition } from '../../types';

interface TitleScreenProps {
  storyArc: StoryArc;
  chapterCount: number;
  traitVocabulary: TraitDefinition[];
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ storyArc, chapterCount, traitVocabulary }) => {
  const begin = usePlayStore(s => s.begin);

  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full overflow-hidden select-none">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-3xl" />
      </div>

      {/* Decorative top line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl px-8 gap-8" style={{ animation: 'fadeInUp 0.8s ease forwards' }}>
        {/* Genre tag */}
        <div className="flex items-center gap-3">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/60" />
          <span className="text-[11px] font-mono uppercase tracking-[0.3em] text-amber-400/80">{storyArc.genre}</span>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/60" />
        </div>

        {/* Title */}
        <h1 className="text-6xl font-bold leading-tight tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", background: 'linear-gradient(135deg, #f1f5f9 30%, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {storyArc.title}
        </h1>

        {/* Tone */}
        <p className="text-slate-400 text-sm font-light italic tracking-wide">{storyArc.tone}</p>

        {/* Central conflict */}
        <p className="text-slate-300 text-base leading-relaxed max-w-xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {storyArc.central_conflict}
        </p>

        {/* Traits */}
        {traitVocabulary.length > 0 && (
          <div className="flex items-center gap-3">
            {traitVocabulary.map(t => (
              <span
                key={t.name}
                className="text-xs font-mono px-3 py-1 rounded-full border"
                style={{ borderColor: `${t.color_hex}50`, color: t.color_hex, background: `${t.color_hex}12` }}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-6 text-xs text-slate-500 font-mono">
          <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{chapterCount} chapters</span>
          <span>•</span>
          <span>{storyArc.acts.length} acts</span>
          {storyArc.themes.length > 0 && (
            <>
              <span>•</span>
              <span>{storyArc.themes.slice(0, 2).join(', ')}</span>
            </>
          )}
        </div>

        {/* Begin button */}
        <button
          onClick={begin}
          className="group mt-4 flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-sm shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105 hover:shadow-indigo-600/50"
        >
          <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
          Begin Story
        </button>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060911] to-transparent pointer-events-none" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap');
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
