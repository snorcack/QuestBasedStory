import React, { useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import { usePlayStore } from '../store/usePlayStore';

// Phase components
import { TitleScreen } from '../components/play/TitleScreen';
import { ChapterJumpMenu } from '../components/play/ChapterJumpMenu';
import { ChapterIntro } from '../components/play/ChapterIntro';
import { TransitionCard } from '../components/play/TransitionCard';
import { SceneReader } from '../components/play/SceneReader';
import { DialoguePlayer } from '../components/play/DialoguePlayer';

// Sidebar & chrome
import { QuestTracker } from '../components/play/QuestTracker';
import { TraitMeter } from '../components/play/TraitMeter';
import { PlayControls } from '../components/play/PlayControls';
import { JournalDrawer } from '../components/play/JournalDrawer';

export const PlayNovel: React.FC = () => {
  const {
    chapters,
    chapterContracts,
    transitions,
    storyArc,
    characters,
    questGraph,
    traitVocabulary,
  } = useStoryStore();

  const {
    phase,
    currentChapterIndex,
    currentSceneIndex,
    currentNodeId,
    dialogueNodes,
    activeFlags,
    traitScores,
    completedQuestIds,
    nextScene,
    prevScene,
    openChapterJump,
    dismissChapterIntro,
    reset,
  } = usePlayStore();

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { reset(); useStoryStore.getState().setActiveView('overview'); }
      if (e.key === 'j' || e.key === 'J') usePlayStore.getState().toggleJournal();
      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (phase === 'scene') nextScene(chapters, transitions);
        if (phase === 'chapter_intro') dismissChapterIntro();
      }
      if (e.key === 'ArrowLeft' && phase === 'scene') prevScene();
      // Number keys for dialogue choices
      if (phase === 'dialogue' && currentNodeId) {
        const node = dialogueNodes.find(n => n.node_id === currentNodeId);
        if (node?.choices) {
          const idx = parseInt(e.key, 10) - 1;
          if (idx >= 0 && idx < node.choices.length) {
            const choice = node.choices[idx];
            if (!choice.condition_flag || activeFlags.includes(choice.condition_flag)) {
              usePlayStore.getState().makeChoice(choice, questGraph);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, currentNodeId, dialogueNodes, activeFlags, chapters, transitions]);

  // Derived data
  const currentChapter = chapters[currentChapterIndex];
  const currentContract = chapterContracts.find(c => c.chapter_id === currentChapter?.chapter_id);
  const currentScene = currentChapter?.scenes?.[currentSceneIndex];
  const currentDialogueNode = currentNodeId ? dialogueNodes.find(n => n.node_id === currentNodeId) : null;
  const currentTransition = transitions.find(t => t.from_chapter_id === currentChapter?.chapter_id);
  const allQuests = [...questGraph, ...(chapters.flatMap(ch => ch.quests || []))];
  // Deduplicate
  const uniqueQuests = Array.from(new Map(allQuests.map(q => [q.quest_id, q])).values());

  // No story data guard
  if (!storyArc || chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-slate-600 gap-4">
        <span className="text-4xl">📖</span>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-400">No story to play yet</p>
          <p className="text-xs text-slate-600 mt-1">Complete the pipeline to Stage 4 first</p>
        </div>
      </div>
    );
  }

  // Full-screen phases (no sidebar)
  const isFullscreen = phase === 'title' || phase === 'chapter_jump' || phase === 'chapter_intro' || phase === 'end';

  const handleNextScene = () => nextScene(chapters, transitions);
  const handleTransitionContinue = () => openChapterJump();

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-[#060911]">
      {/* ── Main content area ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Center reader panel */}
        <div className={`flex-1 overflow-hidden relative ${isFullscreen ? 'w-full' : ''}`}>
          {/* TITLE */}
          {phase === 'title' && storyArc && (
            <TitleScreen storyArc={storyArc} chapterCount={chapters.length} traitVocabulary={traitVocabulary} />
          )}

          {/* CHAPTER JUMP / SELECT */}
          {phase === 'chapter_jump' && (
            <ChapterJumpMenu chapters={chapters} contracts={chapterContracts} traitVocabulary={traitVocabulary} />
          )}

          {/* CHAPTER INTRO */}
          {phase === 'chapter_intro' && currentChapter && (
            <ChapterIntro
              chapter={currentChapter}
              contract={currentContract}
              chapterIndex={currentChapterIndex}
              totalChapters={chapters.length}
            />
          )}

          {/* SCENE READER */}
          {phase === 'scene' && currentScene && (
            <SceneReader
              scene={currentScene}
              sceneIndex={currentSceneIndex}
              totalScenes={currentChapter?.scenes?.length || 1}
              characters={characters}
              onNext={handleNextScene}
            />
          )}

          {/* DIALOGUE */}
          {phase === 'dialogue' && currentDialogueNode && (
            <DialoguePlayer
              node={currentDialogueNode}
              characters={characters}
              traitVocabulary={traitVocabulary}
              quests={uniqueQuests}
              activeFlags={activeFlags}
            />
          )}

          {/* TRANSITION */}
          {phase === 'transition' && currentTransition && (
            <TransitionCard transition={currentTransition} onContinue={handleTransitionContinue} />
          )}

          {/* END */}
          {phase === 'end' && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
              <div className="text-6xl">🎭</div>
              <h2 className="text-3xl font-bold text-slate-100" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {storyArc?.title}
              </h2>
              <p className="text-slate-400 text-sm italic">The story has been told.</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { reset(); openChapterJump(); }}
                  className="px-6 py-2.5 rounded-xl border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white text-sm transition-all"
                >
                  Read Again
                </button>
                <button
                  onClick={() => { reset(); useStoryStore.getState().setActiveView('overview'); }}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all"
                >
                  Back to Designer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar (quest + traits) ── */}
        {!isFullscreen && currentChapter && (
          <div className="w-72 shrink-0 border-l border-slate-800/60 flex flex-col bg-[#07091a]/80 overflow-hidden">
            {/* Quest tracker header */}
            <div className="px-4 py-3 border-b border-slate-800/60 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Quest Log</span>
              <span className="text-[10px] font-mono text-slate-700 ml-2">{currentContract?.title || currentChapter.chapter_id}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <QuestTracker
                quests={uniqueQuests}
                activeFlags={activeFlags}
                completedQuestIds={completedQuestIds}
                traitScores={traitScores}
                traitVocabulary={traitVocabulary}
                currentChapterId={currentChapter.chapter_id}
              />
            </div>

            {/* Trait meters at bottom */}
            <TraitMeter
              traitVocabulary={traitVocabulary}
              traitScores={traitScores}
            />
          </div>
        )}

        {/* Journal drawer (absolute positioned inside the play area) */}
        <JournalDrawer traitVocabulary={traitVocabulary} />
      </div>

      {/* ── Bottom controls bar ── */}
      {phase !== 'title' && (
        <PlayControls
          chapters={chapters}
          contracts={chapterContracts}
          currentChapterIndex={currentChapterIndex}
          currentSceneIndex={currentSceneIndex}
          totalScenes={currentChapter?.scenes?.length || 0}
          phase={phase}
          onNext={handleNextScene}
          onPrev={prevScene}
        />
      )}
    </div>
  );
};
