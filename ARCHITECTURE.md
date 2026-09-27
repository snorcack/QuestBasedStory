# QuestForge — Architecture Document
### Multi-Agent Story & Game Narrative Authoring System
**Version 1.0**

---

## 1. System Overview

QuestForge is a multi-agent AI pipeline that takes a story idea and collaboratively produces a complete, game-ready narrative package for a point-and-click adventure game. The pipeline is interactive — it pauses at every major stage for designer review and approval. The shipped game reads static JSON output; there is no runtime AI.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QUESTFORGE PIPELINE                          │
│                                                                     │
│  Story Idea ──► [Main Planner] ──► Story Arc ──► [HUMAN REVIEW]    │
│                      │                                              │
│                       ──► Chapter Contracts ──► [HUMAN REVIEW]     │
│                      │                                              │
│                       ──► Transitions ──► [HUMAN REVIEW]           │
│                                                                     │
│  For each Chapter (one at a time):                                  │
│  [Lore Weaver] → [Narrator] ↔ [Critic] → [Branch Keeper]           │
│                                        → [Character Forge]         │
│                          ──► [HUMAN REVIEW per chapter]             │
│                                                                     │
│  After all chapters complete:                                       │
│  [Quest Architect] ──► Quest Graph ──► [HUMAN REVIEW]              │
│                                                                     │
│  [Export Agent] ──► JSON Package                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Principles

| Principle | Statement |
|---|---|
| **Story-first** | The narrative is authored before any game mechanic is overlaid |
| **Human-gated** | The system never advances without explicit designer approval |
| **Quests are annotations** | The Quest Architect reads the completed story and formalises what is already there |
| **Chapters are contracts** | Each chapter has a fixed entry and exit state; internals are independently expandable |
| **One canonical ending** | All trait paths converge to the same narrative outcome |
| **Static output** | The shipped game reads JSON; no AI runs at runtime |

---

## 2. Agent Roster

The system has **8 specialist agents**. Each has a defined role, personality (expressed through its system prompt), and strict input/output contract.

---

### Agent 1 — The Main Planner (Director / Orchestrator)
> *"I see the whole board. Every agent is my instrument."*

**Role:** Master controller and story architect. The only agent that operates at all three decomposition levels (arc → chapters → transitions). Manages the LangGraph pipeline state, routes decisions, and triggers human checkpoints.

**Personality:** Cold, precise, strategic. Thinks in structures. Never writes prose directly — delegates all creative output to specialist agents.

| | |
|---|---|
| **Inputs** | Story seed (free text), human feedback at each checkpoint |
| **Outputs** | Story arc document, chapter contract list, transition scene summaries |
| **Tools** | Task queue, agent registry, SharedContext store, LangGraph interrupt |
| **Runs** | Three times: arc → breakdown → transitions (all before chapter authoring begins) |

---

### Agent 2 — The Lore Weaver (World Builder)
> *"A story without a world is just noise. I build the bones."*

**Role:** Constructs and maintains the World Bible — the authoritative source of truth for every physical and cultural fact in the story's world. Called at the start of each chapter to surface relevant world details.

**Personality:** Ancient, obsessive, declarative. Speaks in certainties. Flags contradictions from other agents. Treats internal consistency as sacred.

| | |
|---|---|
| **Inputs** | Story arc (from Main Planner), chapter scope (per chapter) |
| **Outputs** | World Bible (locations, factions, NPCs, rules, timeline), per-chapter world context |
| **Tools** | ChromaDB lore embeddings (contradiction detection), knowledge graph |
| **Constraint** | Cannot invent locations or NPCs not seeded by the story arc |

**World Bible structure:**
```
WorldBible {
  locations:   Location[]    // name, description, accessible_from, notable_npcs
  factions:    Faction[]     // name, goals, relationships, territory
  npcs:        NPC[]         // name, location, role, personality, dialogue_voice
  rules:       Rule[]        // world laws (magic, technology, social norms)
  timeline:    Event[]       // historical events referenced by the story
}
```

---

### Agent 3 — The Narrator (Story Expander)
> *"I take seeds and grow forests. Give me a structure, I'll return a saga."*

