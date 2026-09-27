# QuestForge — Design Document
### Problem Statement, Goals & Principles
**Version 1.0**

---

## 1. The Problem

### 1.1 Writing a Playable Story Is a Different Discipline Than Writing a Story

A novelist writes linearly. A game designer does not. A 5–6 hour point-and-click adventure game requires a writer to simultaneously hold in mind:

- A **narrative spine** — a story that makes emotional sense from beginning to end
- A **quest graph** — a structured set of gates, objectives, and rewards that give the player agency and direction
- A **dialogue tree** — hundreds of branching conversations where player choices shape character identity
- A **world state machine** — a set of flags, inventory items, and location conditions that must be consistent at every point in the story
- A **character arc system** — protagonist traits that evolve through choices and unlock narrative possibilities

These are five interlocking systems. Getting one wrong cascades into the others. Writing them together by hand is extraordinarily time-consuming and error-prone, even for experienced designers. For independent creators or small studios, it is often the bottleneck that prevents good story ideas from ever becoming games.

### 1.2 Existing Tools Address Only One Layer at a Time

| Tool | What It Does Well | What It Misses |
|---|---|---|
| **Twine** | Hypertext branching narrative | No quest structure, no world state management |
| **Ink / Inkle** | Dialogue scripting | No story authoring, designer must write all prose |
| **Articy:Draft** | Dialogue + flow graphs | Commercial, complex, no AI authoring |
| **ChatGPT / Claude (raw)** | Story prose generation | No structure, no game-awareness, no consistency enforcement |
| **Yarn Spinner** | Dialogue runtime | No authoring tool, no story generation |

No existing tool takes a **story idea as input** and produces a structured, game-ready narrative package as output — with the designer remaining in creative control throughout.

### 1.3 The Core Tension: Automation vs. Creative Control

Fully automated story generation produces content that feels generic and disconnected from the designer's vision. Fully manual authoring is too slow. The right solution is a **collaborative system** — one where AI generates, structures, and validates content at each stage, and the human designer reviews, redirects, and approves before the system proceeds.

This is not an AI that replaces the designer. It is an AI that acts as a team of specialists the designer directs.

---

## 2. The Vision

**QuestForge** is an AI-powered, designer-facing authoring system that takes a story idea and collaboratively produces a complete, game-ready narrative package for a point-and-click adventure game.

The designer provides a story seed — a premise, a protagonist, a world. The system expands it into a full narrative with chapters, quests, dialogue trees, and character arcs. At every stage, the designer reviews and approves the output before the system continues. The final deliverable is a structured JSON package that any game engine can consume.

> The story is always authored first. The quests are derived from it — not the other way around.

---

## 3. Target Users

### Primary: Independent Game Designers
- Small studios (1–5 people) building narrative-driven games
- Writers who want to make games but lack the technical architecture knowledge
- Game designers who have story ideas but find the authoring process overwhelming

### Secondary: Game Writers in Larger Studios
- Narrative leads who want to use AI for rapid prototyping of story structures
- Designers who want a visual tool to review and manage complex dialogue graphs

### Not the Target
- Players (this is a designer tool, not a game)
- Non-narrative game genres (action, puzzle, simulation)

---

## 4. Design Goals

### Goal 1: Story-First
The narrative spine is always authored before any game mechanic is overlaid. Quests, traits, and dialogue gates must be grounded in the story — not invented independently and stitched in later.

### Goal 2: Human Checkpoints at Every Stage
The system never proceeds to the next authoring stage without explicit designer approval. At each checkpoint, the designer can: approve, edit inline, or reject and regenerate with directional notes.

### Goal 3: Chapter-Level Modularity
The story is divided into chapters with fixed boundary contracts (entry state → exit state). Each chapter is independently expandable without affecting the rest of the story, as long as it honours its contract.

### Goal 4: Narrative Traits Over Numeric Stats
The protagonist's identity evolves through dialogue choices. There are no numeric stats — only narrative traits (e.g., "Cunning", "Loyal") that accumulate through the choices a player makes. These traits gate quest availability and shape the climax.

### Goal 5: Single Canonical Ending, Trait-Coloured Presentation
The story has one ending. Depending on the player's dominant trait, the path to that ending differs in method and dialogue — but the outcome is the same. This preserves authorial intent while rewarding player expression.

### Goal 6: Quests as Story Annotations
The Quest Mapper runs last, reading the completed story and identifying what already functions as a quest gate. It formalises the story's natural structure into game mechanics — it does not invent quests independently.

### Goal 7: Engine-Agnostic Output
The system exports a structured JSON package. Any game engine can read it. Converter layers for Unity, Ink, Twine, or other targets are separate tools built on top of this canonical format.

### Goal 8: Designer-Facing Visual Tool
The authoring process is managed through a node-based desktop application. The designer sees the full story structure — chapters, quest graphs, dialogue trees, trait arcs — as interconnected visual graphs, not raw text files.

---

## 5. Operational Design Decisions

### 5.1 Agent Prompts Are Externally Managed

Every agent's system prompt is stored in a dedicated external file — not hardcoded into the agent's Python module. This is a deliberate design decision:

- **Prompts live in `pipeline/prompts/`**, one YAML file per agent (e.g., `narrator.yaml`, `critic.yaml`)
- Agents load their prompt at startup from this directory
- A designer or prompt engineer can tune agent behaviour — tone, verbosity, evaluation rubric weights, personality — without touching Python code
- The prompt file is the **personality and instruction layer**; the Python module is the **execution and I/O layer**
- Prompt files are version-controlled alongside the codebase so changes are tracked

