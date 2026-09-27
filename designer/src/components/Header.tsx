import React from 'react';
import { useStoryStore, ViewType } from '../store/useStoryStore';
import {
  Layers,
  Compass,
  MessageSquare,
  Sparkles,
  Download,
  Play,
  Loader2,
  RefreshCw,
  Terminal,
  FolderKanban,
  Plus,
  ChevronDown,
  Users,
  BookOpen,
  Search,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    activeView,
    setActiveView,
    storySeed,
    setStorySeed,
    startPipeline,
    isGenerating,
    fetchState,
    apiConnected,
    checkApiHealth,
    currentProjectTitle,
    currentProjectGenre,
    openProjectModal,
    isExplicit,
    chapters,
    openSearch,
  } = useStoryStore();

  React.useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems: { id: ViewType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Story Spine', icon: Layers },
    { id: 'cast-world', label: 'Cast & World', icon: Users },
    { id: 'dialogue', label: 'Dialogue & Prose', icon: MessageSquare },
    { id: 'quests', label: 'Quest Graph', icon: Compass },
    { id: 'traits', label: 'Trait Arc', icon: Sparkles },
    { id: 'export', label: 'Game Package', icon: Download },
    { id: 'debug', label: 'Debug & API', icon: Terminal },
  ];

  return (
    <header className="h-16 border-b border-slate-800 bg-[#080d19] px-6 flex items-center justify-between shrink-0 z-30 shadow-md">
      {/* Brand & Project Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-indigo-600 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 text-base">
            Q
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm text-slate-100 tracking-wider">
                QUESTFORGE
              </h1>
              <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30">
                TOOL
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 block">
              Multi-Story Engine
            </span>
          </div>
        </div>

        {/* Project Selector Button */}
        <button
          onClick={() => openProjectModal('library')}
          title="Open Story Workspace & Library"
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:bg-slate-900 hover:border-slate-700 transition-all text-left group"
        >
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:text-indigo-300">
            <FolderKanban className="w-3.5 h-3.5" />
          </div>
          <div className="max-w-[140px] xl:max-w-[200px]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200 block truncate group-hover:text-white">
                {currentProjectTitle || 'Select Story'}
              </span>
              {isExplicit && (
                <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                  18+
                </span>
              )}
            </div>
            <span className="text-[9px] font-mono text-indigo-400 block truncate">
              {currentProjectGenre || 'Story Project'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
        </button>

        {/* New Story Quick Button */}
        <button
          onClick={() => openProjectModal('new')}
          title="Create a New Story Project"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-blue-600/20 hover:border-blue-500/40 text-slate-300 hover:text-blue-300 text-xs font-medium transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Story</span>
        </button>

        {/* Global Search / Command Palette Button (Ctrl+K) */}
        <button
          onClick={openSearch}
          title="Search story content (Ctrl+K)"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all text-xs"
        >
          <Search className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline text-slate-400 font-sans">Search...</span>
          <kbd className="hidden xl:inline text-[9px] font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">
            ⌘K
          </kbd>
        </button>

        {/* Story Premise / Seed Preview */}
        <div className="hidden 2xl:flex items-center bg-slate-950 rounded-xl px-3 py-1.5 border border-slate-800 focus-within:border-blue-500/70 transition-all w-80 shadow-inner">
          <input
            type="text"
            value={storySeed}
            onChange={(e) => setStorySeed(e.target.value)}
            placeholder="Story premise..."
            className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Navigation View Switcher Tabs */}
      <nav className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 shadow-inner">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Action Controls */}
      <div className="flex items-center gap-3">
        {/* API Up/Down Status Pill */}
        <button
          onClick={() => setActiveView('debug')}
          title={apiConnected ? 'API Server Online — Click for Debug & Playground' : 'API Server Offline — Click for Diagnostics'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono transition-all ${
            apiConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-semibold">{apiConnected ? 'API UP' : 'API DOWN'}</span>
        </button>

        <button
          onClick={() => fetchState()}
          title="Refresh State from API"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={startPipeline}
          disabled={isGenerating}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Pipeline</span>
            </>
          )}
        </button>

        {/* Play Novel button */}
        <button
          onClick={() => setActiveView('play')}
          disabled={chapters.length === 0}
          title={chapters.length === 0 ? 'Complete Stage 4 to unlock Play mode' : 'Play Novel'}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
            activeView === 'play'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : chapters.length === 0
                ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Play Novel</span>
        </button>
      </div>
    </header>
  );
};
