import React, { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  BookOpen,
  MapPin,
  Tag,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Film,
  Users,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { ChapterContract, AuthoredChapter } from '../types';
import { useStoryStore } from '../store/useStoryStore';

interface ChapterNodeData extends ChapterContract {
  authoredChapter?: AuthoredChapter;
}

export const ChapterNode = memo(({ data, selected }: { data: ChapterNodeData; selected?: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Atomic selectors for 60fps performance
  const selectedChapterId = useStoryStore((s) => s.selectedChapterId);
  const setSelectedChapterId = useStoryStore((s) => s.setSelectedChapterId);
  const feedbackNote = useStoryStore((s) => s.chapterFeedback[data.chapter_id]?.note);
  const setChapterFeedback = useStoryStore((s) => s.setChapterFeedback);
  const clearChapterFeedback = useStoryStore((s) => s.clearChapterFeedback);
  const removeChapterContract = useStoryStore((s) => s.removeChapterContract);
  const setActiveView = useStoryStore((s) => s.setActiveView);

  const hasFeedback = !!feedbackNote;

  const exitTraits = Object.entries(data.exit_state?.trait_snapshot || {})
    .filter(([, tier]) => tier !== 'none')
    .map(([name, tier]) => `${name}: ${tier}`)
    .join(', ');

  const handleHeaderClick = useCallback(() => {
    setSelectedChapterId(data.chapter_id);
  }, [data.chapter_id, setSelectedChapterId]);

  const handleOpenDetail = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedChapterId(data.chapter_id);
      setActiveView('dialogue');
    },
    [data.chapter_id, setSelectedChapterId, setActiveView]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(`Delete Chapter "${data.title}" (${data.chapter_id})?`)) {
        removeChapterContract(data.chapter_id);
      }
    },
    [data.title, data.chapter_id, removeChapterContract]
  );

  const isSelected = selected || selectedChapterId === data.chapter_id;

  return (
    <div
      className={`glass-panel rounded-xl text-slate-100 border transition-all shadow-xl w-76 ${
        isSelected
          ? 'border-blue-400 shadow-blue-500/25 ring-2 ring-blue-500/20 shadow-2xl'
          : 'border-blue-500/30 hover:border-blue-400/60'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3.5 h-3.5 bg-blue-500 border-2 border-slate-900 -left-2"
      />

      {/* Header */}
      <div
        className="flex items-center justify-between p-3 pb-2 cursor-pointer select-none border-b border-slate-800/60"
        onClick={handleHeaderClick}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="nodrag w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-400 transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <BookOpen className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-mono font-bold text-blue-400 tracking-wider">
            CH {data.order}
          </span>
        </div>

        <div className="flex items-center gap-1 nodrag">
          {hasFeedback && (
            <span
              className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
              title="Has chapter feedback note"
            />
          )}
          <span className="text-[10px] bg-slate-800/80 text-slate-300 px-1.5 py-0.5 rounded font-mono">
            {data.chapter_id}
          </span>
          <button
            onClick={handleOpenDetail}
            title="Open Chapter Detail & Dialogue"
            className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800/70 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={handleDelete}
            title="Delete Chapter"
            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <h4 className="font-semibold text-sm mb-1 text-slate-100 leading-tight">
          {data.title}
        </h4>
        <p
          className={`text-xs text-slate-300 leading-relaxed mb-2.5 ${
            expanded ? '' : 'line-clamp-2'
          }`}
        >
          {data.narrative_scope}
        </p>

        {/* State summary */}
        <div className="space-y-1 text-[11px] bg-slate-950/70 p-2 rounded-lg border border-slate-800/90 font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">In: {data.entry_state?.location || 'Unassigned'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="truncate">Out: {data.exit_state?.location || 'Unassigned'}</span>
          </div>
          {exitTraits && (
            <div className="flex items-center gap-1.5 text-amber-300">
              <Tag className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{exitTraits}</span>
            </div>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2.5 space-y-2 border-t border-slate-800/80 pt-2.5">
            {data.authoredChapter?.scenes?.length ? (
              <div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mb-1.5">
                  <Film className="w-3 h-3 text-blue-400" /> Scenes ({data.authoredChapter.scenes.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {data.authoredChapter.scenes.map((sc) => (
                    <div
                      key={sc.scene_id}
                      className="text-[10px] bg-slate-900/80 rounded px-2 py-1 border border-slate-800"
                    >
                      <div className="text-slate-200 font-medium">{sc.title}</div>
                      {sc.emotional_beat && (
                        <div className="text-indigo-400 italic text-[9px]">
                          {sc.emotional_beat}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {data.authoredChapter?.characters_present?.length ? (
              <div className="flex items-start gap-1.5 text-[10px] text-slate-400 font-mono">
                <Users className="w-3 h-3 mt-0.5 shrink-0 text-cyan-400" />
                <span className="break-all">
                  {data.authoredChapter.characters_present.join(', ')}
                </span>
              </div>
            ) : null}

            {data.attachment_points?.length > 0 && (
              <div className="flex items-center justify-between text-[10px] text-amber-400 font-mono bg-amber-500/10 rounded px-2 py-1 border border-amber-500/20">
                <span>Side Quest Slots</span>
                <span>{data.attachment_points.length} Open</span>
              </div>
            )}
          </div>
        )}

        {/* Chapter feedback area */}
        {expanded && (
          <div className="mt-2.5 border-t border-slate-800/60 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFeedback(!showFeedback);
              }}
              className={`nodrag flex items-center gap-1.5 text-[10px] font-mono transition-colors ${
                hasFeedback ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              {hasFeedback ? 'Edit Chapter Note' : 'Add Chapter Note'}
            </button>
            {showFeedback && (
              <div className="mt-1.5 nodrag" onClick={(e) => e.stopPropagation()}>
                <textarea
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 resize-none font-sans"
                  rows={3}
                  placeholder="e.g. Make Elena more vulnerable, add tension with Orin..."
                  value={feedbackNote || ''}
                  onChange={(e) => setChapterFeedback(data.chapter_id, e.target.value)}
                />
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded transition-colors"
                    onClick={() => setShowFeedback(false)}
                  >
                    Save Note
                  </button>
                  {hasFeedback && (
                    <button
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded transition-colors"
                      onClick={() => {
                        clearChapterFeedback(data.chapter_id);
                        setShowFeedback(false);
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attachment slot summary when collapsed */}
        {!expanded && data.attachment_points?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-amber-400 font-mono">
            <span>Side Quest Slots</span>
            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
              {data.attachment_points.length} Open
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3.5 h-3.5 bg-blue-500 border-2 border-slate-900 -right-2"
      />
    </div>
  );
});