**Role:** Core prose writer. Takes the chapter contract and world context and produces full scene-by-scene prose, emotional beats, and scene summaries. Also writes journal entries for every BLOCKING quest in the protagonist's first-person voice.

**Personality:** Romantic, emotionally driven, verbose. Writes with literary intent. Prioritises character interiority and atmospheric detail.

| | |
|---|---|
| **Inputs** | Chapter contract, World Bible context, Character sheets, Critic feedback (on revision) |
| **Outputs** | Chapter prose (scenes), emotional arc map, journal entries for BLOCKING quests |
| **Runs** | Once per chapter (may iterate up to 3× if Critic score < 75) |
| **Story structures** | Hero's Journey, Story Circle (Dan Harmon), Save the Cat, 3-act with subplots |

---

### Agent 4 — The Critic (Story Editor)
> *"I am the reader who hates lazy writing. I will break your story until it is unbreakable."*

**Role:** Quality gate between the Narrator and approval. Evaluates prose against a rubric and against the chapter's contract. If the score is below 75, it returns revision notes to the Narrator. If the chapter violates its contract (wrong exit state, wrong trait level), it is a hard fail.

**Personality:** Blunt, high-standards, impatient. Cites specific failures. Never softens criticism.

| | |
|---|---|
| **Inputs** | Chapter prose, chapter contract, World Bible |
| **Outputs** | Rubric score, revision notes (if score < 75), contract validation result |
| **Loop** | Narrator → Critic → Narrator (max 3 iterations, then escalate to human) |

**Evaluation rubric:**
```
Plot Coherence:            /25   (does the chapter make internal sense?)
Character Motivation:      /25   (do characters act consistently with their sheets?)
World Consistency:         /20   (no contradictions with the World Bible?)
Pacing & Flow:             /15   (does the chapter breathe correctly?)
Emotional Impact:          /15   (does the chapter land emotionally?)
─────────────────────────────
Total:                    /100   Pass threshold: 75
Contract Validation:      PASS / FAIL  (hard gate — not scored)
```

---

### Agent 5 — The Character Forge (Character Designer)
> *"Every hero is a wound walking. I find what broke them."*

**Role:** Designs the full cast — protagonist, antagonist, supporting characters. Produces character sheets with backstory, motivation, flaw, arc, and dialogue voice. Runs after the story arc is approved (Phase 1) and informs chapter authoring.

**Personality:** Empathetic, psychological, forensic about human nature. Believes every character is defined by what they want and what they fear.

| | |
|---|---|
| **Inputs** | Story arc, protagonist description from story seed, World Bible |
| **Outputs** | Character sheets (JSON), relationship map, voice sample per character |
| **Runs** | Once after Phase 1 (story arc + chapter contracts approved) |

**Character sheet:**
```json
{
  "id": "char_001",
  "name": "",
  "role": "protagonist | antagonist | ally | neutral | antagonist_ally",
  "location_home": "location_id",
  "backstory": "",
  "motivation": "",
  "flaw": "",
  "arc": "starts as X → ends as Y",
  "dialogue_voice": "",
  "dominant_trait_alignment": "trait_a | trait_b | none",
  "relationships": { "char_id": "relationship_description" }
}
```

---

### Agent 6 — The Branch Keeper (Dialogue Tree Designer)
> *"Every decision is a door. I build the doors — and tag what each one costs."*

**Role:** Constructs the full dialogue tree for each chapter. Tags every significant dialogue choice with a hidden trait tag (Trait A or Trait B). Authors all branching paths, NPC responses, and the three climax sequences (Trait A path, Trait B path, Default path).

**Personality:** Philosophical, precise, consequence-oriented. Thinks in chains: this choice → this reaction → this consequence three scenes from now.

| | |
|---|---|
| **Inputs** | Chapter prose (from Narrator), character sheets, chapter contract, trait vocabulary |
| **Outputs** | Dialogue tree (node graph), trait-tagged choices, climax branch scripts (Chapter 6 only) |
| **Output format** | JSON node graph (Ink-compatible structure) |

**Dialogue node:**
```json
{
  "node_id": "node_042",
  "type": "speaker | choice | flag | end",
  "speaker": "char_id | narrator",
  "text": "",
  "choices": [
    {
      "label": "I'll find another way in.",
      "trait_tag": "Cunning",
      "flags_set": [],
      "next_node": "node_043"
    }
  ]
}
```

