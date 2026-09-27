import { create } from 'zustand';
import {
  StoryArc,
  ChapterContract,
  ChapterTransition,
  WorldBible,
  Character,
  Location,
  Faction,
  NPC,
  AuthoredChapter,
  Quest,
  Achievement,
  AttachmentPoint,
  TraitDefinition,
  StageEnum,
  CheckpointData,
  ProjectSummary,
  ProjectDetail,
  CreateProjectRequest,
  RelationshipEdge,
  NodePosition,
  ChapterFeedback,
  ChapterQuestMap,
  DialogueNode,
  TraitTier,
  Scene,
} from '../types';

export type ViewType = 'overview' | 'quests' | 'dialogue' | 'traits' | 'cast-world' | 'export' | 'debug' | 'play';

interface StoryStoreState {
  activeView: ViewType;
  threadId: string;
  storySeed: string;
  currentStage: StageEnum;
  activeCheckpoint: CheckpointData | null;
  isGenerating: boolean;
  regenerationNotes: string;
  apiConnected: boolean;
  lastError: string | null;

  // Project management & multi-story workspace
  currentProjectId: string | null;
  currentProjectTitle: string;
  currentProjectGenre: string;
  projects: ProjectSummary[];
  isLoadingProjects: boolean;
  isProjectModalOpen: boolean;
  projectModalTab: 'library' | 'new';
  isExplicit: boolean;

  // Domain data
  storyArc: StoryArc | null;
  chapterContracts: ChapterContract[];
  transitions: ChapterTransition[];
  worldBible: WorldBible | null;
  characters: Character[];
  relationshipMap: RelationshipEdge[];
  chapters: AuthoredChapter[];
  questGraph: Quest[];
  chapterQuestMaps: ChapterQuestMap[];
  arcQuests: Quest[];
  achievements: Achievement[];
  attachmentPoints: AttachmentPoint[];
  traitVocabulary: TraitDefinition[];

  // Interactive canvas state
  selectedChapterId: string | null;
  nodePositions: Record<string, NodePosition>;
  chapterFeedback: Record<string, ChapterFeedback>;

  // Actions
  setActiveView: (view: ViewType) => void;
  setSelectedChapterId: (id: string | null) => void;
  setStorySeed: (seed: string) => void;
  setRegenerationNotes: (notes: string) => void;
  clearError: () => void;
  checkApiHealth: () => Promise<boolean>;
  setNodePosition: (chapterId: string, pos: NodePosition) => void;
  setChapterFeedback: (chapterId: string, note: string) => void;
  clearChapterFeedback: (chapterId: string) => void;

  // Chapter & Dialogue node management
  dialogueNodePositions: Record<string, NodePosition>;
  setDialogueNodePosition: (key: string, pos: NodePosition) => void;
  addChapterContract: (contract?: Partial<ChapterContract>) => void;
  updateChapterContract: (chapterId: string, patch: Partial<ChapterContract>) => void;
  removeChapterContract: (chapterId: string) => void;
  addDialogueNode: (chapterId: string, node?: Partial<DialogueNode>) => void;
  updateDialogueNode: (chapterId: string, nodeId: string, patch: Partial<DialogueNode>) => void;
  removeDialogueNode: (chapterId: string, nodeId: string) => void;

  // Dialogue Tree Undo / Redo
  dialogueHistory: Record<string, { past: DialogueNode[][]; future: DialogueNode[][] }>;
  canUndoDialogue: (chapterId: string) => boolean;
  canRedoDialogue: (chapterId: string) => boolean;
  undoDialogue: (chapterId: string) => void;
  redoDialogue: (chapterId: string) => void;

  // Scene Prose management
  updateScene: (chapterId: string, sceneId: string, patch: Partial<Scene>) => void;
  addScene: (chapterId: string, scene?: Partial<Scene>) => void;
  removeScene: (chapterId: string, sceneId: string) => void;

  // Global Story Search Modal (Ctrl+K)
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchOpen: (open: boolean) => void;

  // World Cast edit actions (Phase 3.5)
  updateCharacter: (id: string, patch: Partial<Character>) => void;
  updateLocation: (id: string, patch: Partial<Location>) => void;
  updateFaction: (id: string, patch: Partial<Faction>) => void;
  updateNPC: (id: string, patch: Partial<NPC>) => void;
  submitWorldCastEdits: () => Promise<void>;
  submitWorldCastFeedback: (notes: string) => Promise<void>;

