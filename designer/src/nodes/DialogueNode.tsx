import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  GitBranch,
  CheckCircle2,
  Trash2,
  Edit3,
  Flag,
  User,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { DialogueNode as DialogueNodeType } from '../types';
import { useStoryStore } from '../store/useStoryStore';

export interface DialogueNodeProps {
  id: string;
  data: DialogueNodeType & {
    chapterId?: string;
    onEdit?: (nodeId: string) => void;
    onPlusHandleDragStart?: (nodeId: string, event: React.MouseEvent) => void;
  };
  selected?: boolean;
}

export const DialogueNodeComponent = memo(({ id, data, selected }: DialogueNodeProps) => {
  const selectedChapterId = useStoryStore((s) => s.selectedChapterId);
  const removeDialogueNode = useStoryStore((s) => s.removeDialogueNode);

  const chapterId = data.chapterId || selectedChapterId || '';
  const isEnd = data.type === 'end';
  const isChoice = data.type === 'choice' || (data.choices && data.choices.length > 0);
  const isFlag = data.type === 'flag';

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(`Delete dialogue node "${data.node_id}"?`)) {
        removeDialogueNode(chapterId, data.node_id);
      }
    },
    [chapterId, data.node_id, removeDialogueNode]
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.onEdit) {
        data.onEdit(data.node_id);
      }
    },
    [data]
  );

  // Border & Glow styling depending on node type and selection
  const borderClass = selected
    ? 'border-indigo-400 ring-2 ring-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.35)]'
    : isEnd
    ? 'border-emerald-500/40 hover:border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.12)]'
    : isChoice
    ? 'border-indigo-500/40 hover:border-indigo-400/80 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
    : isFlag
    ? 'border-amber-500/40 hover:border-amber-400/80'
    : 'border-slate-700/80 hover:border-blue-500/60 shadow-lg';

  const bgClass = isEnd
    ? 'bg-emerald-950/25'
    : isChoice
    ? 'bg-indigo-950/25'
    : isFlag
    ? 'bg-amber-950/20'
    : 'bg-slate-900/80';

  return (
    <div
      data-nodeid={data.node_id}
      className={`glass-panel rounded-xl p-3.5 w-76 text-slate-100 border transition-all relative ${borderClass} ${bgClass}`}
    >
      {/* Incoming Connection Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-indigo-400 border-2 border-slate-900 -top-1.5"
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
            {isEnd ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : isChoice ? (
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            ) : isFlag ? (
              <Flag className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <User className="w-3.5 h-3.5 text-blue-400" />
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200 capitalize leading-tight">
              {data.speaker || 'Narrator'}
            </div>
            <div className="text-[9px] font-mono text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 tracking-wider select-all inline-block mt-0.5 cursor-text">
              #{data.node_id}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 nodrag">
          <button
            onClick={handleEdit}
            title="Edit Dialogue Node"
            className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800/80 rounded transition-colors"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={handleDelete}
            title="Delete Dialogue Node"
            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Dialogue Content */}
      <p className="text-xs text-slate-200 mb-2.5 leading-relaxed font-sans line-clamp-4">
        {data.text || <span className="italic text-slate-500">No dialogue script set</span>}
      </p>

      {/* Choices preview */}
      {data.choices && data.choices.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Branch Choices ({data.choices.length})</span>
          </div>
          {data.choices.map((choice, i) => {
            const isCunning = choice.trait_tag?.toLowerCase().includes('cunning');
            const isEmpathy = choice.trait_tag?.toLowerCase().includes('empathy');
            const isResolute = choice.trait_tag?.toLowerCase().includes('resolute');

            const traitBadge = isCunning
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : isEmpathy
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              : isResolute
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : choice.trait_tag
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              : null;

            return (
              <div
                key={i}
                className="text-[11px] bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div className="text-slate-200 mb-1 leading-snug">{choice.label}</div>
                <div className="flex items-center justify-between font-mono text-[9px] text-slate-400 pt-0.5">
                  {traitBadge && (
                    <span className={`px-1.5 py-0.5 rounded border ${traitBadge}`}>
                      +{choice.trait_tag}
                    </span>
                  )}
                  {choice.next_node && (
                    <span className="flex items-center gap-1 text-slate-400 font-mono">
                      <ArrowRight className="w-2.5 h-2.5 text-indigo-400" />
                      {choice.next_node}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Linear next node footer */}
      {data.next_node && !isEnd && (
        <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Direct Transition</span>
          <span className="text-indigo-400 flex items-center gap-1">
            ➔ {data.next_node}
          </span>
        </div>
      )}

      {isEnd && (
        <div className="mt-2 pt-1.5 border-t border-emerald-900/40 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Scene / Chapter Climax
        </div>
      )}

      {/* Outgoing Linear Connection Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-indigo-400 border-2 border-slate-900 -bottom-1.5"
      />

      {/* Outgoing Branching Connection Handle (Right) */}
      {isChoice && (
        <Handle
          type="source"
          id="choice-branch"
          position={Position.Right}
          className="w-3 h-3 bg-amber-400 border-2 border-slate-900 -right-1.5"
        />
      )}

      {/* Plus drag-to-create handle */}
      <div
        className="nodrag absolute -bottom-7 left-1/2 -translate-x-1/2
                   w-5 h-5 rounded-full bg-indigo-600 border-2 border-slate-900
                   flex items-center justify-center cursor-grab
                   shadow-lg shadow-indigo-500/50
                   animate-pulse hover:animate-none hover:scale-125
                   transition-transform z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          data.onPlusHandleDragStart?.(data.node_id, e);
        }}
        title="Drag to create a connected node"
      >
        <Plus className="w-3 h-3 text-white" />
      </div>
    </div>
  );
});
