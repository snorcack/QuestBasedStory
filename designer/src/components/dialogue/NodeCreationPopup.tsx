import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { DialogueNode, Character } from '../../types';

// --- Types --------------------------------------------------------------------

export type PopupMode = 'write' | 'continue' | 'rewrite' | 'custom' | 'branch';

export interface PopupChoice {
  id: string;
  label: string;
  targetNodeId: string;
}

export interface NewNodePayload {
  node: DialogueNode;
  connectingChoiceLabel: string;
  connectingChoiceTrait: string | null;
  additionalChoices: Array<{
    label: string;
    target_node_id: string;
    trait_tag: string | null;
  }>;
}

export interface NodeCreationPopupProps {
  isOpen: boolean;
  position: { x: number; y: number };
  parentNodeId: string;
  parentNodeText: string;
  chapterId: string;
  chapterTitle: string;
  newNodeId: string;
  allNodes: DialogueNode[];
  characters: Character[];
  isExplicit?: boolean;
  onConfirm: (payload: NewNodePayload) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

// --- Helpers ------------------------------------------------------------------

const MODELS = ['Gemini 2.0 Flash', 'Gemini 2.5 Pro', 'Gemini 2.0 Pro'];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function clampPosition(x: number, y: number, width: number, height: number) {
  const margin = 12;
  const cx = Math.min(Math.max(x, margin), window.innerWidth - width - margin);
  const cy = Math.min(Math.max(y, margin), window.innerHeight - height - margin);
  return { x: cx, y: cy };
}

// --- Component ----------------------------------------------------------------

export const NodeCreationPopup: React.FC<NodeCreationPopupProps> = ({
  isOpen,
  position,
  parentNodeId,
  parentNodeText,
  chapterId: _chapterId,
  chapterTitle,
  newNodeId,
  allNodes,
  characters,
  isExplicit = false,
  onConfirm,
  onDelete,
  onCancel,
}) => {
  const [mode, setMode] = useState<PopupMode>('write');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [sceneLabel, setSceneLabel] = useState('');
  const [dialogueText, setDialogueText] = useState('');
  const [seedPrompt, setSeedPrompt] = useState('');
  const [speaker, setSpeaker] = useState(characters[0]?.name || 'Narrator');
  const [nodeType, setNodeType] = useState<DialogueNode['type']>('speaker');
  const [connectingLabel, setConnectingLabel] = useState('');
  const [connectingTrait, setConnectingTrait] = useState('');
  const [choices, setChoices] = useState<PopupChoice[]>([
    { id: uid(), label: '', targetNodeId: '' },
  ]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const w = 460, h = 640;
      setPos(clampPosition(position.x - w / 2, position.y - 20, w, h));
      setMode('write');
      setDialogueText('');
      setSeedPrompt('');
      setSceneLabel('');
      setConnectingLabel('');
      setConnectingTrait('');
      setChoices([{ id: uid(), label: '', targetNodeId: '' }]);
      setMoreOpen(false);
      setAiError(null);
      setSuggestError(null);
      setSpeaker(characters[0]?.name || 'Narrator');
    }
  }, [isOpen, position, characters]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  const handleAiExpand = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/dialogue/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: mode === 'write' ? 'continue' : mode,
          parent_text: parentNodeText,
          current_text: dialogueText,
          seed_prompt: seedPrompt,
          speaker,
          chapter_context: chapterTitle,
          is_explicit: isExplicit,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'LLM error'); }
      const data = await res.json();
      if (data.expanded_text) { setDialogueText(data.expanded_text); }
      else { throw new Error('Empty response from LLM'); }
    } catch (e: any) {
      setAiError(e.message || 'Failed to generate text');
    } finally { setAiLoading(false); }
  }, [mode, parentNodeText, dialogueText, seedPrompt, speaker, chapterTitle, isExplicit]);

  const handleSuggestChoices = useCallback(async () => {
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const existingLabels = choices.map((c) => c.label).filter(Boolean);
      const res = await fetch('/api/dialogue/suggest-choices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_text: dialogueText || parentNodeText,
          speaker,
          chapter_context: chapterTitle,
          existing_choices: existingLabels,
          is_explicit: isExplicit,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'LLM error'); }
      const data = await res.json();
      const suggested: PopupChoice[] = (data.choices || []).map((c: any) => ({
        id: uid(), label: c.label || '', targetNodeId: '',
      }));
      if (suggested.length > 0) {
        const filled = choices.filter((c) => c.label.trim());
        setChoices([...filled, ...suggested]);
      }
    } catch (e: any) {
      setSuggestError(e.message || 'Failed to suggest choices');
    } finally { setSuggestLoading(false); }
  }, [choices, dialogueText, parentNodeText, speaker, chapterTitle, isExplicit]);

  const addChoice = () => setChoices((prev) => [...prev, { id: uid(), label: '', targetNodeId: '' }]);
  const removeChoice = (id: string) => setChoices((prev) => prev.filter((c) => c.id !== id));
  const updateChoice = (id: string, patch: Partial<PopupChoice>) =>
    setChoices((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const handleConfirm = () => {
    if (!dialogueText.trim() && mode !== 'branch') return;
    const validChoices = choices.filter((c) => c.label.trim());
    const newNode: DialogueNode = {
      node_id: newNodeId,
      type: nodeType,
      speaker,
      text: dialogueText.trim(),
      choices: validChoices.map((c) => ({ label: c.label, trait_tag: null, next_node: c.targetNodeId || null })),
      next_node: null,
    };
    const additionalChoices = validChoices
      .filter((c) => c.targetNodeId && allNodes.some((n) => n.node_id === c.targetNodeId))
      .map((c) => ({ label: c.label, target_node_id: c.targetNodeId, trait_tag: null }));
    onConfirm({
      node: newNode,
      connectingChoiceLabel: connectingLabel.trim() || `Go to ${newNodeId}`,
      connectingChoiceTrait: connectingTrait.trim() || null,
      additionalChoices,
    });
  };

  if (!isOpen) return null;

  const speakerOptions = ['Narrator', 'Player', ...characters.map((c) => c.name).filter(Boolean)];
  const canConfirm = dialogueText.trim().length > 0 || mode === 'branch';

  const MODES: { key: PopupMode; label: string }[] = [
    { key: 'write', label: 'Write' },
    { key: 'continue', label: 'Continue' },
    { key: 'rewrite', label: 'Rewrite' },
    { key: 'custom', label: 'Custom...' },
    { key: 'branch', label: 'Branch' },
  ];
  const showAiButton = mode !== 'write';
  const aiButtonLabel = mode === 'rewrite' ? 'Rewrite with AI' : mode === 'custom' ? 'Generate Custom' : 'Continue with AI';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onCancel} />
      <div
        ref={popupRef}
        className="fixed z-50 w-[460px] bg-[#111317] border border-[#2a2d35] rounded-2xl shadow-2xl shadow-black/70 flex flex-col overflow-hidden"
        style={{ left: pos.x, top: pos.y, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="text-[15px] font-mono font-bold text-slate-100 tracking-wide">{newNodeId}</span>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode tabs + Model selector */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
            {MODES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-3 py-1 text-xs rounded-lg border font-medium transition-all ${
                  mode === key
                    ? 'bg-slate-700 border-slate-500 text-slate-100'
                    : 'border-slate-700/80 text-slate-400 hover:border-slate-600 hover:text-slate-200 bg-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-[11px] font-mono bg-[#1c1f26] border border-slate-700 text-slate-300 rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Scene Label */}
        <div className="px-5 pb-3">
          <input
            type="text"
            value={sceneLabel}
            onChange={(e) => setSceneLabel(e.target.value)}
            placeholder="Scene label (shown on map)"
            className="w-full bg-[#1c1f26] border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-slate-500 transition-colors font-sans"
          />
        </div>

        {/* Dialogue Textarea */}
        <div className="px-5 pb-2">
          <textarea
            rows={5}
            value={dialogueText}
            onChange={(e) => setDialogueText(e.target.value)}
            placeholder={mode === 'branch' ? 'Optional narration for this branch node...' : 'Write your story text here...'}
            className="w-full bg-[#1c1f26] border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-slate-500 transition-colors resize-none leading-relaxed font-sans"
          />
        </div>

        {/* Seed / Custom prompt */}
        {(mode === 'continue' || mode === 'custom') && (
          <div className="px-5 pb-2">
            <input
              type="text"
              value={seedPrompt}
              onChange={(e) => setSeedPrompt(e.target.value)}
              placeholder={mode === 'custom' ? 'Describe what you want the AI to write...' : 'Optional direction hint (e.g. suspicious tone)...'}
              className="w-full bg-[#1c1f26] border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-slate-500 transition-colors font-sans"
            />
          </div>
        )}

        {/* AI Error */}
        {aiError && (
          <div className="mx-5 mb-2 flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{aiError}
          </div>
        )}

        {/* AI Generate button */}
        {showAiButton && (
          <div className="px-5 pb-3">
            <button
              onClick={handleAiExpand}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/25 hover:border-indigo-400/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? 'Generating...' : aiButtonLabel}
            </button>
          </div>
        )}

        {/* CHOICES section */}
        <div className="px-5 pb-3 border-t border-slate-800/60 pt-3">
          <div className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest mb-2.5">Choices</div>
          <div className="space-y-2">
            {choices.map((choice) => {
              const isLinked = choice.targetNodeId.trim() !== '' && allNodes.some((n) => n.node_id === choice.targetNodeId.trim());
              const isInvalid = choice.targetNodeId.trim() !== '' && !isLinked;
              return (
                <div key={choice.id} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLinked ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)]' : 'bg-slate-600'}`} />
                  <input
                    type="text"
                    value={choice.label}
                    onChange={(e) => updateChoice(choice.id, { label: e.target.value })}
                    placeholder="Choice text"
                    className="flex-1 bg-[#1c1f26] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-slate-500 transition-colors font-sans"
                  />
                  <input
                    type="text"
                    value={choice.targetNodeId}
                    onChange={(e) => updateChoice(choice.id, { targetNodeId: e.target.value })}
                    placeholder="node_id"
                    list={`nl-${choice.id}`}
                    className={`w-32 bg-[#1c1f26] border rounded-lg px-2.5 py-1.5 text-[11px] font-mono outline-none transition-colors ${isInvalid ? 'border-rose-500/50 text-rose-400' : isLinked ? 'border-emerald-500/40 text-emerald-300' : 'border-slate-700/50 text-slate-400'}`}
                  />
                  <datalist id={`nl-${choice.id}`}>
                    {allNodes.map((n) => <option key={n.node_id} value={n.node_id}>{n.node_id} ({n.speaker})</option>)}
                  </datalist>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isLinked ? 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 'bg-slate-700'}`} />
                  <button onClick={() => removeChoice(choice.id)} className="p-1 rounded bg-rose-600/70 hover:bg-rose-500 text-white transition-colors shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {suggestError && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-400">
              <AlertCircle className="w-3 h-3" />{suggestError}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={addChoice}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-700/80 rounded-lg text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Choice
            </button>
            <button
              onClick={handleSuggestChoices}
              disabled={suggestLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-700/80 rounded-lg text-slate-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {suggestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Suggest Choices
            </button>
          </div>
        </div>

        {/* More options */}
        <div className="px-5 py-2 border-t border-slate-800/60">
          <button onClick={() => setMoreOpen((v) => !v)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            {moreOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            More options
          </button>
          {moreOpen && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">Speaker</label>
                  <input
                    type="text"
                    list="popup-speaker-list"
                    value={speaker}
                    onChange={(e) => setSpeaker(e.target.value)}
                    className="w-full bg-[#1c1f26] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-slate-500 transition-colors font-sans"
                  />
                  <datalist id="popup-speaker-list">
                    {speakerOptions.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">Node Type</label>
                  <select
                    value={nodeType}
                    onChange={(e) => setNodeType(e.target.value as DialogueNode['type'])}
                    className="w-full bg-[#1c1f26] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-mono"
                  >
                    <option value="speaker">Speaker</option>
                    <option value="choice">Choice Branch</option>
                    <option value="flag">Flag Check</option>
                    <option value="end">End Scene</option>
                  </select>
                </div>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80 space-y-2">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  ? Connecting choice from {parentNodeId}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-mono text-slate-600 block mb-0.5">Choice Label</label>
                    <input
                      type="text"
                      value={connectingLabel}
                      onChange={(e) => setConnectingLabel(e.target.value)}
                      placeholder={`Go to ${newNodeId}`}
                      className="w-full bg-[#141619] border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-amber-500/50 transition-colors font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-slate-600 block mb-0.5">Trait Tag</label>
                    <input
                      type="text"
                      value={connectingTrait}
                      onChange={(e) => setConnectingTrait(e.target.value.toUpperCase())}
                      placeholder="e.g. CUNNING"
                      className="w-full bg-[#141619] border border-slate-700/50 rounded px-2 py-1 text-xs text-amber-300 font-mono outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800/60 flex items-center justify-between">
          {onDelete ? (
            <button onClick={onDelete} className="px-4 py-2 text-xs font-semibold text-rose-400 border border-rose-500/40 rounded-lg hover:bg-rose-500/10 transition-colors">
              Delete
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-4 py-2 text-xs text-slate-500 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800/50">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-all shadow-md shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