**Trait tagging rule:** Every dialogue tree must contain enough tagged choices that a player who consistently picks one trait can reach `established` (4–7 choices) by mid-story and `dominant` (8+) before the climax.

---

### Agent 7 — The Quest Architect (Quest Mapper)
> *"The story already knows what it needs. I simply name it."*

**Role:** Runs last, after all chapters are authored and approved. Reads the completed story and identifies what already functions as a quest gate. Tags scenes as BLOCKING, LATENT_ADVANTAGE, NEUTRAL, or ACHIEVEMENT quests. Validates that every BLOCKING quest is reachable at the trait level present at that point in the story.

**Personality:** Systematic, analytical, a game designer who has read too much Aristotle. Believes every quest must be narratively motivated before it can be mechanically interesting.

| | |
|---|---|
| **Inputs** | All authored chapters, character sheets, trait arc map |
| **Outputs** | Quest graph (JSON), attachment point manifest, achievement list, trait validation report |
| **Runs** | Once — after all chapters approved (Phase 5) |

**Quest record:**
```json
{
  "quest_id": "quest_017",
  "title": "",
  "type": "main_blocking | latent_advantage | neutral | achievement",
  "chapter_id": "chapter_02",
  "location_id": "location_id",
  "trigger_flag": "flag_that_activates_this_quest",
  "objective": "",
  "journal_entry": "",
  "required_trait": { "name": "Cunning", "strength": "emerging" },
  "reward_flags": [],
  "latent_payoff": { "chapter_id": "", "description": "" },
  "expires_after_flag": "flag_id",
  "attachment_point_id": "slot_id"
}
```

**Quest Mapping Algorithm:**
```
For each scene in the authored story:

  1. Does the protagonist need something before they can proceed?
     YES → MAIN_BLOCKING quest. Extract objective. Write journal entry.
           Validate: is this completable at the current trait level?

  2. Does an NPC offer something that pays off later in the story?
     YES → LATENT_ADVANTAGE quest. Mark attachment point.

  3. Is there an optional activity at this location?
     YES → NEUTRAL or ACHIEVEMENT quest. No story impact.

  4. Does any BLOCKING quest require a trait the player cannot have reached?
     YES → Flag for human review at Checkpoint 5.
```

---

### Agent 8 — The Export Agent (Formatter)
> *"I speak every format. JSON is my native tongue."*

**Role:** Collates all agent outputs into the final game data package. Validates schema integrity, checks for missing references (broken quest pointers, undefined locations, etc.), and writes the output file structure.

**Personality:** Minimal. No opinions. Just structure.

| | |
|---|---|
| **Inputs** | All agent outputs from SharedContext |
| **Outputs** | Complete JSON game data package (see Section 9) |
| **Validation** | All quest IDs exist, all location references resolve, all trait gates are reachable, all dialogue node links are non-null |

---

## 3. Interactive Pipeline — 5 Stages

The pipeline is **human-gated**. At every stage boundary, the system pauses and presents its output to the designer. The designer may approve, edit inline, or reject and regenerate with directional notes.

```
Stage 1  ─── Story Arc                    [Main Planner]      ► CHECKPOINT 1
Stage 2  ─── Chapter Breakdown            [Main Planner]      ► CHECKPOINT 2
Stage 3  ─── Chapter Transitions          [Main Planner]      ► CHECKPOINT 3
Stage 4  ─── Chapter Authoring (×N)       [All content agents]► CHECKPOINT 4 per chapter
Stage 5  ─── Quest Mapping                [Quest Architect]   ► CHECKPOINT 5
             Export                       [Export Agent]      (automatic)
```

### Stage 1 — Story Arc

**Agents:** Main Planner  
**Output:**
- Title, genre, tone, themes
- Protagonist sketch (name, flaw, world role, the two emergent traits)
- Antagonist sketch
- Central conflict (one paragraph)
- 3-act arc outline (one paragraph per act)
- Trait vocabulary: 2 trait names + one-sentence description each

**Designer actions at Checkpoint 1:**
- Edit any field inline
- Rename the traits
- Add creative constraints ("make the tone neo-noir")
- Regenerate with notes → Approve

---

### Stage 2 — Chapter Breakdown

