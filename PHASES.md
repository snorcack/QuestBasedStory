# QuestForge — Phase Development Plan
**Version 1.0**

---

## Why Phases, Not One-Shot

QuestForge has a hard dependency chain that makes one-shot builds high-risk:

```
Data Models → LangGraph Skeleton → Agents → Full Pipeline → Designer UI → Integration
```

Every layer depends on the one before it being stable. Building simultaneously means:
- Agents coded against data models that are still changing
- UI built against an API that doesn't exist yet
- No testable system until very late — bugs are hard to locate
- LLM API costs wasted on broken pipeline runs

The system also has a natural architectural seam: **the backend pipeline and the designer UI are completely independent**. The pipeline is fully testable from a terminal. The UI can be developed against stubbed API responses. They only need to be integrated in the final phase.

---

## Phase Overview

| Phase | Name | Goal | Key Milestone |
|---|---|---|---|
| **1** | Foundation & Data Models | Contracts defined before any agent is written | Pipeline boots through all 5 checkpoints with stubs |
| **2** | Story Spine | Seed → approved chapter contracts in the terminal | Main Planner produces resumable, human-approved story structure |
| **3** | Chapter Authoring Loop | One chapter fully authored end-to-end | Narrator ↔ Critic loop validated; chapter contract hard gate passes |
| **4** | Full Pipeline & Export | Seed → complete JSON package, terminal only | Working end-to-end product, no UI required |
| **5** | Designer UI | Visual node-based tool on top of proven backend | Full pipeline runs through the React Flow interface |
| **6** | Hardening & Prompt Tuning | Production-ready, not just functional | Unfamiliar designer can install and run to completion |

---

## Phase 1 — Foundation & Data Models

> **Goal:** Every data contract is defined and the pipeline skeleton is wired before any agent logic is written.

### Rationale
The Pydantic models are the contract everything else implements. Define them wrong and you refactor every downstream agent. Defining them first forces all design decisions to become concrete — types, field names, enums, relationships — before a single LLM call is made.

### Deliverables

- [x] Project scaffolding — folder structure, `.gitignore`, `.env.example`, `README.md`
- [x] `.env` configuration — Vertex AI and Gemini API backends, all pipeline settings
- [x] **All Pydantic v2 models** (the critical deliverable of this phase):
  - `SharedContext` — full pipeline state
  - `StoryArc`, `ChapterContract`, `ChapterTransition`
  - `WorldBible` — `Location`, `Faction`, `NPC`, `Rule`, `Event`
  - `Character`, `RelationshipMap`
  - `TraitDefinition`, `TraitSnapshot`, `TraitArcValidation`
  - `DialogueNode`, `DialogueChoice`, `DialogueTree`
  - `Quest`, `AttachmentPoint`, `Achievement`
  - `AuthoredChapter`, `Scene`
  - `ExportManifest`
- [x] Prompt loader utility — reads `pipeline/prompts/*.yaml`, validates schema, injects into agent
- [x] LLM client abstraction — single interface switching between Vertex AI / Gemini API via `LLM_BACKEND` env var
- [x] ChromaDB setup — lore store initialisation and basic similarity search
- [x] **LangGraph graph skeleton** — all 5 stages wired as stub nodes, no agent logic
- [x] FastAPI server + SSE endpoint — emits stub checkpoint payloads per stage
- [x] Stub prompt YAML files — one per agent, placeholder system prompts

### Milestone
```
Pipeline boots end-to-end.
All 5 checkpoints emit correctly over SSE with stub data.
SharedContext serialises and deserialises cleanly.
Zero LLM calls made — no API cost.
```

---

## Phase 2 — The Story Spine (Pipeline Stages 1–3)

> **Goal:** From a story seed → approved story arc → approved chapter contracts → approved transitions. Entirely in the terminal.

### Rationale
The Main Planner's output is the input to everything else. If the story arc is wrong, no downstream agent can produce good output. Validate this layer first, in isolation, before any content agent is built. This phase also establishes the human checkpoint loop (interrupt → review → resume) that all later phases depend on.

### Deliverables

- [x] **Main Planner agent** — three-pass story decomposition:
  - Pass 1: Story arc (title, genre, tone, themes, protagonist sketch, antagonist, central conflict, 3-act outline)
  - Pass 2: Chapter Contracts (6–8 contracts with entry/exit states, trait vocabulary, attachment slot counts)
  - Pass 3: Chapter Transitions (transition summaries, state deltas, narrative hooks)
- [x] `pipeline/prompts/main_planner.yaml` — full system prompt for all three passes
- [x] **LangGraph `interrupt()` at each of the 3 Main Planner checkpoints**
- [x] Terminal-based checkpoint reviewer:
  - Prints stage output (formatted)
  - Prompts: `[A]pprove / [E]dit / [R]egenerate with notes`
  - Edits applied to SharedContext before proceeding
  - Regeneration notes fed back into agent prompt
- [x] **SharedContext persistence** — LangGraph SQLite checkpointer; sessions save to disk and resume correctly
- [x] Trait vocabulary extraction — Main Planner infers exactly 2 trait names from the story seed

