import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, List, X, Map } from 'lucide-react';
import { usePlayStore } from '../../store/usePlayStore';
import { useStoryStore } from '../../store/useStoryStore';
import { AuthoredChapter, ChapterContract } from '../../types';

interface PlayControlsProps {
  chapters: AuthoredChapter[];
  contracts: ChapterContract[];
  currentChapterIndex: number;
  currentSceneIndex: number;
  totalScenes: number;
  phase: string;
  onNext: () => void;
  onPrev: () => void;
}

export const PlayControls: React.FC<PlayControlsProps> = ({
  chapters,
  contracts,
  currentChapterIndex,
  currentSceneIndex,
  totalScenes,
  phase,
  onNext,
  onPrev,
}) => {
  const { toggleJournal, openChapterJump, reset, isJournalOpen } = usePlayStore();
  const setActiveView = useStoryStore(s => s.setActiveView);
  const [showChapterPicker, setShowChapterPicker] = useState(false);

  const handleExit = () => {
    reset();
    setActiveView('overview');
  };

  const canGoBack = phase === 'scene' && currentSceneIndex > 0;
  const showProgress = phase === 'scene' || phase === 'dialogue';

  const currentChapter = chapters[currentChapterIndex];
  const contract = contracts.find(c => c.chapter_id === currentChapter?.chapter_id);

  return (
    <div className="shrink-0 h-14 flex items-center justify-between px-6 border-t border-slate-800/80 bg-[#070b18]/95 backdrop-blur z-20">
      {/* Left: Prev + chapter info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          disabled={!canGoBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Chapter label */}
        {currentChapter && (
          <div className="hidden md:flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-600">CH {String(currentChapterIndex + 1).padStart(2, '0')}</span>
            <span className="text-xs text-slate-400 max-w-[200px] truncate">{contract?.title || currentChapter.chapter_id}</span>
          </div>
        )}
      </div>

      {/* Center: Progress */}
      <div className="flex items-center gap-3">
        {showProgress && (
          <div className="flex items-center gap-2">
            {/* Scene dots */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalScenes, 12) }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === currentSceneIndex ? '16px' : '5px',
                    height: '5px',
                    background: i < currentSceneIndex ? '#475569' : i === currentSceneIndex ? '#6366f1' : '#1e293b',
                  }}
                />
              ))}
              {totalScenes > 12 && <span className="text-[9px] text-slate-600 ml-1">+{totalScenes - 12}</span>}
            </div>
            {phase === 'dialogue' && (
              <span className="text-[9px] font-mono text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">DIALOGUE</span>
            )}
          </div>
        )}

        {/* Chapter jump button */}
        <button
          onClick={() => { openChapterJump(); setShowChapterPicker(false); }}
          title="Chapter Select"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 text-xs transition-all"
        >
          <Map className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Chapters</span>
        </button>
      </div>

      {/* Right: Journal + Next + Exit */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleJournal}
          title="Toggle Journal (J)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
            isJournalOpen
              ? 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10'
              : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Journal</span>
        </button>

        {(phase === 'scene' || phase === 'transition') && (
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={handleExit}
          title="Exit Play Mode (Esc)"
          className="p-1.5 rounded-lg border border-slate-800 text-slate-600 hover:text-rose-400 hover:border-rose-500/30 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
