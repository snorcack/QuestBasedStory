import React, { useState } from 'react';
import { useStoryStore } from '../../store/useStoryStore';
import { Scene } from '../../types';
import {
  BookOpen,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  RotateCcw,
  Zap,
  Eye,
  Flame,
  Scissors,
  MapPin,
  Users,
} from 'lucide-react';

interface SceneProseEditorProps {
  chapterId: string;
  chapterTitle?: string;
  chapterContext?: string;
}

type PolishMode = 'punch_up' | 'more_sensory' | 'heighten_tension' | 'condense' | 'custom';

export const SceneProseEditor: React.FC<SceneProseEditorProps> = ({
  chapterId,
  chapterTitle,
  chapterContext,
}) => {
  const {
    chapters,
    updateScene,
    addScene,
    removeScene,
    characters,
    worldBible,
    isExplicit,
  } = useStoryStore();

  const activeChapter = chapters.find((c) => c.chapter_id === chapterId);
  const scenes = activeChapter?.scenes || [];

  // Expanded scene card ID (default to first scene if available)
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(
    scenes[0]?.scene_id || null
  );

  // AI Polish state per scene
  const [polishingSceneId, setPolishingSceneId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<PolishMode>('punch_up');
  const [customInstruction, setCustomInstruction] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [proposedPolish, setProposedPolish] = useState<{
    sceneId: string;
    prose: string;
    beat: string;
  } | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);

  const handlePolish = async (scene: Scene, mode: PolishMode) => {
    setPolishingSceneId(scene.scene_id);
    setActiveMode(mode);
    setPolishError(null);

    try {
      const res = await fetch('/api/prose/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          scene_title: scene.title,
          current_prose: scene.prose,
          emotional_beat: scene.emotional_beat || '',
          characters_present: scene.characters_present || [],
          custom_instruction: mode === 'custom' ? customInstruction : '',
          chapter_context: chapterContext || chapterTitle || chapterId,
          is_explicit: isExplicit,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to polish prose' }));
        throw new Error(err.detail || 'Prose polish request failed');
      }

      const data = await res.json();
      setProposedPolish({
        sceneId: scene.scene_id,
        prose: data.polished_prose,
        beat: data.emotional_beat || scene.emotional_beat || '',
      });
    } catch (err: any) {
      setPolishError(err.message || 'Error communicating with AI polish server');
    } finally {
      setPolishingSceneId(null);
    }
  };

  const acceptProposedPolish = () => {
    if (!proposedPolish) return;
    updateScene(chapterId, proposedPolish.sceneId, {
      prose: proposedPolish.prose,
      emotional_beat: proposedPolish.beat || undefined,
    });
    setProposedPolish(null);
  };

  const cancelProposedPolish = () => {
    setProposedPolish(null);
  };

  const handleAddScene = () => {
    addScene(chapterId);
    // Auto expand the new scene
    setTimeout(() => {
      const latest = useStoryStore.getState().chapters.find((c) => c.chapter_id === chapterId);
      const newScenes = latest?.scenes || [];
      if (newScenes.length > 0) {
        setExpandedSceneId(newScenes[newScenes.length - 1].scene_id);
      }
    }, 50);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800/80 pb-2 mb-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-slate-300">SCENE PROSE BEATS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
            {scenes.length} {scenes.length === 1 ? 'Scene' : 'Scenes'}
          </span>
          <button
            onClick={handleAddScene}
            className="flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 px-2 py-0.5 rounded font-sans transition-colors"
            title="Add a new scene beat to this chapter"
          >
            <Plus className="w-3 h-3" /> Add Beat
          </button>
        </div>
      </div>

      {/* Scenes list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {scenes.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="font-medium text-slate-400">No authored scenes in this chapter yet.</p>
            <p className="text-[11px] text-slate-600 mt-1 mb-3">
              Add dramatic scene beats with narrative prose or generate them via Stage 3 & 4.
            </p>
            <button
              onClick={handleAddScene}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" /> Create First Scene
            </button>
          </div>
        ) : (
          scenes.map((scene, idx) => {
            const isExpanded = expandedSceneId === scene.scene_id;
            const isPolishing = polishingSceneId === scene.scene_id;
            const hasProposed = proposedPolish?.sceneId === scene.scene_id;
            const wordCount = scene.prose
              ? scene.prose.trim().split(/\s+/).filter(Boolean).length
              : 0;

            return (
              <div
                key={scene.scene_id || idx}
                className={`bg-slate-950/80 rounded-xl border transition-all ${
                  isExpanded
                    ? 'border-indigo-500/50 ring-1 ring-indigo-500/20 shadow-lg'
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Scene Header (Click to toggle) */}
                <div
                  onClick={() => setExpandedSceneId(isExpanded ? null : scene.scene_id)}
                  className="p-3 flex items-center justify-between cursor-pointer select-none group"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-500/20 shrink-0">
                        Beat {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-200 text-xs truncate group-hover:text-white transition-colors">
                        {scene.title || 'Untitled Beat'}
                      </span>
                    </div>

                    {!isExpanded && (
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-slate-400 line-clamp-1 italic font-sans flex-1">
                          {scene.prose || 'No prose written yet...'}
                        </p>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {wordCount}w
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-slate-500 group-hover:text-slate-300">
                    {scene.emotional_beat && !isExpanded && (
                      <span className="text-[9px] font-mono text-amber-300/80 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {scene.emotional_beat}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Expanded Editing Body */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-900 space-y-3">
                    {/* Title & Emotional Beat inputs */}
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1">
                          Scene Title
                        </label>
                        <input
                          type="text"
                          value={scene.title}
                          onChange={(e) =>
                            updateScene(chapterId, scene.scene_id, { title: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                          placeholder="e.g. Confrontation at the docks"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-mono text-slate-400 block mb-1 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-400" /> Emotional Beat
                          </label>
                          <input
                            type="text"
                            value={scene.emotional_beat || ''}
                            onChange={(e) =>
                              updateScene(chapterId, scene.scene_id, {
                                emotional_beat: e.target.value,
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-200 outline-none font-mono"
                            placeholder="e.g. Paranoia & Dread"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-slate-400 block mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-400" /> Location
                          </label>
                          <select
                            value={scene.location_id || ''}
                            onChange={(e) =>
                              updateScene(chapterId, scene.scene_id, {
                                location_id: e.target.value,
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-400 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none font-mono"
                          >
                            <option value="">(Select location)</option>
                            {worldBible?.locations?.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Characters Present Selector */}
                    {characters.length > 0 && (
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-400" /> Characters in Scene
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {characters.map((char) => {
                            const isPresent = scene.characters_present?.includes(char.id);
                            return (
                              <button
                                key={char.id}
                                type="button"
                                onClick={() => {
                                  const current = scene.characters_present || [];
                                  const updated = isPresent
                                    ? current.filter((id) => id !== char.id)
                                    : [...current, char.id];
                                  updateScene(chapterId, scene.scene_id, {
                                    characters_present: updated,
                                  });
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                  isPresent
                                    ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                {char.name || char.id}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Prose Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                          Narrative Prose
                        </label>
                        <span className="text-[10px] font-mono text-slate-500">{wordCount} words</span>
                      </div>
                      <textarea
                        rows={6}
                        value={scene.prose}
                        onChange={(e) =>
                          updateScene(chapterId, scene.scene_id, { prose: e.target.value })
                        }
                        placeholder="Write vivid, sensory prose describing the environment, actions, and character internalities..."
                        className="w-full bg-slate-900/90 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 text-xs text-slate-200 outline-none resize-y leading-relaxed font-sans"
                      />
                    </div>

                    {/* Proposed AI Polish Diff / Confirmation */}
                    {hasProposed && (
                      <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold text-indigo-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Proposed AI Revision
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={acceptProposedPolish}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all"
                            >
                              <Check className="w-3 h-3" /> Accept
                            </button>
                            <button
                              onClick={cancelProposedPolish}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
                            >
                              <RotateCcw className="w-3 h-3" /> Revert
                            </button>
                          </div>
                        </div>

                        {proposedPolish.beat && (
                          <div className="text-[10px] font-mono text-amber-300">
                            Tone Beat: {proposedPolish.beat}
                          </div>
                        )}

                        <p className="text-xs text-slate-100 font-sans leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-indigo-500/20 max-h-48 overflow-y-auto">
                          {proposedPolish.prose}
                        </p>
                      </div>
                    )}

                    {/* AI Polish Toolbar */}
                    <div className="pt-2 border-t border-slate-900">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-indigo-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> AI Director Polish
                        </span>
                        {isPolishing && (
                          <span className="text-[10px] font-mono text-indigo-300 flex items-center gap-1 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" /> Rewriting...
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          disabled={isPolishing}
                          onClick={() => handlePolish(scene, 'punch_up')}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold bg-slate-900 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 rounded-lg transition-all disabled:opacity-50"
                        >
                          <Zap className="w-3 h-3 text-amber-400" /> Punch Up Prose
                        </button>

                        <button
                          disabled={isPolishing}
                          onClick={() => handlePolish(scene, 'more_sensory')}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold bg-slate-900 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 rounded-lg transition-all disabled:opacity-50"
                        >
                          <Eye className="w-3 h-3 text-cyan-400" /> More Sensory
                        </button>

                        <button
                          disabled={isPolishing}
                          onClick={() => handlePolish(scene, 'heighten_tension')}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold bg-slate-900 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 rounded-lg transition-all disabled:opacity-50"
                        >
                          <Flame className="w-3 h-3 text-rose-400" /> Heighten Stakes
                        </button>

                        <button
                          disabled={isPolishing}
                          onClick={() => handlePolish(scene, 'condense')}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold bg-slate-900 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 rounded-lg transition-all disabled:opacity-50"
                        >
                          <Scissors className="w-3 h-3 text-emerald-400" /> Condense
                        </button>
                      </div>

                      {/* Custom instruction toggle */}
                      <div className="mt-1.5">
                        {!showCustomInput ? (
                          <button
                            type="button"
                            onClick={() => setShowCustomInput(true)}
                            className="text-[10px] text-slate-500 hover:text-indigo-400 underline font-mono"
                          >
                            + Custom AI Direction...
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              value={customInstruction}
                              onChange={(e) => setCustomInstruction(e.target.value)}
                              placeholder="e.g. Make it darker, emphasize betrayal..."
                              className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none"
                            />
                            <button
                              disabled={isPolishing || !customInstruction.trim()}
                              onClick={() => handlePolish(scene, 'custom')}
                              className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-40 transition-colors"
                            >
                              Go
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCustomInput(false)}
                              className="text-[10px] text-slate-500 hover:text-slate-300"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {polishError && (
                        <div className="mt-1.5 text-[10px] font-mono text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-500/20">
                          {polishError}
                        </div>
                      )}
                    </div>

                    {/* Delete Beat Footer */}
                    <div className="pt-2 border-t border-slate-900 flex justify-end">
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete scene "${scene.title}"?`)) {
                            removeScene(chapterId, scene.scene_id);
                          }
                        }}
                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete Beat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
