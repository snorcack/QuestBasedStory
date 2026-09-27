export type TraitTier = 'none' | 'emerging' | 'established' | 'dominant';

export interface TraitDefinition {
  name: string;
  description: string;
  color_hex: string;
}

export interface Act {
  act_number: number;
  title: string;
  summary: string;
}

export interface StoryArc {
  title: string;
  genre: string;
  tone: string;
  themes: string[];
  protagonist_sketch: string;
  antagonist_sketch: string;
  central_conflict: string;
  acts: Act[];
  trait_vocabulary: TraitDefinition[];
}

export interface ChapterState {
  location: string;
  trait_snapshot: Record<string, TraitTier>;
  inventory: string[];
  active_flags: string[];
}

export interface AttachmentPoint {
  slot_id: string;
  chapter_id: string;
  location_id: string;
  available_after: string;
  expires_after: string;
  npcs_present: string[];
  arc_type: string;
  assigned_quest_id?: string | null;
}

export interface ChapterContract {
  chapter_id: string;
  order: number;
  title: string;
  narrative_scope: string;
  entry_state: ChapterState;
  exit_state: ChapterState;
  attachment_points: AttachmentPoint[];
}

export interface ChapterTransition {
  transition_id: string;
  from_chapter_id: string;
  to_chapter_id: string;
  scene_summary: string;
  state_delta: Record<string, any>;
  narrative_hook: string;
}

export interface Scene {
  scene_id: string;
  title: string;
  location_id: string;
  prose: string;
  characters_present: string[];
  emotional_beat?: string;
}

export interface DialogueChoice {
  label: string;
  trait_tag?: string | null;
  flags_set?: string[];
  next_node?: string | null;
  condition_flag?: string | null;
}

export interface DialogueNode {
  node_id: string;
  type: 'speaker' | 'choice' | 'flag' | 'end';
  speaker: string;
  text: string;
  choices: DialogueChoice[];
  next_node?: string | null;
}

export interface ChapterBeat {
  beat_id: string;
  chapter_id: string;
  title: string;
  description: string;
  beat_order: number;
  emotional_tone: string;
  location_id: string;
  quest_ids: string[];
}

export interface AuthoredChapter {
  chapter_id: string;
  contract?: ChapterContract | null;
  scenes: Scene[];
  dialogue_tree: DialogueNode[];
  quests: Quest[];
  characters_present: string[];
  critic_score?: number | null;
  critic_notes?: string | null;
  beats?: ChapterBeat[];
}

// Quest System
export type QuestType =
  | 'main_blocking'
  | 'latent_advantage'
  | 'neutral'
  | 'achievement'
  | 'story_arc'
  | 'investigation'
  | 'stealth'
  | 'crafting'
  | 'character_favor'
  | 'side_quest';

export interface ArcPhase {
  phase_id: string;
  chapter_id: string;
  objective: string;
  unlock_flag: string;
  completion_flag: string;
}

export interface Quest {
  quest_id: string;
  title: string;
  type: QuestType;
  chapter_id: string;
  chapter_ids?: string[];
  beat_id?: string | null;
  location_id: string;
  trigger_flag: string;
  objective: string;
  journal_entry?: string;
  required_trait?: { name: string; strength: TraitTier } | null;
  reward_flags: string[];
  latent_payoff?: { chapter_id: string; description: string } | null;
  attachment_point_id?: string | null;
  arc_phases?: ArcPhase[] | null;
  expires_after_flag?: string | null;
}

export interface ChapterQuestMap {
  chapter_id: string;
  beats: ChapterBeat[];
  quests: Quest[];
  arc_quests: Quest[];
}

export interface Achievement {
  achievement_id: string;
  title: string;
  description: string;
  icon: string;
  trigger_flag: string;
}

// World Bible
export interface Location {
  id: string;
  name: string;
  description: string;
  accessible_from: string[];
  notable_npcs: string[];
}

export interface Faction {
  id: string;
  name: string;
  goals: string;
  territory: string[];
  relationships: Record<string, string>;
}

export interface NPC {
  id: string;
  name: string;
  location: string;
  role: string;
  personality: string;
  dialogue_voice: string;
  portrait_url?: string | null;
  portrait_gallery?: string[];
  portrait_prompt?: string | null;
}

export interface WorldRule {
  id: string;
  category: string;
  rule_text: string;
}

export interface WorldEvent {
  id: string;
  name: string;
  order: number;
  description: string;
}

export interface WorldBible {
  locations: Location[];
  factions: Faction[];
  npcs: NPC[];
  rules: WorldRule[];
  timeline: WorldEvent[];
}

export interface RelationshipEdge {
  source_id: string;
  target_id: string;
  nature: string;
  description: string;
}

// Character
export interface Character {
  id: string;
  name: string;
  role: string;
  location_home: string;
  backstory: string;
  motivation: string;
  flaw: string;
  arc: string;
  dialogue_voice: string;
  dominant_trait_alignment: string;
  relationships?: Record<string, string>;
  portrait_url?: string | null;
  portrait_gallery?: string[];
  portrait_prompt?: string | null;
}

// Pipeline
export type StageEnum =
  | 'stage_1_story_arc'
  | 'stage_2_chapter_breakdown'
  | 'stage_3_transitions'
  | 'stage_3_5_world_cast'
  | 'stage_4_chapter_authoring'
  | 'stage_5_quest_mapping'
  | 'export_complete';

export interface CheckpointData {
  stage: string;
  checkpoint: number;
  chapter_index?: number;
  payload: any;
}

// Project Management
export interface ProjectSummary {
  id: string;
  title: string;
  story_seed: string;
  genre: string;
  tone: string;
  created_at: string;
  updated_at: string;
  current_stage: string;
  status: 'idle' | 'running' | 'awaiting_review' | 'completed' | 'error';
  chapter_count: number;
  quest_count: number;
  has_export: boolean;
  is_explicit?: boolean;
}

export interface ProjectDetail extends ProjectSummary {
  state_snapshot: Record<string, any>;
  checkpoint_data?: CheckpointData | null;
}

export interface CreateProjectRequest {
  title: string;
  story_seed: string;
  genre?: string;
  tone?: string;
  is_explicit?: boolean;
}

// Canvas helpers
export interface NodePosition {
  x: number;
  y: number;
}

export interface ChapterFeedback {
  note: string;
  savedAt?: string;
}