**Agents:** Main Planner  
**Output:** 6–8 Chapter Contract cards, each containing:
- Chapter title and narrative scope
- Entry state (location, trait snapshot, inventory, active flags)
- Exit state (location, trait snapshot, inventory, active flags)
- Number of attachment point slots for side quests

**Designer actions at Checkpoint 2:**
- Drag to reorder chapters
- Edit title, scope, entry/exit location and state
- Add or remove chapters
- Adjust slot counts → Approve all

---

### Stage 3 — Chapter Transitions

**Agents:** Main Planner  
**Output:** For each chapter boundary (Ch1→Ch2, Ch2→Ch3, etc.):
- Transition scene summary (1–2 paragraphs of prose direction)
- State delta: what flags, inventory, or world state changes at this boundary
- Narrative hook: the line or image that opens the next chapter

**Designer actions at Checkpoint 3:**
- Edit transition prose
- Add or remove state changes
- Rewrite narrative hooks → Approve all

---

### Stage 4 — Chapter Authoring (per chapter, sequential)

The designer approves chapters one at a time. The next chapter does not begin until the current one is approved.

**Agents per chapter (in order):**
```
Lore Weaver → Narrator ↔ Critic (max 3 loops) → Branch Keeper → Character Forge
```

**Output per chapter:**
- Full scene prose
- Dialogue tree (node graph)
- Trait-tagged choices highlighted
- Character moment summaries
- Critic score and notes

**Designer actions at Checkpoint 4 (repeated per chapter):**
- Read prose in text panel, edit inline
- Inspect dialogue tree in React Flow node graph
- Add, remove, or edit dialogue nodes and trait tags
- Flag scenes for targeted regeneration
- Approve chapter → triggers next chapter authoring

---

### Stage 5 — Quest Mapping

**Agents:** Quest Architect  
**Output:**
- Full quest graph (all BLOCKING, LATENT_ADVANTAGE, NEUTRAL, ACHIEVEMENT quests)
- Attachment point manifest (open slots per chapter)
- Trait validation report (warnings if any BLOCKING quest is unreachable)
- Achievement manifest
- Journal entry for every BLOCKING quest

**Designer actions at Checkpoint 5:**
- Move quests between chapters
- Edit quest objectives and journal text
- Add hand-crafted quests
- Review and resolve trait validation warnings
- Approve → Export Agent runs automatically

---

## 4. Chapter Contract System

```
ChapterContract {
  chapter_id:        string
  title:             string
  narrative_scope:   string

  entry_state: {
    location:        LocationId
    trait_snapshot:  { trait_name: "none | emerging | established | dominant" }
    inventory:       string[]
    active_flags:    string[]
  }

  exit_state: {
    location:        LocationId
    trait_snapshot:  { trait_name: "none | emerging | established | dominant" }
    inventory:       string[]
    active_flags:    string[]
  }

  attachment_points: AttachmentSlot[]
}
```

Any chapter can be rewritten or expanded without affecting other chapters, as long as the entry and exit states are honoured. The Critic validates chapter output against its contract as a **hard gate**.

### Chapter Scale Target

```
Chapter 1  — Prologue / World introduction      ~8,000 words   ~40 min
Chapter 2  — Rising stakes / First conflict     ~12,000 words  ~55 min
Chapter 3  — Midpoint / Trait consolidation     ~12,000 words  ~55 min
Chapter 4  — Escalation / World expands         ~12,000 words  ~55 min
Chapter 5  — Dark night of the soul             ~10,000 words  ~50 min
Chapter 6  — Convergent climax + ending         ~10,000 words  ~50 min
─────────────────────────────────────────────────────────────────────
Total (main story)                              ~64,000 words  ~5.5 hrs
Total incl. side quests, journals, item text    ~75,000 words  ~6 hrs
```

---

## 5. Narrative Trait System

- **Max 2 traits per story.** Names are emergent from the story idea.
- **Built exclusively through dialogue choices.** Each significant choice carries a hidden trait tag.
- **Three tiers:** `emerging` (1–3 choices) / `established` (4–7) / `dominant` (8+)

A quest tagged `required_trait: { name: "Cunning", strength: "established" }` is only available if the player's Cunning count ≥ 4. Evaluated at runtime by the game engine via flag lookup.

