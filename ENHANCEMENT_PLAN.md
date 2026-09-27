# QuestForge Enhancement Plan

> Based on user requirements gathered 2026-09-21. Implement sequentially — each phase can be tested independently.

---

## Phase 1 — Interactive Chapter Canvas (StoryOverview drag-and-drop)

**Goal**: Replace the read-only static nodes with a fully interactive ReactFlow canvas where chapters can be expanded, moved, added, and removed.

### 1.1 — Expand `ChapterNode.tsx`

- Add a toggle state (`expanded`) with a click handler on the node header.
- **Collapsed state** (current): shows chapter ID, title, entry/exit location, trait badges.
- **Expanded state**: adds:
  - `narrative_scope` full text (no line-clamp)
  - Scene list (scene_id, title, emotional beat) — sourced from `AuthoredChapter` once authored
  - Attachment point slots (Open / Assigned badge)
  - **Chapter Feedback textarea** (Phase 2 hook — placeholder rendered here)
- Add a `+` node button on the canvas toolbar to inject a blank chapter contract after any selected chapter.
- Add a `×` delete button on each node — soft-deletes the chapter from store, flags contract as `user_removed`.
- Nodes become draggable (already supported by ReactFlow, just need `draggable` prop + `onNodeDragStop` to persist positions to store).

### 1.2 — Chapter Side Panel

- When a node is **selected** (click on header), a side drawer slides in from the right (550px wide).
- Sections: Overview → Scenes → Dialogue Tree → Chapter Feedback.
- Side panel state lives in `useStoryStore` as `selectedChapterId`.

### 1.3 — Canvas Toolbar Additions

Add to top-left toolbar in `StoryOverview.tsx`:
| Button | Action |
|---|---|
| `+ Add Chapter` | Appends a blank contract after the last selected node |
| `Auto Layout` | Resets all node positions to auto-layout (alternating Y stagger) |
| `Fit View` | Zooms to fit all nodes |

### 1.4 — Store Updates (`useStoryStore.ts`)

- `nodePositions: Record<string, {x: number, y: number}>` — persisted per project.
- `selectedChapterId: string | null`
- `removeChapter(chapter_id)` action
- `addChapter(after_id)` action — creates stub `ChapterContract`

---

## Phase 2 — Per-Chapter Feedback & Targeted Regeneration

**Goal**: Each chapter node and its side panel expose a feedback textarea. Submitting it queues the chapter for targeted regeneration through the Narrator+Critic loop only.

### 2.1 — Store State

```ts
chapterFeedback: Record<string, string>          // chapter_id → feedback note
chapterRegenerationQueue: string[]               // ordered list of chapter_ids pending regen
setChapterFeedback(chapterId, note): void
queueChapterRegeneration(chapterId): void
clearChapterFeedback(chapterId): void
```

### 2.2 — UI Changes

- Feedback textarea rendered inside the expanded `ChapterNode` (bottom section) and also inside the Side Panel's "Chapter Feedback" tab.
- Two buttons beneath the textarea:
  - **Save Note** — persists to store without triggering regeneration.
  - **Regenerate Chapter** — saves note and queues the chapter, then calls the backend.

### 2.3 — Backend Endpoint

New `POST /api/regenerate-chapter` endpoint in `server.py`:

```python
{
  "project_id": "...",
  "chapter_id": "chapter_03",
  "feedback_notes": "Make this chapter darker, Elena should show more vulnerability."
}
```

- Runs `NarratorAgent.author_chapter_prose()` with the `critic_notes` field populated.
- Then runs `CritiqueAgent` against only that chapter.
- Re-stitches transitions for adjacent chapters.
- Returns the updated `AuthoredChapter`.

### 2.4 — Pipeline Changes (`narrator.py` + `critic.py`)

- `author_chapter_prose` already has `critic_notes: str` — wire the feedback directly there.
- Add `targeted_regen_chapter_id` field to `GraphState` to signal partial re-run.

---

## Phase 3 — Pipeline Stage Review Panel ("What Just Happened")

**Goal**: After each pipeline stage completes and a checkpoint is reached, display a structured summary panel before prompting Approve/Regenerate.

### 3.1 — Backend: Stage Summary Object

Each pipeline stage node function returns a `StageSummary` typed dict:

```python
class StageSummary(TypedDict):
    stage: str
    headline: str           # 1 sentence of what was produced
    bullets: list[str]      # 3-5 bullet highlights
    review_guidance: str    # what the user should look at before approving
    counts: dict[str, int]  # e.g. {"chapters": 8, "quests": 14, "traits": 3}
```

