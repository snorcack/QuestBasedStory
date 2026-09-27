import React, { useEffect } from 'react';
import { useStoryStore } from './store/useStoryStore';
import { Header } from './components/Header';
import { PipelineStepper } from './components/PipelineStepper';
import { CheckpointBanner } from './components/CheckpointBanner';
import { StageReviewPanel } from './components/StageReviewPanel';
import { ProjectModal } from './components/ProjectModal';
import { SearchModal } from './components/SearchModal';
import { StoryOverview } from './views/StoryOverview';
import { QuestGraph } from './views/QuestGraph';
import { DialogueEditor } from './views/DialogueEditor';
import { TraitArc } from './views/TraitArc';
import { ExportView } from './views/ExportView';
import { DebugView } from './views/DebugView';
import { CastWorldTab } from './views/CastWorldTab';
import { PlayNovel } from './views/PlayNovel';

export const App: React.FC = () => {
  const { activeView, fetchProjects, loadSampleData, setSearchOpen } = useStoryStore();

  useEffect(() => {
    // Attempt initial project fetch from backend, fallback to sample preview data
    fetchProjects().then(() => {
      if (useStoryStore.getState().chapterContracts.length === 0) {
        loadSampleData();
      }
    });

    // Global shortcut Ctrl+K / Cmd+K to toggle Search
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(!useStoryStore.getState().isSearchOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#060911] text-slate-100 overflow-hidden font-sans">
      {/* 1. Global Navigation Bar */}
      <Header />

      {/* 2. Pipeline Stages Stepper Ribbon */}
      {activeView !== 'play' && <PipelineStepper />}

      {/* 3. Stage Review Summary (dismissable, shown after each stage) */}
      {activeView !== 'play' && <StageReviewPanel />}

      {/* 4. Active Checkpoint Action Control Bar */}
      {activeView !== 'play' && <CheckpointBanner />}

      {/* 5. Canvas View Area */}
      <main className="flex-1 relative overflow-hidden bg-[#060911]">
        {activeView === 'overview' && <StoryOverview />}
        {activeView === 'dialogue' && <DialogueEditor />}
        {activeView === 'quests' && <QuestGraph />}
        {activeView === 'traits' && <TraitArc />}
        {activeView === 'cast-world' && <CastWorldTab />}
        {activeView === 'export' && <ExportView />}
        {activeView === 'debug' && <DebugView />}
        {activeView === 'play' && <PlayNovel />}
      </main>

      {/* 6. Multi-Story Project Workspace Modal */}
      <ProjectModal />

      {/* 7. Global Narrative Search & Command Palette (Ctrl+K) */}
      <SearchModal />
    </div>
  );
};