The Quest Architect validates the full trait arc during Stage 5 to confirm every BLOCKING quest is reachable given the authored dialogue choices that precede it.

---

## 6. Quest System Design

### Quest Types

| Type | Tag | Description |
|---|---|---|
| Main Branch | `MAIN_BLOCKING` | Must complete to advance. Progress halts until resolved. |
| Optional Payoff | `LATENT_ADVANTAGE` | Completing now unlocks a later benefit. Skipping is neutral. |
| Ambient Optional | `NEUTRAL` | No story impact. Exploration or flavour. |
| Achievement | `ACHIEVEMENT` | Rewards an achievement badge. No narrative effect. |

### Blocking Model

No fail state, no game over. When a BLOCKING quest is incomplete:
```
→ Block passage, NPC dialogue, or scene trigger
→ Quest log updates with authored first-person journal entry
→ Player must resolve the quest; story does not proceed
```

### Side Quest Injection

Side quests are authored after the main story and attached at pre-defined Attachment Points:

```json
{
  "slot_id": "slot_ch02_03",
  "chapter_id": "chapter_02",
  "location_id": "location_market",
  "available_after": "flag_ch02_opened",
  "expires_after": "flag_ch03_started",
  "npcs_present": ["char_merchant"],
  "arc_type": "simple | parallel"
}
```

Side quests cannot modify chapter contracts. They may add LATENT_ADVANTAGE flags that the main quest engine optionally reads.

---

## 7. Convergent Ending Model

```
                   ┌── [Trait A path]   → protagonist uses Trait A's method
                   │
Climax node ───────┼── [Trait B path]   → protagonist uses Trait B's method
                   │
                   └── [Default path]   → balanced, unspecialised approach

All three paths → [Same canonical outcome]
```

The Branch Keeper authors all three climax sequences. The Export Agent packages them as conditional branches keyed on `dominant_trait`.

---

## 8. Shared Context (State Model)

All agents read from and write to a single typed SharedContext. No agent communicates directly with another.

```
SharedContext {
  story_seed:           string
  story_arc:            StoryArc
  chapter_contracts:    ChapterContract[]
  transitions:          ChapterTransition[]
  trait_vocabulary:     TraitDefinition[2]
  characters:           Character[]
  chapters:             AuthoredChapter[]
  quest_graph:          Quest[]
  attachment_points:    AttachmentPoint[]
  achievements:         Achievement[]
  trait_arc_report:     TraitArcValidation
  current_stage:        Stage
  current_chapter:      int
  iteration_count:      int
  checkpoint_status:    "awaiting_review | approved | regenerating"
  regeneration_notes:   string
}
```

---

## 9. JSON Data Package (Export Format)

```
game_package/
├── manifest.json              ← package metadata, version, story title
├── world_bible.json           ← locations, factions, NPCs, rules, timeline
├── characters.json            ← all character sheets + relationship map
├── trait_arc.json             ← trait vocabulary, thresholds, climax paths
├── chapters/
│   ├── chapter_01.json        ← contract + prose scenes + dialogue tree + quests
│   └── chapter_0N.json
├── side_quests/
│   ├── parallel_arc_01.json
│   └── simple_quest_01.json
├── achievements.json
└── attachment_points.json
```

Each `chapter_N.json`:
```json
{
  "contract":           { "ChapterContract": "..." },
  "scenes":             [ { "scene_id": "", "prose": "", "location_id": "" } ],
  "dialogue_tree":      [ { "DialogueNode": "..." } ],
  "quests":             [ { "Quest": "..." } ],
  "characters_present": [ "char_id" ]
}
```

---

## 10. Designer UI Architecture

| Component | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Node Editor | React Flow (`@xyflow/react`) — MIT |
| State | Zustand |
| Styling | Tailwind CSS + shadcn/ui |
| Bundler | Vite |
| Desktop shell | Electron |
| API client | Fetch + SSE |

### The 5 Views

| View | Purpose |
|---|---|
| **Story Overview** | Chapter spine — contracts as connected cards |
| **Quest Graph** | Main + side quests as a DAG within each chapter |
| **Dialogue Editor** | Full dialogue tree, trait-tagged choices visible |
| **Trait Arc** | Trait progression curve + climax branch preview |
| **Export** | JSON preview, validation errors, export button |