Each prompt file follows a consistent structure:

```yaml
# pipeline/prompts/narrator.yaml
agent: narrator
version: "1.0"
system_prompt: |
  You are the Narrator — a romantic, emotionally driven story writer...
  [full system prompt here]
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

### 5.2 Environment Configuration via `.env`

All API keys, service endpoints, and model selections are managed through a `.env` file at the project root. The system supports both **Google Cloud / Vertex AI** and direct **Google AI Studio (Gemini API)** as LLM backends, switchable via config.

```env
# .env — QuestForge pipeline configuration

# ── LLM Backend ──────────────────────────────────────────────
# Set to "vertexai" or "gemini_api"
LLM_BACKEND=vertexai

# ── Google Cloud / Vertex AI ─────────────────────────────────
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.0-flash-001
VERTEX_AI_EMBEDDING_MODEL=text-embedding-004
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service_account.json

# ── Google AI Studio (Gemini API) ────────────────────────────
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-2.0-flash

# ── Pipeline Settings ─────────────────────────────────────────
PROMPT_DIR=./pipeline/prompts
CHROMADB_PATH=./pipeline/.chromadb
GAME_PACKAGE_OUTPUT_DIR=./game_package
MAX_CRITIC_ITERATIONS=3
CRITIC_PASS_THRESHOLD=75

# ── FastAPI Server ────────────────────────────────────────────
API_HOST=127.0.0.1
API_PORT=8000

# ── LangGraph Checkpointing ───────────────────────────────────
LANGGRAPH_CHECKPOINT_DB=./pipeline/.checkpoints/pipeline.sqlite
```

The `.env` file is **never committed to version control** (`.gitignore` enforced). A `.env.example` with blank values and comments is committed instead as documentation.

---

## 6. Key Constraints

| Constraint | Rationale |
|---|---|
| **Max 2 narrative traits per story** | Keeps the climax branching manageable (3 paths: Trait A, Trait B, Default). More traits create combinatorial complexity. |
| **Traits built only through dialogue choices** | Keeps the trait system simple and authored. No hidden skill checks, no inventory-based progression. |
| **Locations and NPCs are authored, not dynamic** | The world is fixed by the Lore Weaver. The Quest Architect cannot invent new locations. This enforces world consistency. |
| **No fail state, no game over** | This is a point-and-click adventure. Progress is gated (BLOCKING quests) but never permanently ended. |
| **Skipping side quests is neutral** | Missing an optional quest means missing the benefit — not gaining a penalty. Players are not punished for exploration gaps. |
| **Quest Mapper runs last** | The story is the source of truth. Quests are derived from the story, never imposed on it. |
| **One-shot pipeline** | The system runs once to author the complete game. There is no runtime AI in the shipped game. |
| **Static game output** | The shipped game reads static JSON data. All AI computation happens during the authoring phase. |

---

## 7. The Game Format This System Targets

**Genre:** Point-and-click adventure  
**Target playtime:** 5–6 hours  
**Story length:** ~300 pages / ~75,000 words  
**Chapter count:** 6–8 chapters  
**Ending structure:** Single canonical ending with 3 trait-coloured climax paths  
**Dialogue:** Node-based branching trees with trait-tagged choices  
**Platform:** Desktop (Unity primary target, engine-agnostic JSON output)  

---

## 8. What Makes This System Different

### It is collaborative, not autonomous
Most AI writing tools generate content and hand it over. QuestForge generates content and waits. The designer is in the loop at every stage — the system never proceeds without approval.

### It maintains structural integrity across all layers
World, story, characters, quests, and dialogue are all generated by different specialist agents but share a single source of truth (the SharedContext). Contradictions are caught by the Critic and Lore Weaver's consistency checks before they propagate.

### The quest system is derived, not prescribed
Most game narrative tools ask the designer to build quests and then write story around them. QuestForge reverses this: the story is written first, and the quest structure is extracted from it. This ensures quests always feel narratively motivated.

### Chapters are independently expandable
Once the chapter contracts are approved, each chapter can be rewritten, expanded, or handed to a different writer without destabilising the full story. The contract (entry state → exit state) is the interface. The internals are free.

---

## 9. Success Criteria

The system is successful when a designer can:

1. Enter a story idea (a few sentences) and receive a complete 6-chapter story structure within a session
2. Review and reshape the structure at each stage using the visual designer tool
3. Receive a fully authored narrative — prose, dialogue trees, character sheets, quest graph — as a JSON package
4. Load that package into a game engine and have a playable prototype without writing any additional narrative content
5. Return later to expand individual chapters or add side quest arcs without re-running the full pipeline

---

## 10. Out of Scope (v1.0)

- **Multiplayer or co-op narrative** — single player only
- **Combat systems** — this is a narrative / exploration game
- **Voice acting scripts** — text-only output in v1.0
- **Procedural level generation** — locations are authored, not generated at runtime
- **Real-time AI in the shipped game** — all AI runs during the authoring phase only
- **Multiple simultaneous playable characters** — single protagonist
- **Multiple endings** — one canonical ending (trait-coloured presentation only)

---

*Document version: 1.1 — QuestForge Design Document*
*Created: 2026-09-20 | Updated: 2026-09-20*
*Changes in 1.1: Added §5 — Operational Design Decisions (external prompt files, .env config)*