  // Multi-story actions
  fetchProjects: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (req: CreateProjectRequest) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  openProjectModal: (tab?: 'library' | 'new') => void;
  closeProjectModal: () => void;

  startPipeline: () => Promise<void>;
  resumePipeline: (action: 'approve' | 'regenerate' | 'edit', notes?: string, overrideData?: any) => Promise<void>;
  fetchState: () => Promise<void>;
  loadSampleData: () => void;
}

export const useStoryStore = create<StoryStoreState>((set, get) => ({
  activeView: 'overview',
  threadId: 'designer-session',
  storySeed: 'A detective in a dying city uncovers a conspiracy that reaches into her own past.',
  currentStage: 'stage_1_story_arc',
  activeCheckpoint: null,
  isGenerating: false,
  regenerationNotes: '',
  apiConnected: false,
  lastError: null,

  currentProjectId: null,
  currentProjectTitle: 'A Neon Grave',
  currentProjectGenre: 'Cyber-Noir Mystery',
  projects: [],
  isLoadingProjects: false,
  isProjectModalOpen: false,
  projectModalTab: 'library',

  storyArc: null,
  chapterContracts: [],
  transitions: [],
  worldBible: null,
  characters: [],
  relationshipMap: [],
  chapters: [],
  questGraph: [],
  chapterQuestMaps: [],
  arcQuests: [],
  achievements: [],
  attachmentPoints: [],
  traitVocabulary: [],
  selectedChapterId: 'chapter_01',
  nodePositions: {},
  chapterFeedback: {},
  isExplicit: false,

  // Global search modal state
  isSearchOpen: false,
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),

  setActiveView: (view) => set({ activeView: view }),
  setSelectedChapterId: (id) => set({ selectedChapterId: id }),
  setStorySeed: (seed) => set({ storySeed: seed }),
  setRegenerationNotes: (notes) => set({ regenerationNotes: notes }),
  clearError: () => set({ lastError: null }),
  openProjectModal: (tab = 'library') => set({ isProjectModalOpen: true, projectModalTab: tab }),
  closeProjectModal: () => set({ isProjectModalOpen: false }),

  setNodePosition: (chapterId, pos) =>
    set((s) => ({ nodePositions: { ...s.nodePositions, [chapterId]: pos } })),

  dialogueNodePositions: {},
  setDialogueNodePosition: (key, pos) =>
    set((s) => ({ dialogueNodePositions: { ...s.dialogueNodePositions, [key]: pos } })),

  addChapterContract: (custom) =>
    set((s) => {
      const nextOrder = s.chapterContracts.length + 1;
      const nextId = `chapter_${String(nextOrder).padStart(2, '0')}`;
      const newContract: ChapterContract = {
        chapter_id: nextId,
        title: custom?.title || `Chapter ${nextOrder}`,
        narrative_scope:
          custom?.narrative_scope ||
          'Outline key turning points, investigation, and character conflict for this chapter.',
        entry_state: custom?.entry_state || {
          location: s.worldBible?.locations[0]?.id || 'loc_precinct_07',
          trait_snapshot: {},
          inventory: [],
          active_flags: [],
        },
        exit_state: custom?.exit_state || {
          location: s.worldBible?.locations[1]?.id || 'loc_sunken_bazaar',
          trait_snapshot: {},
          inventory: [],
          active_flags: [],
        },
        order: nextOrder,
        attachment_points: [],
        ...custom,
      };
      return {
        chapterContracts: [...s.chapterContracts, newContract],
        selectedChapterId: nextId,
      };
    }),

  updateChapterContract: (chapterId, patch) =>
    set((s) => ({
      chapterContracts: s.chapterContracts.map((c) =>
        c.chapter_id === chapterId ? { ...c, ...patch } : c
      ),
    })),

  removeChapterContract: (chapterId) =>
    set((s) => {
      const filtered = s.chapterContracts.filter((c) => c.chapter_id !== chapterId);
      const reindexed = filtered.map((c, idx) => ({
        ...c,
        order: idx + 1,
      }));
      return {
        chapterContracts: reindexed,
        selectedChapterId:
          s.selectedChapterId === chapterId
            ? reindexed[0]?.chapter_id || null
            : s.selectedChapterId,
      };
    }),

  dialogueHistory: {},

  canUndoDialogue: (chapterId: string) => {
    const history = get().dialogueHistory[chapterId];
    return (history?.past?.length || 0) > 0;
  },

  canRedoDialogue: (chapterId: string) => {
    const history = get().dialogueHistory[chapterId];
    return (history?.future?.length || 0) > 0;
  },

  undoDialogue: (chapterId: string) => {
    set((s) => {
      const history = s.dialogueHistory[chapterId] || { past: [], future: [] };
      if (history.past.length === 0) return s;
      const newPast = [...history.past];
      const previousTree = newPast.pop()!;
      const chapter = s.chapters.find((c) => c.chapter_id === chapterId);
      const currentTree = chapter?.dialogue_tree || [];

      return {
        chapters: s.chapters.map((c) =>
          c.chapter_id === chapterId ? { ...c, dialogue_tree: previousTree } : c
        ),
        dialogueHistory: {
          ...s.dialogueHistory,
          [chapterId]: {
            past: newPast,
            future: [currentTree, ...history.future].slice(0, 30),
          },
        },
      };
    });
  },

  redoDialogue: (chapterId: string) => {
    set((s) => {
      const history = s.dialogueHistory[chapterId] || { past: [], future: [] };
      if (history.future.length === 0) return s;
      const [nextTree, ...newFuture] = history.future;
      const chapter = s.chapters.find((c) => c.chapter_id === chapterId);
      const currentTree = chapter?.dialogue_tree || [];

      return {
        chapters: s.chapters.map((c) =>
          c.chapter_id === chapterId ? { ...c, dialogue_tree: nextTree } : c
        ),
        dialogueHistory: {
          ...s.dialogueHistory,
          [chapterId]: {
            past: [...history.past, currentTree].slice(-30),
            future: newFuture,
          },
        },
      };
    });
  },

  addDialogueNode: (chapterId, custom) =>
    set((s) => {
      const chapter = s.chapters.find((c) => c.chapter_id === chapterId);
      const existingNodes = chapter?.dialogue_tree || [];
      const nextNum = existingNodes.length + 1;
      const newNode: DialogueNode = {
        node_id: custom?.node_id || `node_${chapterId}_${String(nextNum).padStart(2, '0')}`,
        type: custom?.type || 'speaker',
        speaker: custom?.speaker || s.characters[0]?.id || 'narrator',
        text: custom?.text || 'New dialogue line or story beat description.',
        choices: custom?.choices || [],
        next_node: custom?.next_node || null,
        ...custom,
      };

      const existingHistory = s.dialogueHistory[chapterId] || { past: [], future: [] };
      const newHistory = {
        ...s.dialogueHistory,
        [chapterId]: {
          past: [...existingHistory.past, existingNodes].slice(-30),
          future: [],
        },
      };

      if (chapter) {
        return {
          chapters: s.chapters.map((c) =>
            c.chapter_id === chapterId
              ? { ...c, dialogue_tree: [...c.dialogue_tree, newNode] }
              : c
          ),
          dialogueHistory: newHistory,
        };
      } else {
        const newAuthored: AuthoredChapter = {
          chapter_id: chapterId,
          scenes: [],
          dialogue_tree: [newNode],
          quests: [],
          characters_present: [],
        };
        return {
          chapters: [...s.chapters, newAuthored],
          dialogueHistory: newHistory,
        };
      }
    }),

  updateDialogueNode: (chapterId, nodeId, patch) =>
    set((s) => {
      const chapter = s.chapters.find((c) => c.chapter_id === chapterId);
      const currentTree = chapter?.dialogue_tree || [];
      const existingHistory = s.dialogueHistory[chapterId] || { past: [], future: [] };
      const newHistory = {
        ...s.dialogueHistory,
        [chapterId]: {
          past: [...existingHistory.past, currentTree].slice(-30),
          future: [],
        },
      };

      return {
        chapters: s.chapters.map((c) =>
          c.chapter_id === chapterId
            ? {
                ...c,
                dialogue_tree: (c.dialogue_tree || []).map((n) =>
                  n.node_id === nodeId ? { ...n, ...patch } : n
                ),
              }
            : c
        ),
        dialogueHistory: newHistory,
      };
    }),

  removeDialogueNode: (chapterId, nodeId) =>
    set((s) => {
      const chapter = s.chapters.find((c) => c.chapter_id === chapterId);
      const currentTree = chapter?.dialogue_tree || [];
      const existingHistory = s.dialogueHistory[chapterId] || { past: [], future: [] };
      const newHistory = {
        ...s.dialogueHistory,
        [chapterId]: {
          past: [...existingHistory.past, currentTree].slice(-30),
          future: [],
        },
      };

      return {
        chapters: s.chapters.map((c) =>
          c.chapter_id === chapterId
            ? {
                ...c,
                dialogue_tree: (c.dialogue_tree || []).filter((n) => n.node_id !== nodeId),
              }
            : c
        ),
        dialogueHistory: newHistory,
      };
    }),

  updateScene: (chapterId, sceneId, patch) =>
    set((s) => ({
      chapters: s.chapters.map((c) =>
        c.chapter_id === chapterId
          ? {
              ...c,
              scenes: (c.scenes || []).map((sc) =>
                sc.scene_id === sceneId ? { ...sc, ...patch } : sc
              ),
            }
          : c
      ),
    })),

  addScene: (chapterId, custom) =>
    set((s) => {
      const chapter = s.chapters.find((c) => c.chapter_id === chapterId);
      const existingScenes = chapter?.scenes || [];
      const nextNum = existingScenes.length + 1;
      const newScene: Scene = {
        scene_id: custom?.scene_id || `scene_${chapterId}_${String(nextNum).padStart(2, '0')}`,
        title: custom?.title || `Scene ${nextNum}: New Dramatic Beat`,
        location_id: custom?.location_id || s.worldBible?.locations[0]?.id || 'loc_precinct_07',
        prose: custom?.prose || 'Describe the setting, dramatic tension, and atmospheric details...',
        characters_present: custom?.characters_present || [s.characters[0]?.id || 'protagonist'],
        emotional_beat: custom?.emotional_beat || 'Tension & Anticipation',
        ...custom,
      };

      if (chapter) {
        return {
          chapters: s.chapters.map((c) =>
            c.chapter_id === chapterId
              ? { ...c, scenes: [...(c.scenes || []), newScene] }
              : c
          ),
        };
      } else {
        const newChapter: AuthoredChapter = {
          chapter_id: chapterId,
          scenes: [newScene],
          dialogue_tree: [],
          quests: [],
          characters_present: [],
        };
        return {
          chapters: [...s.chapters, newChapter],
        };
      }
    }),

  removeScene: (chapterId, sceneId) =>
    set((s) => ({
      chapters: s.chapters.map((c) =>
        c.chapter_id === chapterId
          ? {
              ...c,
              scenes: (c.scenes || []).filter((sc) => sc.scene_id !== sceneId),
            }
          : c
      ),
    })),

  setChapterFeedback: (chapterId, note) =>
    set((s) => ({
      chapterFeedback: {
        ...s.chapterFeedback,
        [chapterId]: { note, savedAt: new Date().toISOString() },
      },
    })),

  clearChapterFeedback: (chapterId) =>
    set((s) => {
      const next = { ...s.chapterFeedback };
      delete next[chapterId];
      return { chapterFeedback: next };
    }),

  updateCharacter: (id, patch) =>
    set((s) => ({
      characters: s.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  updateLocation: (id, patch) =>
    set((s) => ({
      worldBible: s.worldBible
        ? {
            ...s.worldBible,
            locations: s.worldBible.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
          }
        : null,
    })),

  updateFaction: (id, patch) =>
    set((s) => ({
      worldBible: s.worldBible
        ? {
            ...s.worldBible,
            factions: s.worldBible.factions.map((f) => (f.id === id ? { ...f, ...patch } : f)),
          }
        : null,
    })),

  updateNPC: (id, patch) =>
    set((s) => ({
      worldBible: s.worldBible
        ? {
            ...s.worldBible,
            npcs: s.worldBible.npcs.map((n) => (n.id === id ? { ...n, ...patch } : n)),
          }
        : null,
    })),

  submitWorldCastEdits: async () => {
    const { currentProjectId, characters, worldBible, relationshipMap, resumePipeline } = get();
    if (!currentProjectId) return;
    await resumePipeline('edit', '', {
      characters,
      world_bible: worldBible,
      relationship_map: relationshipMap,
    });
  },

  submitWorldCastFeedback: async (notes: string) => {
    const { resumePipeline } = get();
    await resumePipeline('regenerate', notes);
  },

  checkApiHealth: async () => {
    try {
      const res = await fetch('/health');
      const ok = res.ok;
      set({ apiConnected: ok });
      return ok;
    } catch {
      set({ apiConnected: false });
      return false;
    }
  },

  fetchProjects: async () => {
    set({ isLoadingProjects: true });
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const list: ProjectSummary[] = await res.json();
      set({ projects: list, apiConnected: true });

      // If no project currently active, select the first one
      if (!get().currentProjectId && list.length > 0) {
        await get().selectProject(list[0].id);
      }
    } catch (e: any) {
      console.warn('Failed fetching projects list:', e);
    } finally {
      set({ isLoadingProjects: false });
    }
  },

  selectProject: async (projectId: string) => {
    set({ isGenerating: true, lastError: null });
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        throw new Error(`Failed to load project (${res.status})`);
      }
      const proj: ProjectDetail = await res.json();
      const vals = proj.state_snapshot || {};

      set({
        currentProjectId: proj.id,
        currentProjectTitle: proj.title,
        currentProjectGenre: proj.genre,
        storySeed: proj.story_seed,
        threadId: proj.id,
        currentStage: (proj.current_stage as StageEnum) || 'stage_1_story_arc',
        activeCheckpoint: proj.checkpoint_data || null,
        storyArc: vals.story_arc || null,
        traitVocabulary: vals.trait_vocabulary || [],
        chapterContracts: vals.chapter_contracts || [],
        transitions: vals.transitions || [],
        worldBible: vals.world_bible || null,
        characters: vals.characters || [],
        relationshipMap: vals.relationship_map || [],
        chapters: vals.chapters || [],
        questGraph: vals.quest_graph || [],
        chapterQuestMaps: vals.chapter_quest_maps || [],
        arcQuests: vals.arc_quests || [],
        achievements: vals.achievements || [],
        attachmentPoints: vals.attachment_points || [],
        selectedChapterId: vals.chapters?.[0]?.chapter_id || vals.chapter_contracts?.[0]?.chapter_id || 'chapter_01',
        isExplicit: !!proj.is_explicit || !!vals.is_explicit,
        isProjectModalOpen: false,
      });
    } catch (e: any) {
      console.error('Error selecting project:', e);
      set({ lastError: e?.message || 'Could not load project' });
    } finally {
      set({ isGenerating: false });
    }
  },

  createProject: async (req: CreateProjectRequest) => {
    set({ isGenerating: true, lastError: null });
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to create project (${res.status})`);
      }
      const created: ProjectDetail = await res.json();
      await get().fetchProjects();
      await get().selectProject(created.id);
      set({ isProjectModalOpen: false });

      // Automatically launch pipeline generation for the newly created story
      await get().startPipeline();
    } catch (e: any) {
      console.error('Error creating project:', e);
      set({ lastError: e?.message || 'Could not create project' });
    } finally {
      set({ isGenerating: false });
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) return;
      const remaining = get().projects.filter((p) => p.id !== projectId);
      set({ projects: remaining });

      if (get().currentProjectId === projectId) {
        if (remaining.length > 0) {
          await get().selectProject(remaining[0].id);
        } else {
          set({
            currentProjectId: null,
            currentProjectTitle: 'Untitled Project',
            storyArc: null,
            chapterContracts: [],
            chapters: [],
          });
        }
      }
    } catch (e: any) {
      console.error('Error deleting project:', e);
    }
  },

  startPipeline: async () => {
    set({ isGenerating: true, lastError: null });
    const pid = get().currentProjectId;
    const url = pid ? `/api/projects/${pid}/start` : '/api/pipeline/start';
    const payload = pid
      ? { story_seed: get().storySeed }
      : { story_seed: get().storySeed, thread_id: get().threadId };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || `Pipeline start failed (HTTP ${res.status})`;
        set({ lastError: msg, apiConnected: true });
        console.error('Pipeline start error:', msg);
        return;
      }
      const data = await res.json();
      set({ apiConnected: true });
      if (data.checkpoint) {
        set({ activeCheckpoint: data.checkpoint });
      }
      await get().fetchState();
      await get().fetchProjects();
    } catch (e: any) {
      console.warn('Backend offline, loading preview data:', e);
      set({ apiConnected: false, lastError: e?.message || 'Cannot reach API server' });
      get().loadSampleData();
    } finally {
      set({ isGenerating: false });
    }
  },

  resumePipeline: async (action, notes = '', overrideData = null) => {
    set({ isGenerating: true, lastError: null });
    const pid = get().currentProjectId;
    const url = pid ? `/api/projects/${pid}/resume` : `/api/pipeline/resume/${get().threadId}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes: notes || get().regenerationNotes,
          override_data: overrideData,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || `Pipeline resume failed (HTTP ${res.status})`;
        set({ lastError: msg, apiConnected: true });
        console.error('Pipeline resume error:', msg);
        return;
      }
      const data = await res.json();
      set({ activeCheckpoint: data.checkpoint || null, regenerationNotes: '', apiConnected: true });
      await get().fetchState();
      await get().fetchProjects();
    } catch (e: any) {
      console.error('Error resuming pipeline:', e);
      set({ apiConnected: false, lastError: e?.message || 'Cannot reach API server' });
    } finally {
      set({ isGenerating: false });
    }
  },

  fetchState: async () => {
    const pid = get().currentProjectId;
    const url = pid ? `/api/projects/${pid}/state` : `/api/pipeline/state/${get().threadId}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const vals = data.values || {};

      set({
        storyArc: vals.story_arc || null,
        traitVocabulary: vals.trait_vocabulary || [],
        chapterContracts: vals.chapter_contracts || [],
        transitions: vals.transitions || [],
        worldBible: vals.world_bible || null,
        characters: vals.characters || [],
        relationshipMap: vals.relationship_map || [],
        chapters: vals.chapters || [],
        questGraph: vals.quest_graph || [],
        chapterQuestMaps: vals.chapter_quest_maps || [],
        arcQuests: vals.arc_quests || [],
        achievements: vals.achievements || [],
        attachmentPoints: vals.attachment_points || [],
        currentStage: vals.current_stage || 'stage_1_story_arc',
        activeCheckpoint: data.checkpoint !== undefined ? data.checkpoint : get().activeCheckpoint,
      });
    } catch (e) {
      console.error('Failed to fetch state snapshot:', e);
    }
  },

  loadSampleData: () => {
    set({
      storyArc: {
        title: 'A Neon Grave',
        genre: 'Cyber-Noir Mystery',
        tone: 'Gritty, melancholic, suspenseful',
        themes: ['Institutional corruption', 'The burden of memory', 'Redemption through truth'],
        protagonist_sketch: 'Detective Elena Cross, plagued by neural glitches from an unsolved case.',
        antagonist_sketch: 'Councilman Julian Sterling, civic leader who buried his criminal past.',
        central_conflict: 'A serial cipher killer targets the syndicate that Cross investigated before her memory wipe.',
        acts: [
          { act_number: 1, title: 'The Ghost in the Circuit', summary: 'Cross investigates an impossible murder pointing to her erased past.' },
          { act_number: 2, title: 'The Sunken Ward', summary: 'Cross infiltrates the flooded archives pursued by Sterling’s enforcers.' },
          { act_number: 3, title: 'The Glass Terminal', summary: 'Cross breaches the Spire Archive core and forces a choice on public truth.' },
        ],
        trait_vocabulary: [
          { name: 'Cunning', description: 'Electronic intrusion, exploiting vulnerabilities', color_hex: '#E0A82E' },
          { name: 'Empathy', description: 'Reading emotional tells, building alliances', color_hex: '#2EA8E0' },
        ],
      },
      traitVocabulary: [
        { name: 'Cunning', description: 'Electronic intrusion, exploiting vulnerabilities', color_hex: '#E0A82E' },
        { name: 'Empathy', description: 'Reading emotional tells, building alliances', color_hex: '#2EA8E0' },
      ],
      chapterContracts: [
        {
          chapter_id: 'chapter_01',
          order: 1,
          title: 'Rain on Lower Conduit',
          narrative_scope: 'Cross investigates a dead-drop in Lower Conduit and discovers the informant dead.',
          entry_state: {
            location: 'loc_district_01',
            trait_snapshot: { Cunning: 'none', Empathy: 'none' },
            inventory: ['detective_badge', 'service_pistol'],
            active_flags: ['ch_01_started'],
          },
          exit_state: {
            location: 'loc_sunken_bazaar',
            trait_snapshot: { Cunning: 'emerging', Empathy: 'none' },
            inventory: ['detective_badge', 'corrupted_chip'],
            active_flags: ['ch_01_completed'],
          },
          attachment_points: [
            {
              slot_id: 'slot_ch01_01',
              chapter_id: 'chapter_01',
              location_id: 'loc_district_01',
              available_after: 'ch_01_started',
              expires_after: 'ch_01_completed',
              npcs_present: ['char_orin'],
              arc_type: 'simple',
            },
          ],
        },
        {
          chapter_id: 'chapter_02',
          order: 2,
          title: 'The Black Market Decryptor',
          narrative_scope: 'Cross seeks renegade technician Orin in the flooded bazaars to decode the chip.',
          entry_state: {
            location: 'loc_sunken_bazaar',
            trait_snapshot: { Cunning: 'emerging', Empathy: 'none' },
            inventory: ['detective_badge', 'corrupted_chip'],
            active_flags: ['ch_01_completed'],
          },
          exit_state: {
            location: 'loc_sunken_bazaar_exit',
            trait_snapshot: { Cunning: 'emerging', Empathy: 'emerging' },
            inventory: ['detective_badge', 'decrypted_spire_manifest'],
            active_flags: ['ch_02_completed'],
          },
          attachment_points: [],
        },
      ],
      questGraph: [
        {
          quest_id: 'quest_001',
          title: 'Decipher the Courier\'s Memory Chip',
          type: 'main_blocking',
          chapter_id: 'chapter_01',
          location_id: 'loc_district_01',
          trigger_flag: 'ch_01_started',
          objective: 'Bypass military ICE on the dead informant’s chip.',
          journal_entry: 'The informant died before speaking, but his chip survived. I need a terminal that won\'t fry.',
          reward_flags: ['ch_01_completed', 'chip_decoded'],
        },
        {
          quest_id: 'quest_002',
          title: 'The Informant\'s Stash',
          type: 'latent_advantage',
          chapter_id: 'chapter_01',
          location_id: 'loc_district_01',
          trigger_flag: 'ch_01_started',
          objective: 'Retrieve Orin\'s emergency decryption key behind the flood valve.',
          reward_flags: ['has_spare_cipher_key'],
          latent_payoff: { chapter_id: 'chapter_06', description: 'Extra exploit path in Spire Core.' },
        },
      ],
      chapters: [
        {
          chapter_id: 'chapter_01',
          scenes: [
            {
              scene_id: 'sc_ch01_01',
              title: 'Cold Neon',
              location_id: 'loc_district_01',
              prose: 'The acid rain wept down the carbon shutters. Elena Cross clicked her trench lighter, the flame revealing the blood on the drainage grate.',
              characters_present: ['char_cross'],
              emotional_beat: 'Cynical isolation and impending discovery',
            },
          ],
          dialogue_tree: [
            {
              node_id: 'node_01',
              type: 'speaker',
              speaker: 'char_orin',
              text: 'Drones are already sweeping the upper conduit, Elena. Do we crack the chip or bury it?',
              choices: [
                { label: 'Hook it up to your rig. I need those keys now.', trait_tag: 'Cunning', next_node: 'node_02a' },
                { label: 'Tell me about the courier first, Orin. What happened to him?', trait_tag: 'Empathy', next_node: 'node_02b' },
              ],
            },
            {
              node_id: 'node_02a',
              type: 'speaker',
              speaker: 'char_orin',
              text: 'ICE shattered. Coordinates extracted.',
              choices: [],
              next_node: 'node_end',
            },
            {
              node_id: 'node_02b',
              type: 'speaker',
              speaker: 'char_orin',
              text: 'His name was Felix. He died protecting your past, Cross.',
              choices: [],
              next_node: 'node_end',
            },
            {
              node_id: 'node_end',
              type: 'end',
              speaker: 'narrator',
              text: 'The screen hums into cold blue focus as the terminal decrypts.',
              choices: [],
            },
          ],
          quests: [],
          characters_present: ['char_cross', 'char_orin'],
          critic_score: 86,
          critic_notes: 'Atmospheric scene pacing with solid sensory details.',
        },
      ],
      achievements: [
        {
          achievement_id: 'ach_01',
          title: 'Ghost in the Wire',
          description: 'Decode the chip without alerting Spire ICE.',
          icon: 'shield',
          trigger_flag: 'chip_decoded',
        },
      ],
      activeCheckpoint: {
        stage: 'stage_1_story_arc',
        checkpoint: 1,
        payload: {
          story_arc: { title: 'A Neon Grave' },
        },
      },
    });
  },
}));