This gets written into `GraphState.stage_summaries: dict[str, StageSummary]`.

### 3.2 — API: Expose Stage Summaries

`GET /api/projects/{project_id}/state` already returns graph state — add `stage_summaries` to the `StoryState` response schema.

### 3.3 — Frontend: Stage Review Panel Component

New `StageReviewPanel.tsx` component, rendered above the canvas when `activeCheckpoint` is set:

```
┌─────────────────────────────────────────────────────────┐
│  ✦ Stage 2 Complete — Chapter Contracts                  │
│  "The story arc was broken into 8 chapter contracts      │
│   across 3 acts with consistent trait transitions."      │
│                                                          │
│  • 8 chapters drafted (Acts I–III)                       │
│  • 3 trait dimensions tracked across all transitions     │
│  • 4 attachment points reserved for optional content     │
│  • 2 chapters flagged with ambiguous exits               │
│                                                          │
│  👀 Review the StoryOverview tab. Check that the         │
│     chapter count, act structure, and trait arc are      │
│     accurate before approving.                           │
│                                                          │
│  [ Regenerate with notes... ]  [ ✓ Approve & Continue ] │
└─────────────────────────────────────────────────────────┘
```

- The existing `CheckpointBanner` is simplified to just the action buttons.
- The review panel is a dismissible card above the banner.

### 3.4 — Activity Log in Debug Tab

- Add `stageActivityLog: StageSummary[]` to the Debug tab.
- Each completed stage appends its summary to the log with timestamp.
- Persists for the life of the project.

---

## Phase 4 — Quest System Overhaul (Multi-Beat, Multi-Quest)

**Goal**: Move from 1 quest per story to 2–5 quests per chapter beat, with spanning arc quests and 7 quest types.

### 4.1 — Data Model Changes (`pipeline/models/quest.py`)

#### New `QuestType` values

```python
class QuestType(str, Enum):
    MAIN_BLOCKING   = "main_blocking"
    LATENT_ADVANTAGE = "latent_advantage"
    ACHIEVEMENT     = "achievement"
    STORY_ARC       = "story_arc"          # multi-chapter arc quest
    INVESTIGATION   = "investigation"       # clue collection
    STEALTH         = "stealth"             # infiltration/social engineering
    CRAFTING        = "crafting"            # item assembly / ingredient collection
```

#### New `ChapterBeat` model

```python
class ChapterBeat(BaseModel):
    beat_id: str               # e.g. "beat_ch02_01"
    chapter_id: str
    title: str                 # e.g. "The Sewer Crossing"
    description: str           # 2-3 sentences of narrative moment
    beat_order: int            # 1-based index within chapter
    emotional_tone: str        # e.g. "tense", "exploratory", "climactic"
    location_id: str
    quest_ids: list[str]       # quests belonging to this beat
```

#### Extended `Quest` model

```python
# New / changed fields:
beat_id: str | None                # which beat within its chapter
chapter_ids: list[str]             # replaces single chapter_id; list for spanning quests
arc_phases: list[ArcPhase] | None  # only for STORY_ARC type

class ArcPhase(BaseModel):
    phase_id: str
    chapter_id: str
    objective: str
    unlock_flag: str
    completion_flag: str
```

#### New `ChapterQuestMap` model

```python
class ChapterQuestMap(BaseModel):
    chapter_id: str
    beats: list[ChapterBeat]
    quests: list[Quest]         # all quests (including beat-level + arc quests touching this chapter)
    arc_quests: list[Quest]     # spanning arc quests with a phase in this chapter
```

### 4.2 — Pipeline: New Stage 4.5 (Beat Generation at Authoring Time)

Per the user's choice: **beats are generated during Stage 4 chapter authoring**, driving the narrator's scene breakdown.

Changes to `NarratorAgent.author_chapter_prose()`:
1. First LLM call: `generate_chapter_beats(contract)` → returns `list[ChapterBeat]` (3-5 beats).
2. Second LLM call: `author_scenes_from_beats(beats, contract, ...)` → scenes now map directly to beats.
3. Returns `AuthoredChapter` enriched with `beats: list[ChapterBeat]`.

### 4.3 — QuestArchitect Overhaul (`quest_architect.py`)

**Complete rewrite of `analyze_and_map_quests()`**:

1. **Per-Chapter Quest Generation** — for each chapter, call:
   ```
   QuestArchitectAgent.map_quests_for_chapter(chapter, beats, world_bible, traits)
   ```
   - Input: authored chapter + its beats
   - Output: `ChapterQuestMap` with 2-5 quests per beat
   - Quest types drawn from the 7 types, LLM chooses based on narrative context