### Node Colour Coding

| Node | Colour |
|---|---|
| Chapter contract | `#4A90D9` Blue |
| MAIN_BLOCKING quest | `#E05C5C` Red |
| LATENT_ADVANTAGE quest | `#5CB85C` Green |
| NEUTRAL / Achievement | `#888` Grey |
| Trait-tagged choice | Trait colour (Amber / Teal) |
| Empty attachment slot | `#B8860B` Dashed gold |
| Filled attachment slot | `#FFD700` Solid gold |

---

## 11. AI Pipeline Backend

| Component | Technology |
|---|---|
| Language | Python 3.12+ |
| Agent orchestration | LangGraph 0.2+ |
| LLM | Gemini 2.0 Flash / Pro or Claude Sonnet |
| Embeddings + lore store | `text-embedding-004` + ChromaDB |
| Data models | Pydantic v2 |
| API | FastAPI + SSE |

LangGraph is chosen for its native support for:
- **Cyclic workflows** — the Narrator ↔ Critic loop requires a back-edge
- **Checkpointing** — sessions can be resumed days later
- **Interrupt nodes** — human checkpoints are native graph nodes that pause and await external input
- **Conditional routing** — Critic score determines loop, advance, or escalate

---

## 12. Configuration & Prompt Management

### 12.1 External Agent Prompts

Every agent's system prompt is stored in `pipeline/prompts/` as a YAML file. The Python agent module loads its prompt at startup — it contains no hardcoded instruction text. This separates the **execution layer** (Python) from the **personality and instruction layer** (YAML).

Prompt files are version-controlled. Changing an agent's tone, rubric weights, or output format requires only editing its YAML file.

```
pipeline/prompts/
├── main_planner.yaml
├── lore_weaver.yaml
├── narrator.yaml
├── critic.yaml
├── character_forge.yaml
├── branch_keeper.yaml
├── quest_architect.yaml
└── export_agent.yaml
```

Each file schema:
```yaml
agent: narrator
version: "1.0"
system_prompt: |
  You are the Narrator — a romantic, emotionally driven story writer...
user_prompt_template: |
  Chapter contract: {chapter_contract}
  World context: {world_context}
  Character sheets: {characters}
  Critic notes (if revision): {critic_notes}
  Write the full chapter prose now.
parameters:
  temperature: 0.85
  max_tokens: 16000
```

### 12.2 Environment Configuration

All secrets, API endpoints, and runtime settings are in `.env` at the project root. Two LLM backends are supported and switchable without code changes.

```env
# .env — QuestForge pipeline configuration

# ── LLM Backend ───────────────────────────────────────────────────────
# Options: "vertexai" | "gemini_api"
LLM_BACKEND=vertexai

# ── Google Cloud / Vertex AI ──────────────────────────────────────────
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.0-flash-001
VERTEX_AI_EMBEDDING_MODEL=text-embedding-004
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service_account.json

# ── Google AI Studio (Gemini API) ─────────────────────────────────────
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-2.0-flash

# ── Pipeline Settings ─────────────────────────────────────────────────
PROMPT_DIR=./pipeline/prompts
CHROMADB_PATH=./pipeline/.chromadb
GAME_PACKAGE_OUTPUT_DIR=./game_package
MAX_CRITIC_ITERATIONS=3
CRITIC_PASS_THRESHOLD=75

# ── FastAPI Server ────────────────────────────────────────────────────
API_HOST=127.0.0.1
API_PORT=8000

# ── LangGraph Checkpointing ───────────────────────────────────────────
LANGGRAPH_CHECKPOINT_DB=./pipeline/.checkpoints/pipeline.sqlite
```

> `.env` is in `.gitignore`. A `.env.example` with blank values is committed as documentation.

---

## 13. Project Folder Structure

