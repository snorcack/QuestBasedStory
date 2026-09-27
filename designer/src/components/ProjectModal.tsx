import React, { useState } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import {
  FolderKanban,
  PlusCircle,
  X,
  Search,
  BookOpen,
  Calendar,
  Layers,
  Compass,
  CheckCircle2,
  Clock,
  Trash2,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  Flame,
} from 'lucide-react';
import { ProjectSummary } from '../types';

export const ProjectModal: React.FC = () => {
  const {
    isProjectModalOpen,
    projectModalTab,
    openProjectModal,
    closeProjectModal,
    projects,
    currentProjectId,
    selectProject,
    createProject,
    deleteProject,
    isGenerating,
    lastError,
  } = useStoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSeed, setNewSeed] = useState('');
  const [newGenre, setNewGenre] = useState('Cyber-Noir Mystery');
  const [newTone, setNewTone] = useState('Gritty, suspenseful, melancholic');
  const [isExplicit, setIsExplicit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isProjectModalOpen) return null;

  const presets = [
    {
      title: 'Echoes in the Static',
      genre: 'Cyber-Noir Mystery',
      tone: 'Melancholic, tense, cerebral',
      seed: 'A neural data detective discovers encrypted suicide memories from the city’s chief magistrate.',
    },
    {
      title: 'The Iron Sovereign',
      genre: 'Dark Fantasy',
      tone: 'Grim, tactical, atmospheric',
      seed: 'An oath-bound warden must escort an immortal apostate through a kingdom devoured by crystalline blight.',
    },
    {
      title: 'Sunken Spire of Ash',
      genre: 'Eldritch Steampunk',
      tone: 'Unsettling, inquisitive, eerie',
      seed: 'Deep-sea divers exploring an undersea clockwork observatory breach a chamber housing an alien heart.',
    },
    {
      title: 'The Solarpunk Cartographer',
      genre: 'Sci-Fi Exploration',
      tone: 'Hopeful, mysterious, poetic',
      seed: 'A wanderer maps sentient bioluminescent forests while uncovering relics of the Old World Collapse.',
      is_explicit: false,
    },
    {
      title: 'Neon Sin & Chrome',
      genre: 'Cyber-Thriller (Explicit 18+)',
      tone: 'Seductive, gritty, visceral, uninhibited',
      seed: 'An undercover infiltrator penetrates an illicit underground syndicate club, navigating lethal betrayal, erotic intrigue, and brutal gang warfare.',
      is_explicit: true,
    },
  ];

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.genre.toLowerCase().includes(q) ||
      p.story_seed.toLowerCase().includes(q)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeed.trim()) return;
    await createProject({
      title: newTitle.trim() || 'Untitled Story',
      story_seed: newSeed.trim(),
      genre: newGenre,
      tone: newTone,
      is_explicit: isExplicit,
    });
  };

  const applyPreset = (preset: (typeof presets)[0]) => {
    setNewTitle(preset.title);
    setNewGenre(preset.genre);
    setNewTone(preset.tone);
    setNewSeed(preset.seed);
    if ('is_explicit' in preset && preset.is_explicit !== undefined) {
      setIsExplicit(!!preset.is_explicit);
    }
  };

  const getStageBadge = (stage: string, status: string) => {
    if (status === 'completed' || stage === 'export_complete') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Completed
        </span>
      );
    }
    if (status === 'awaiting_review') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
          <Clock className="w-2.5 h-2.5" />
          Awaiting Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <Sparkles className="w-2.5 h-2.5" />
        {stage.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b1120] border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="border-b border-slate-800 bg-[#080d19] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-wide">
                Story Workspace & Projects
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Start a new adventure or review and resume previous projects
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Navigation */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => openProjectModal('library')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  projectModalTab === 'library'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Project Library</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-slate-800 rounded-full font-mono">
                  {projects.length}
                </span>
              </button>
              <button
                onClick={() => openProjectModal('new')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  projectModalTab === 'new'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Story</span>
              </button>
            </div>

            <button
              onClick={closeProjectModal}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#060911]">
          {lastError && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{lastError}</span>
            </div>
          )}

          {projectModalTab === 'library' ? (
            <div className="space-y-4">
              {/* Search bar & quick stats */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs flex-1 max-w-md focus-within:border-blue-500/60 transition-all">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, genre, or premise..."
                    className="bg-transparent text-slate-200 outline-none w-full placeholder:text-slate-600 text-xs"
                  />
                </div>
                <button
                  onClick={() => openProjectModal('new')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Start New Story</span>
                </button>
              </div>

              {/* Projects Grid */}
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                  <FolderKanban className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No projects found</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Try another search term or start your first story project!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProjects.map((p: ProjectSummary) => {
                    const isActive = p.id === currentProjectId;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                          isActive
                            ? 'bg-slate-900/90 border-blue-500/60 shadow-lg shadow-blue-500/10'
                            : 'bg-[#080e1b] border-slate-800/80 hover:border-slate-700 hover:bg-[#0c1425]'
                        }`}
                      >
                        <div>
                          {/* Card Top Row */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-100 line-clamp-1">
                                  {p.title}
                                </h3>
                                {isActive && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    ACTIVE
                                  </span>
                                )}
                                {p.is_explicit && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 font-semibold">
                                    <Flame className="w-2.5 h-2.5 text-rose-400 fill-current" />
                                    18+ EXPLICIT
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-indigo-400 block mt-0.5">
                                {p.genre}
                              </span>
                            </div>
                            {getStageBadge(p.current_stage, p.status)}
                          </div>

                          {/* Seed Snippet */}
                          <p className="text-xs text-slate-400 line-clamp-2 italic mb-3">
                            "{p.story_seed}"
                          </p>

                          {/* Stats Row */}
                          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 border-t border-slate-800/60 pt-2.5 mb-4">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3 text-blue-400" />
                              {p.chapter_count} Chapters
                            </span>
                            <span className="flex items-center gap-1">
                              <Compass className="w-3 h-3 text-amber-400" />
                              {p.quest_count} Quests
                            </span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar className="w-3 h-3" />
                              {new Date(p.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => selectProject(p.id)}
                              disabled={isGenerating}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                isActive
                                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                              }`}
                            >
                              <span>{isActive ? 'Continue Current' : 'Open Story'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Delete button (with confirmation state) */}
                          {p.id !== 'proj_neon_grave' && (
                            <button
                              onClick={() => {
                                if (deletingId === p.id) {
                                  deleteProject(p.id);
                                  setDeletingId(null);
                                } else {
                                  setDeletingId(p.id);
                                  setTimeout(() => setDeletingId(null), 3000);
                                }
                              }}
                              className={`p-1.5 rounded-lg text-xs transition-all ${
                                deletingId === p.id
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2'
                                  : 'text-slate-600 hover:text-rose-400 hover:bg-rose-500/10'
                              }`}
                              title="Delete project"
                            >
                              {deletingId === p.id ? (
                                <span className="text-[10px] font-mono">Confirm Delete?</span>
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Create New Story Form */
            <form onSubmit={handleCreate} className="space-y-5 max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <h3 className="text-base font-bold text-slate-100">Design a New Story</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Specify your premise or click an inspiration preset below to launch the autonomous authoring engine.
                </p>
              </div>

              {/* Inspiration Presets */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Quick Premise Presets
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="text-left p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-300">
                          {preset.title}
                        </span>
                        <span className="text-[9px] font-mono text-indigo-400">
                          {preset.genre}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {preset.seed}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Genre Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Story Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. The Glass Cipher"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition-all shadow-inner"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Genre</label>
                  <input
                    type="text"
                    required
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    placeholder="e.g. Cyber-Noir Mystery, Dark Fantasy"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Tone Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Atmospheric Tone</label>
                <input
                  type="text"
                  value={newTone}
                  onChange={(e) => setNewTone(e.target.value)}
                  placeholder="e.g. Gritty, melancholic, tense, cerebral"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition-all shadow-inner"
                />
              </div>

              {/* Story Seed Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Story Premise & Core Conflict
                </label>
                <textarea
                  rows={4}
                  required
                  value={newSeed}
                  onChange={(e) => setNewSeed(e.target.value)}
                  placeholder="Describe the protagonist, initial catalyst, and central mystery or conflict..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition-all resize-none shadow-inner"
                />
              </div>

              {/* Explicit / Adult Mode Toggle */}
              <div
                onClick={() => setIsExplicit(!isExplicit)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isExplicit
                    ? 'border-rose-500/50 bg-rose-950/20 shadow-lg shadow-rose-950/30'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                        isExplicit ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Flame className={`w-4 h-4 ${isExplicit ? 'fill-rose-500/40' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">Explicit / Adult Story Mode</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            isExplicit
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          18+ Uncensored
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Author adult themes, sensuality, explicit romance/nudity, visceral violence, and uncensored coarse dialogue without content filters.
                      </p>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <div
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      isExplicit ? 'bg-rose-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isExplicit ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Submission Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => openProjectModal('library')}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !newSeed.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Project & Initializing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current" />
                      <span>Create & Launch Story Engine</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