2. **Arc Quest Pass** — second LLM call over all chapters:
   ```
   QuestArchitectAgent.generate_arc_quests(all_chapters, chapter_quest_maps)
   ```
   - Identifies 1-3 `STORY_ARC` quests that span multiple chapters
   - Each arc quest has `ArcPhase` entries listing unlock/completion flags per chapter
   - Arc quests are added to the relevant `ChapterQuestMap.arc_quests` lists

3. **Trait Validation** — extended to validate beat-level quests (same logic, more entries).

4. **Output**: `list[ChapterQuestMap]` replaces the flat `list[Quest]`.

### 4.4 — Updated Quest Architect Prompt (`quest_architect.yaml`)

```yaml
system_prompt: |
  You are the Quest Architect. Your job is to transform authored narrative 
  chapters and their beats into a rich, layered quest structure.
  
  Per chapter, you MUST generate:
  - At least 2 quests per beat (min 2, max 5 per beat)
  - A mix of: main_blocking, latent_advantage, stealth, investigation, crafting, achievement
  - At least 1 latent_advantage quest per chapter that pays off in a later chapter
  
  After processing all chapters, you identify 1-3 story_arc quests that span 
  multiple chapters with phased objectives.
  
  Quest IDs follow the format: quest_{chapter}_{beat}_{index}
  Beat IDs follow the format: beat_{chapter}_{order}
```

### 4.5 — GraphState Updates (`pipeline/models/state.py`)

```python
chapter_quest_maps: list[ChapterQuestMap] = []
arc_quests: list[Quest] = []
```

### 4.6 — API Updates (`server.py`)

- `StoryState` response extended with `chapter_quest_maps`, `arc_quests`.
- `GET /api/projects/{id}/state` serializes new fields.

### 4.7 — Frontend: Quest Graph Overhaul (`QuestGraph.tsx`)

New layout per user choice — **quest canvas with chapter boundaries**:

```
┌─ Chapter 1 ──────────────────┐   ┌─ Chapter 2 ───────────────────┐
│  Beat 1: The Sewer Crossing  │   │  Beat 1: Market Infiltration  │
│  ┌──────────┐  ┌──────────┐  │   │  ┌──────────┐                 │
│  │ MB Quest │  │ ST Quest │  │   │  │ MB Quest │                 │
│  └──────────┘  └──────────┘  │   │  └──────────┘                 │
│                              │   │                               │
│  Beat 2: The Broker Meet     │   │  Beat 2: The Escape           │
│  ┌──────────┐                │   │  ┌──────────┐  ┌──────────┐   │
│  │ IN Quest │                │   │  │ CR Quest │  │ LA Quest │   │
│  └──────────┘                │   │  └──────────┘  └──────────┘   │
└──────────────────────────────┘   └───────────────────────────────┘
         │ Arc Quest: "The Fractured Accord" spans Ch1→Ch2→Ch5 │
```

- Chapter boundary nodes are `GroupNode` (ReactFlow 11+).
- Quest nodes are coloured by type (existing color scheme extended for new types).
- Arc quest spanning edges are rendered with a **dashed arc** crossing chapter groups.
- Filter toolbar extended: `STORY_ARC`, `INVESTIGATION`, `STEALTH`, `CRAFTING`.

---

## Delivery Order

| # | Phase | Key Files | Complexity |
|---|-------|-----------|------------|
| 1 | Interactive Chapter Canvas | `ChapterNode.tsx`, `StoryOverview.tsx`, `useStoryStore.ts` | Medium |
| 2 | Per-Chapter Feedback + Regen | `ChapterNode.tsx`, `server.py`, `narrator.py`, store | Medium |
| 3 | Stage Review Panel | `StageReviewPanel.tsx`, `CheckpointBanner.tsx`, `pipeline.py` | Medium |
| 4 | Quest System Overhaul | `quest.py`, `narrator.py`, `quest_architect.py`, `quest_architect.yaml`, `QuestGraph.tsx` | High |

Phases 1–3 are frontend-heavy and can be done in parallel with Phase 4 backend work. Phase 4 frontend (QuestGraph) depends on Phase 4 backend models being done first.

> [!IMPORTANT]
> Phase 4 requires re-running Stage 5 on any existing story projects. Existing `questGraph` arrays in store state will be replaced by `chapterQuestMaps`. The Debug tab will surface any schema migration issues.