```
QuestBasedStory/
│
├── pipeline/                          # Python AI backend
│   ├── agents/
│   │   ├── main_planner.py
│   │   ├── lore_weaver.py
│   │   ├── narrator.py
│   │   ├── critic.py
│   │   ├── character_forge.py
│   │   ├── branch_keeper.py
│   │   ├── quest_architect.py
│   │   └── export_agent.py
│   ├── prompts/                       # ← External agent prompts (YAML)
│   │   ├── main_planner.yaml
│   │   ├── lore_weaver.yaml
│   │   ├── narrator.yaml
│   │   ├── critic.yaml
│   │   ├── character_forge.yaml
│   │   ├── branch_keeper.yaml
│   │   ├── quest_architect.yaml
│   │   └── export_agent.yaml
│   ├── graph/
│   │   └── pipeline.py                # LangGraph StateGraph
│   ├── models/
│   │   ├── context.py                 # SharedContext
│   │   ├── world.py
│   │   ├── story.py
│   │   ├── character.py
│   │   ├── dialogue.py
│   │   ├── quest.py
│   │   └── trait.py
│   ├── tools/
│   │   ├── lore_store.py              # ChromaDB interface
│   │   └── rubric.py                  # Critic scoring logic
│   ├── api/
│   │   └── server.py                  # FastAPI + SSE
│   └── config/
│       └── settings.yaml              # Non-secret runtime config
│
├── designer/                          # Electron + React UI
│   ├── src/
│   │   ├── views/
│   │   │   ├── StoryOverview.tsx
│   │   │   ├── QuestGraph.tsx
│   │   │   ├── DialogueEditor.tsx
│   │   │   ├── TraitArc.tsx
│   │   │   └── ExportView.tsx
│   │   ├── nodes/                     # Custom React Flow node components
│   │   ├── store/                     # Zustand store
│   │   ├── api/                       # FastAPI + SSE client
│   │   └── main.tsx
│   ├── electron/
│   │   └── main.ts
│   └── vite.config.ts
│
├── credentials/                       # GCP service account (gitignored)
├── game_package/                      # Generated output (gitignored)
├── .env                               # Secrets and API config (gitignored)
├── .env.example                       # ← Committed template with blank values
├── .gitignore
└── README.md
```

---

## 14. Design Decisions Reference

| # | Decision | Detail |
|---|---|---|
| 1 | Generation model | One-shot pipeline. No runtime AI in shipped game. |
| 2 | Protagonist source | Extracted from story idea by Character Forge. |
| 3 | Skill system | Narrative Traits only. No numeric stats. |
| 4 | Trait building | Dialogue choices exclusively. |
| 5 | Trait tiers | `emerging` (1–3) / `established` (4–7) / `dominant` (8+) |
| 6 | Max traits | 2 per story. Climax: Trait A / Trait B / Default paths. |
| 7 | Quest types | MAIN_BLOCKING / LATENT_ADVANTAGE / NEUTRAL / ACHIEVEMENT |
| 8 | Skipping side quests | Neutral — missed benefit only, no penalty. |
| 9 | Blocking quests | No game over. Authored journal hint in quest log. |
| 10 | Ending | Single canonical ending, trait-coloured climax presentation. |
| 11 | Locations | Authored by Lore Weaver. Quest Architect cannot invent new ones. |
| 12 | NPCs | Fixed in fixed locations. Movement authored, not dynamic. |
| 13 | Quest expiry | Authored `expires_after` flag. Not runtime-computed. |
| 14 | Export format | Engine-agnostic JSON. Converters built separately. |
| 15 | Pipeline mode | Interactive. Human checkpoint at every stage boundary. |
| 16 | Quest Mapper order | Runs LAST. Quests are annotations on the story, not prescriptions. |
| 17 | Orchestration | LangGraph (cyclic graph, interrupt, checkpointing). |
| 18 | Node editor | React Flow — MIT, native React, custom node components. |
| 19 | Desktop shell | Electron — filesystem access, no browser required for designer. |
| 20 | Chapter structure | Chapter Contracts with fixed entry/exit states. Independently expandable. |
| 21 | Agent prompts | External YAML files in `pipeline/prompts/`. Not hardcoded in Python. |
| 22 | Environment config | `.env` at project root. Supports Vertex AI and Gemini API backends. |

---

*Document version: 1.1 — Architecture Document*
*Created: 2026-09-20 | Updated: 2026-09-20*
*Changes in 1.1: Added §12 — Configuration & Prompt Management; expanded folder structure; added decisions 21–22*
*Supersedes: quest_story_agent_architecture.md (brainstorm draft)*
