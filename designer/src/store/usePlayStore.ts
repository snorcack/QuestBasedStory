import { create } from 'zustand';
import { DialogueChoice, DialogueNode, Quest, TraitDefinition } from '../types';

// ─── Play-specific types ──────────────────────────────────────────────────────

export type PlayPhase =
  | 'title'
  | 'chapter_jump'
  | 'chapter_intro'
  | 'scene'
  | 'dialogue'
  | 'transition'
  | 'end';

export interface ChoiceRecord {
  nodeId: string;
  choiceLabel: string;
  traitTag: string | null;
  flagsSet: string[];
  timestamp: string;
}

export interface JournalEntry {
  type: 'scene' | 'choice' | 'quest_complete' | 'transition' | 'chapter';
  label: string;
  detail: string;
  chapterId: string;
}

export interface ChapterTraitConfig {
  chapterId: string;
  traitScores: Record<string, number>;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface PlayStoreState {
  phase: PlayPhase;
  currentChapterIndex: number;
  currentSceneIndex: number;
  dialoguePlayed: boolean;
  currentNodeId: string | null;
  dialogueNodes: DialogueNode[];
  activeFlags: string[];
  traitScores: Record<string, number>;
  completedQuestIds: string[];
  choiceHistory: ChoiceRecord[];
  chapterTraitConfigs: ChapterTraitConfig[];
  isJournalOpen: boolean;
  journalEntries: JournalEntry[];
  comfyuiUrl: string;
  comfyuiWorkflow: Record<string, any> | null;
  comfyuiPromptNodeId: string;
  comfyuiOutputNodeId: string;
  generatingPortraitIds: string[];

  begin(): void;
  openChapterJump(): void;
  goToChapter(index: number, chapters: any[], traitVocabulary: TraitDefinition[], traitOverride?: Record<string, number>): void;
  dismissChapterIntro(): void;
  nextScene(chapters: any[], transitions: any[]): void;
  prevScene(): void;
  makeChoice(choice: DialogueChoice, quests: Quest[]): void;
  advanceDialogue(): void;
  toggleJournal(): void;
  setChapterTraitConfig(chapterId: string, scores: Record<string, number>): void;
  setComfyuiSettings(url: string, workflow: Record<string, any> | null, promptNodeId: string, outputNodeId: string): void;
  setGeneratingPortrait(characterId: string, generating: boolean): void;
  reset(): void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function traitTierToScore(tier: string): number {
  switch (tier) {
    case 'emerging': return 1;
    case 'established': return 3;
    case 'dominant': return 5;
    default: return 0;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlayStore = create<PlayStoreState>((set, get) => ({
  phase: 'title',
  currentChapterIndex: 0,
  currentSceneIndex: 0,
  dialoguePlayed: false,
  currentNodeId: null,
  dialogueNodes: [],
  activeFlags: [],
  traitScores: {},
  completedQuestIds: [],
  choiceHistory: [],
  chapterTraitConfigs: [],
  isJournalOpen: false,
  journalEntries: [],
  comfyuiUrl: (typeof localStorage !== 'undefined' && localStorage.getItem('comfyui_url')) || 'http://127.0.0.1:8188',
  comfyuiWorkflow: null,
  comfyuiPromptNodeId: (typeof localStorage !== 'undefined' && localStorage.getItem('comfyui_prompt_node')) || '6',
  comfyuiOutputNodeId: (typeof localStorage !== 'undefined' && localStorage.getItem('comfyui_output_node')) || '9',
  generatingPortraitIds: [],

  begin: () => set({ phase: 'chapter_jump' }),

  openChapterJump: () => set({ phase: 'chapter_jump' }),

  goToChapter: (index, chapters, traitVocabulary, traitOverride) => {
    const chapter = chapters[index];
    if (!chapter) return;

    const contract = chapter.contract;
    const entryFlags: string[] = contract?.entry_state?.active_flags || [];

    const config = get().chapterTraitConfigs.find(c => c.chapterId === chapter.chapter_id);
    let scores: Record<string, number> = {};

    if (traitOverride) {
      scores = { ...traitOverride };
    } else if (config) {
      scores = { ...config.traitScores };
    } else {
      const snapshot = contract?.entry_state?.trait_snapshot || {};
      for (const t of traitVocabulary) {
        scores[t.name] = traitTierToScore(snapshot[t.name] || 'none');
      }
    }

    set({
      phase: 'chapter_intro',
      currentChapterIndex: index,
      currentSceneIndex: 0,
      dialoguePlayed: false,
      currentNodeId: null,
      dialogueNodes: chapter.dialogue_tree || [],
      activeFlags: [...entryFlags],
      traitScores: scores,
      journalEntries: [
        ...get().journalEntries,
        {
          type: 'chapter',
          label: contract?.title || chapter.chapter_id,
          detail: contract?.narrative_scope || '',
          chapterId: chapter.chapter_id,
        },
      ],
    });
  },

  dismissChapterIntro: () => set({ phase: 'scene' }),

  nextScene: (chapters, transitions) => {
    const { currentChapterIndex, currentSceneIndex, dialoguePlayed, dialogueNodes, journalEntries } = get();
    const chapter = chapters[currentChapterIndex];
    if (!chapter) return;

    const scenes = chapter.scenes || [];
    const hasMoreScenes = currentSceneIndex + 1 < scenes.length;

    if (hasMoreScenes) {
      const nextIdx = currentSceneIndex + 1;
      const scene = scenes[nextIdx];
      set({
        phase: 'scene',
        currentSceneIndex: nextIdx,
        journalEntries: [
          ...journalEntries,
          {
            type: 'scene',
            label: scene?.title || `Scene ${nextIdx + 1}`,
            detail: (scene?.prose || '').slice(0, 120) + '…',
            chapterId: chapter.chapter_id,
          },
        ],
      });
      return;
    }

    // Try dialogue
    if (!dialoguePlayed && dialogueNodes.length > 0) {
      const rootNode = dialogueNodes[0];
      set({ phase: 'dialogue', currentNodeId: rootNode?.node_id || null, dialoguePlayed: true });
      return;
    }

    // Look for transition
    const transition = transitions.find((t: any) => t.from_chapter_id === chapter.chapter_id);
    if (transition) {
      set({
        phase: 'transition',
        journalEntries: [
          ...get().journalEntries,
          {
            type: 'transition',
            label: `→ ${transition.to_chapter_id}`,
            detail: (transition.scene_summary || '').slice(0, 120) + '…',
            chapterId: chapter.chapter_id,
          },
        ],
      });
      return;
    }

    if (currentChapterIndex + 1 < chapters.length) {
      set({ phase: 'chapter_jump' });
      return;
    }

    set({ phase: 'end' });
  },

  prevScene: () => {
    const { currentSceneIndex, phase } = get();
    if (phase === 'dialogue') {
      set({ phase: 'scene', dialoguePlayed: false });
      return;
    }
    if (currentSceneIndex > 0) {
      set({ currentSceneIndex: currentSceneIndex - 1 });
    }
  },

  makeChoice: (choice, quests) => {
    const { currentNodeId, activeFlags, traitScores, completedQuestIds, choiceHistory, journalEntries } = get();
    if (!currentNodeId) return;

    const newFlags = [...activeFlags, ...(choice.flags_set || [])];
    const newScores = { ...traitScores };
    if (choice.trait_tag) {
      newScores[choice.trait_tag] = (newScores[choice.trait_tag] || 0) + 1;
    }

    const newlyCompleted: Quest[] = [];
    for (const q of quests) {
      if (completedQuestIds.includes(q.quest_id)) continue;
      if (!newFlags.includes(q.trigger_flag)) continue;
      if (q.expires_after_flag && newFlags.includes(q.expires_after_flag)) continue;
      newlyCompleted.push(q);
    }

    const choiceRecord: ChoiceRecord = {
      nodeId: currentNodeId,
      choiceLabel: choice.label,
      traitTag: choice.trait_tag || null,
      flagsSet: choice.flags_set || [],
      timestamp: new Date().toISOString(),
    };

    const newJournal: JournalEntry[] = [
      ...journalEntries,
      { type: 'choice', label: choice.label, detail: choice.trait_tag ? `[${choice.trait_tag}]` : '', chapterId: '' },
      ...newlyCompleted.map(q => ({
        type: 'quest_complete' as const,
        label: `✅ ${q.title}`,
        detail: q.objective,
        chapterId: q.chapter_id,
      })),
    ];

    set({
      activeFlags: newFlags,
      traitScores: newScores,
      completedQuestIds: [...completedQuestIds, ...newlyCompleted.map(q => q.quest_id)],
      choiceHistory: [...choiceHistory, choiceRecord],
      currentNodeId: choice.next_node || null,
      journalEntries: newJournal,
    });
  },

  advanceDialogue: () => {
    const { currentNodeId, dialogueNodes } = get();
    if (!currentNodeId) {
      set({ phase: 'scene', dialoguePlayed: true });
      return;
    }
    const node = dialogueNodes.find(n => n.node_id === currentNodeId);
    if (!node || node.type === 'end' || !node.next_node) {
      set({ phase: 'scene', dialoguePlayed: true, currentNodeId: null });
      return;
    }
    set({ currentNodeId: node.next_node });
  },

  toggleJournal: () => set(s => ({ isJournalOpen: !s.isJournalOpen })),

  setChapterTraitConfig: (chapterId, scores) => {
    const existing = get().chapterTraitConfigs.filter(c => c.chapterId !== chapterId);
    set({ chapterTraitConfigs: [...existing, { chapterId, traitScores: scores }] });
  },

  setComfyuiSettings: (url, workflow, promptNodeId, outputNodeId) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('comfyui_url', url);
      localStorage.setItem('comfyui_prompt_node', promptNodeId);
      localStorage.setItem('comfyui_output_node', outputNodeId);
    }
    set({ comfyuiUrl: url, comfyuiWorkflow: workflow, comfyuiPromptNodeId: promptNodeId, comfyuiOutputNodeId: outputNodeId });
  },

  setGeneratingPortrait: (characterId, generating) => {
    const current = get().generatingPortraitIds;
    set({ generatingPortraitIds: generating ? [...current, characterId] : current.filter(id => id !== characterId) });
  },

  reset: () => set({
    phase: 'title',
    currentChapterIndex: 0,
    currentSceneIndex: 0,
    dialoguePlayed: false,
    currentNodeId: null,
    dialogueNodes: [],
    activeFlags: [],
    traitScores: {},
    completedQuestIds: [],
    choiceHistory: [],
    isJournalOpen: false,
    journalEntries: [],
    generatingPortraitIds: [],
  }),
}));