### Milestone
```
Input: "A detective in a dying city uncovers a conspiracy that reaches into her own past."

Output (after human review and approval):
  ✓ Story arc document (title, tone, 3-act outline, protagonist/antagonist sketches)
  ✓ 6 chapter contracts (entry/exit states, trait vocabulary defined)
  ✓ 5 chapter transition documents

Session saved to disk. Close terminal, reopen, resume from last approved checkpoint.
```

---

## Phase 3 — Chapter Authoring Loop (Pipeline Stage 4)

> **Goal:** One chapter fully authored — prose, dialogue tree, character moments — reviewed and approved by a human. The Narrator ↔ Critic loop validated.

### Rationale
This is the most complex part of the pipeline. The Narrator ↔ Critic loop has a back-edge in the LangGraph — the hardest topology to get right. Isolate and validate it on a single chapter before scaling to 6. The Critic's contract validation (hard gate) must also be proven here. All prompt tuning for content quality happens in this phase.

### Deliverables

- [x] **Lore Weaver agent** — builds World Bible from story arc; per-chapter world context extraction
  - `pipeline/prompts/lore_weaver.yaml`
  - ChromaDB lore embedding store — contradiction detection against existing entries
- [x] **Narrator agent** — scene-by-scene prose from chapter contract + world context + character sheets
  - `pipeline/prompts/narrator.yaml`
  - Supports: Hero's Journey, Story Circle, Save the Cat, 3-act structures
  - Journal entry authoring for every BLOCKING quest (first-person protagonist voice)
- [x] **Critic agent** — rubric scoring + contract validation
  - `pipeline/prompts/critic.yaml`
  - `pipeline/tools/rubric.py` — scoring logic (Plot Coherence /25, Character Motivation /25, World Consistency /20, Pacing /15, Emotional Impact /15)
  - Hard gate: chapter contract validation (wrong exit state / wrong trait level = FAIL regardless of score)
  - Revision note generation (structured, scene-specific)
- [x] **Narrator ↔ Critic loop** — LangGraph back-edge; max 3 iterations; escalate to human on iteration 3 fail
- [x] **Branch Keeper agent** — full dialogue tree for the chapter; trait-tagged choices
  - `pipeline/prompts/branch_keeper.yaml`
  - Trait tagging validation: enough tagged choices for `established` by mid-story?
- [x] **Character Forge agent** — character sheets, relationship map, voice samples
  - `pipeline/prompts/character_forge.yaml`
  - Runs once after Phase 2; character sheets feed into Narrator and Branch Keeper
- [x] Per-chapter terminal checkpoint — displays prose summary + dialogue tree (text) + Critic score + revision notes
- [ ] Chapter contract validation report printed at checkpoint

### Milestone
```
Chapter 1 authored in full:
  ✓ Prose passes Critic rubric (≥75) and contract validation
  ✓ Dialogue tree generated with trait-tagged choices
  ✓ Human reviewed and approved at terminal checkpoint
  ✓ Critic iteration count logged (quality baseline established)
  ✓ Prompt tuning complete for all content agents
```

---

## Phase 4 — Full Pipeline & Export (Pipeline Stage 5)

> **Goal:** Complete end-to-end run from story seed to a valid `game_package/` JSON directory. Terminal only. This is the first fully usable version of the product.

### Rationale
Phase 4 proves the system works at full scale. It also locks the JSON schema — which must be stable before the Designer UI is built to consume it. A technical designer can use this phase's output to begin prototyping a game engine integration immediately.

### Deliverables

- [x] **Scale to all 6 chapters:**
  - Loop through all chapter contracts sequentially
  - Each chapter authors, validates against Critic, tags dialogue, awaits human approval
- [x] **Quest Architect agent**:
  - `pipeline/prompts/quest_architect.yaml`
  - Analyzes completed authored story
  - Identifies MAIN_BLOCKING, LATENT_ADVANTAGE, NEUTRAL, ACHIEVEMENT quests
  - Validates trait gating reachability across the full arc
  - Emits quest graph + attachment point manifest + achievements list
- [x] **Checkpoint 5 (Quest Graph)**:
  - Displays full quest graph in terminal
  - Flags any unreachable BLOCKING quests
  - `[A]pprove / [E]dit / [R]egenerate`
- [x] **Export Agent**:
  - `pipeline/prompts/export_agent.yaml`
  - Assembles all SharedContext into the game package structure
  - Pre-export validation (no dangling IDs, valid schemas, complete dialogue trees)
  - Writes `game_package/` directory with all JSON files (Section 9 format)
- [x] Full `game_package/` output:
  ```
  game_package/
  ├── manifest.json
  ├── world_bible.json
  ├── characters.json
  ├── trait_arc.json
  ├── chapters/
  │   ├── chapter_01.json
  │   └── ...
  ├── side_quests/         ← empty stubs with attachment points
  └── achievements.json
  ```
- [x] Checkpoint 5 terminal reviewer — quest graph review, trait validation warnings, approve → export

### Milestone
```
Full end-to-end run on a real story seed:
  ✓ 6 chapters authored and approved
  ✓ Quest graph mapped and validated
  ✓ Complete game_package/ directory written to disk
  ✓ No schema validation errors
  ✓ Trait arc validation: all BLOCKING quests reachable

A game engine developer can pick up game_package/ and begin integration.
```

---

## Phase 5 — Designer UI

> **Goal:** A visual, node-based desktop tool that wraps the proven backend pipeline. Non-technical designers can use this without touching the terminal.

### Rationale
The UI is built last because it is a consumer of the backend, not a driver. Building it before the JSON schema is stable (Phase 4) means constantly chasing a moving target. By Phase 5, all data structures, API endpoints, and checkpoint payloads are finalized.

### Deliverables

- [x] **React + Vite scaffold** — web & desktop application shell
- [x] **React Flow integration** — base canvas, zoom/pan, minimap, custom controls
- [x] **Custom node components:**
  - `ChapterNode` — contract card (title, scope, entry/exit state badges)
  - `QuestNode` — colour-coded by type (Red / Green / Grey / Gold)
  - `DialogueNodeComponent` — dialogue tree nodes with speaker, text, and trait tags
- [x] **5 Views:**
  - `StoryOverview` — chapter spine as connected cards, React Flow visual DAG
  - `QuestGraph` — quest DAG per chapter; filter main / side / advantage; inspector drawer
  - `DialogueEditor` — full dialogue tree; trait tags colour-highlighted; scene prose preview
  - `TraitArc` — trait progression curve + Chapter 6 convergent climax branch preview
  - `ExportView` — JSON preview panel, pre-export validation checklist, Export button
- [x] **Generation / Checkpoint Panel:**
  - Stage progress indicator
  - Notes field for regeneration feedback
  - `Regenerate with Notes` / `Approve Stage` buttons
- [x] **Zustand store** — syncs UI state with pipeline SharedContext via API
- [x] **FastAPI integration** — FastAPI serves built UI at root with proxy to `/api` endpoints
- [x] Sample data preview support for zero-dependency offline design workflow

### Milestone
```
Full pipeline runs through the visual interface:
  ✓ Designer enters story seed in UI
  ✓ Story arc displayed as editable card — Approve → Chapter contracts appear as nodes
  ✓ Chapter contracts displayed as draggable cards — Approve all → Chapter authoring begins
  ✓ Chapter 1 dialogue tree visible and editable in React Flow node graph
  ✓ Quest graph visible with colour-coded quest nodes
  ✓ Export button produces game_package/ on disk
```

---

## Phase 6 — Hardening & Prompt Tuning

> **Goal:** The system is reliable, documented, and usable by a designer who didn't build it.

- [x] **Error handling and pipeline recovery:**
  - Agent fails mid-chapter → retry logic, fallback to human escalation
  - LLM returns malformed JSON → Pydantic validation + re-prompt
  - SSE connection drops → reconnect with last checkpoint state
- [x] **Prompt tuning** — all 8 agent YAML files versioned, externalized, with parameter configs
- [x] **`.env.example`** — fully documented with all keys, descriptions, and example values
- [x] **README.md** — comprehensive quickstart guide: install, configure, run pipeline CLI, and load visual UI
- [x] **Unity Engine Integration Guide** (`UNITY_INTEGRATION.md`) — C# models, runtime loader, trait tracking
- [x] 24 unit and integration tests passing covering all agents, checkpoints, persistence, and export
- [x] Logging throughout pipeline (stage transitions, Critic scores, iteration counts)

### Milestone
```
A designer unfamiliar with the codebase can:
  ✓ Clone the repo
  ✓ Copy .env.example → .env, fill in API keys
  ✓ Run the pipeline on a story seed
  ✓ Review output in the Designer UI
  ✓ Export a valid game_package/

Without reading any Python source code.
```

---

## Dependency Map

```
Phase 1 — Foundation & Data Models
    │
    ▼
Phase 2 — Story Spine ──────────────── Character Forge runs here (informs Phase 3)
    │
    ▼
Phase 3 — Chapter Loop (1 chapter) ◄── Prompt tuning happens here
    │
    ▼
Phase 4 — Full Pipeline + Export ────── JSON schema locked here ◄── MVP
    │
    ▼
Phase 5 — Designer UI ◄──────────────── Builds against stable Phase 4 schema
    │
    ▼
Phase 6 — Hardening
```

---

## Phase 4 Is the Minimum Viable Product

After Phase 4, QuestForge is a working product. A technical designer with a terminal can:

1. Run the pipeline on any story idea
2. Review and reshape the structure at each checkpoint
3. Receive a complete, valid `game_package/` JSON directory
4. Hand it to a game engine developer for integration

Phases 5 and 6 make it accessible and polished. They are important — but **Phase 4 is where the system becomes real**.

---

*Document version: 1.0 — Phase Development Plan*
*Created: 2026-09-20*
