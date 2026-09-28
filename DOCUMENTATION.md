# QuestForge: Comprehensive User & System Documentation

**QuestForge** is an interactive multi-agent story and narrative authoring workstation specifically engineered for narrative-driven point-and-click adventure games, interactive fiction, and visual novels. It transforms a high-level creative prompt (a "Story Seed") into a production-ready, chapter-by-chapter narrative architecture complete with branching dialogue trees, psychological trait tracking, quest annotation, and exported game packages.

> [!IMPORTANT]
> **Zero Runtime AI Requirement**: QuestForge acts as an authoring workstation (an "AI IDE"). The shipped game reads static, schema-validated JSON data packages or self-contained Twine HTML files. **No AI model or external API runs at game runtime.**

---

## Table of Contents

1. [System Architecture & The 8 Specialist Agents](#1-system-architecture--the-8-specialist-agents)
2. [Installation & Setup](#2-installation--setup)
3. [Launching QuestForge](#3-launching-questforge)
4. [Multi-Story Project Workspace](#4-multi-story-project-workspace)
5. [The 5 Human-in-the-Loop Checkpoint Gates](#5-the-5-human-in-the-loop-checkpoint-gates)
6. [In-Depth Guide to the 8 Designer Tabs](#6-in-depth-guide-to-the-8-designer-tabs)
   - [Tab 1: Story Overview](#tab-1-story-overview)
   - [Tab 2: Dialogue Editor](#tab-2-dialogue-editor)
   - [Tab 3: Quest Graph](#tab-3-quest-graph)
   - [Tab 4: Trait Arc](#tab-4-trait-arc)
   - [Tab 5: Cast & World](#tab-5-cast--world)
   - [Tab 6: Export & Packages](#tab-6-export--packages)
   - [Tab 7: Debug & Diagnostics](#tab-7-debug--diagnostics)
   - [Tab 8: Play Novel (Interactive Playtester)](#tab-8-play-novel-interactive-playtester)
7. [Global Tools & Keyboard Shortcuts](#7-global-tools--keyboard-shortcuts)
8. [Export Targets: Unity & Twine](#8-export-targets-unity--twine)
9. [Pro Tips, Best Practices & Suggestions](#9-pro-tips-best-practices--suggestions)

---

## 1. System Architecture & The 8 Specialist Agents

QuestForge uses a coordinated StateGraph pipeline orchestrated via LangGraph. Eight specialist agents collaborate sequentially under the strict oversight of the human Director:

```
Story Idea / Seed
    │
    ▼
[Main Planner] ──► Story Arc, Chapter Contracts, Transitions (Human Checkpoints 1–3)
    │
    ▼
Per-Chapter Authoring Loop (Sequential):
[Lore Weaver] ──► [Narrator] ◄──► [Critic] ──► [Branch Keeper] ──► [Character Forge]
                  (Checkpoint 4 per chapter)
    │
    ▼
[Quest Architect] ──► Quest DAG, Attachment Points, Trait Gates (Checkpoint 5)
    │
    ▼
[Export Agent] ──► Static JSON Game Package + Twine Standalone Reader
```

### The 8 Specialist Agents

| Agent | Responsibility | Output Artifact |
|---|---|---|
| **Main Planner** | Director & Story Architect. Decomposes story seeds into 3 acts, chapter contracts, and inter-chapter transitions. | `StoryArc`, `ChapterContract[]`, `SceneTransition[]` |
| **Lore Weaver** | World Builder. Synthesizes locations, societal rules, factions, and historical timeline. Embeds facts into ChromaDB for vector-similarity contradiction checks. | `WorldBible` (`locations`, `rules`, `factions`, `timeline`) |
| **Narrator** | Core Prose Writer. Produces sensory scene prose, emotional beats, narrative hooks, and blocking quest journal logs. | `AuthoredChapter.scenes[]` |
| **Critic** | Rigorous Story Editor. Scores authored chapters against a 100-point rubric with a hard gate (minimum score 75) and validates entry/exit state flag contracts. | `CriticReview` (scores, violations, feedback) |
| **Character Forge** | Psychological Cast Designer. Authors character dossiers, deep motivations, internal flaws, and dynamic relationship networks. | `Character[]`, `NPC[]` |
| **Branch Keeper** | Interactive Tree Architect. Converts narrative climaxes into branching dialogue nodes with trait tags and conditional reachability. | `DialogueNode[]`, `DialogueChoice[]` |
| **Quest Architect** | Game Narrative Mapper. Identifies BLOCKING, ADVANTAGE, and ACHIEVEMENT quests and verifies trait reachability. | `Quest[]`, `Achievement[]` |
| **Export Agent** | Formatter & Validator. Conducts referential integrity audits and builds production game packages. | `manifest.json`, `game_package/`, Twine HTML |

---

## 2. Installation & Setup

### Prerequisites
- **Python**: Version 3.10, 3.11, or 3.12 (Python 3.12 recommended).
- **Node.js & npm**: Node.js LTS (v18 or higher).
- **OS**: Windows, macOS, or Linux (Windows provides 1-click batch scripts).

---

### Windows (One-Click Installation)

Simply double-click [`install.bat`](file:///k:/AI/QuestBasedStory/install.bat) or run in Command Prompt:

```cmd
install.bat
```

**What `install.bat` does automatically:**
1. Validates `python`, `node`, and `npm` availability in `PATH`.
2. Detects any active environment or creates and activates a dedicated virtual environment (`.venv`).
3. Installs and upgrades all dependencies from [`requirements.txt`](file:///k:/AI/QuestBasedStory/requirements.txt).
4. Safely initializes `.env` from `.env.example` if not already present.
5. Installs frontend dependencies in `designer/` and compiles the visual designer bundle into `designer/dist/`.

---

### Manual / Cross-Platform Installation

```bash
# 1. Clone repository and navigate inside
cd QuestBasedStory

# 2. Setup Python environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 3. Install Python requirements
pip install --upgrade pip
pip install -r requirements.txt

# 4. Initialize environment configuration
cp .env.example .env

# 5. Build Designer UI frontend
cd designer
npm install
npm run build
cd ..
```

---

### Configuring LLM Backends in `.env`

QuestForge supports **5 LLM backend options**. Open [`.env`](file:///k:/AI/QuestBasedStory/.env) and configure your preferred provider:

#### Option 1: OpenAI & OpenAI-Compatible / OpenAPI Endpoints
Works with official OpenAI, OpenRouter, Groq, DeepSeek, LocalAI, Ollama, or vLLM:
```ini
LLM_BACKEND=openai

OPENAI_API_KEY=sk-your-openai-or-provider-key
OPENAI_MODEL=gpt-4o
OPENAI_FALLBACK_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

> [!TIP]
> **Using Third-Party or Local Endpoints:**
> - **OpenRouter**: Set `OPENAI_BASE_URL=https://openrouter.ai/api/v1` and `OPENAI_MODEL=anthropic/claude-3.7-sonnet` (or any model on OpenRouter).
> - **Groq**: Set `OPENAI_BASE_URL=https://api.groq.com/openai/v1` and `OPENAI_MODEL=llama-3.3-70b-versatile`.
> - **DeepSeek**: Set `OPENAI_BASE_URL=https://api.deepseek.com/v1` and `OPENAI_MODEL=deepseek-chat`.
> - **Ollama (Local)**: Set `OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_API_KEY=ollama`, and `OPENAI_MODEL=mistral` or `llama3`.

#### Option 2: Anthropic (Claude)
Direct connection to the Anthropic Messages API:
```ini
LLM_BACKEND=anthropic

ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
ANTHROPIC_MODEL=claude-3-7-sonnet-20250219
ANTHROPIC_FALLBACK_MODEL=claude-3-5-haiku-20241022
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
```

#### Option 3: Google Gemini API (Google AI Studio)
```ini
LLM_BACKEND=gemini_api

GEMINI_API_KEY=your_gemini_api_key_from_ai_studio
GEMINI_MODEL=gemini-2.0-flash
GEMINI_FALLBACK_MODEL=gemini-2.0-pro
```

#### Option 4: Google Cloud Vertex AI
```ini
LLM_BACKEND=vertex_ai

GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
# GOOGLE_APPLICATION_CREDENTIALS=credentials/gcp-service-account.json
VERTEX_AI_MODEL=publishers/xai/models/grok-4.3
VERTEX_AI_FALLBACK_MODEL=gemini-2.5-flash
```

#### Option 5: Offline / Mock Mode (Zero Keys Needed)
```ini
LLM_BACKEND=mock
```
*Allows full pipeline dry-runs and automated test verification without API credentials or network access.*

---

## 3. Launching QuestForge

QuestForge provides 3 execution modes via [`run.bat`](file:///k:/AI/QuestBasedStory/run.bat):

```cmd
run.bat          # 1. Unified Web App (Default)
run.bat dev      # 2. Full Development Mode with Hot Reloading
run.bat cli      # 3. Interactive Terminal Reviewer CLI
run.bat help     # 4. Display Launcher Usage
```

### Mode 1: Unified Web Application (Default)
Double-click [`run.bat`](file:///k:/AI/QuestBasedStory/run.bat) or run `run.bat`.
- Starts the FastAPI server on port 8000.
- Serves the compiled Visual Designer UI directly at `http://127.0.0.1:8000`.
- Automatically opens your default web browser to `http://127.0.0.1:8000`.

### Mode 2: Developer Mode with Hot Reloading
Run `run.bat dev`.
- Launches the FastAPI backend on `http://127.0.0.1:8000` in a dedicated terminal window with `--reload`.
- Starts Vite frontend development server on `http://localhost:5173` with instant Hot-Module Replacement (HMR).
- API requests and Server-Sent Events (SSE) proxy seamlessly to the backend.

### Mode 3: Interactive Terminal Reviewer CLI
Run `run.bat cli` or `python -m pipeline.cli`.
- Run story generation directly in your terminal with checkpoint approvals and note inputs:
  ```cmd
  run.bat cli --seed "A cyber-noir detective plagued by memory glitches uncovers a syndicate conspiracy."
  run.bat cli --list-projects
  run.bat cli --project proj_neon_grave
  ```

---

## 4. Multi-Story Project Workspace

QuestForge features full multi-story workspace management with independent disk storage:

### Accessing the Workspace
Click the **Project Selector** dropdown or the folder icon in the top header, or press `Ctrl+K` and type `Switch Project`.

### Features
1. **Create New Story Project**:
   - Provide a Story Title, Story Seed, Genre, and Tone.
   - Automatically initializes an isolated project directory in `projects/<project_slug>/`.
   - Allocates an independent SQLite checkpoint file (`pipeline.sqlite`) so thread execution never collides between stories.
2. **Switching Active Stories**:
   - Seamlessly toggle between ongoing projects.
   - Loads the exact snapshot, authored chapters, character dossiers, and quests.
3. **Story State Persistence**:
   - Every human approval, chapter generation, and manual edit is auto-saved into `state_snapshot.json` and `project.json`.
4. **Project Deletion & Archiving**:
   - Safely remove old experiments or duplicate drafts from the UI.

---

## 5. The 5 Human-in-the-Loop Checkpoint Gates

QuestForge is fundamentally designed around human artistic agency. At 5 designated pipeline checkpoints, execution pauses and presents you with review actions:

### Checkpoint Overview

```
[Start Seed]
    │
[Checkpoint 1: Story Arc] ──────────► Review 3-act spine, themes, conflict, protagonist
    │
[Checkpoint 2: Chapter Breakdown] ──► Review chapter contracts, locations, entry/exit flags
    │
[Checkpoint 3: Scene Transitions] ──► Review inter-chapter bridge scenes and state changes
    │
[Checkpoint 4: Chapter Authoring] ──► Per-chapter loop: prose, characters, dialogue, critic review
    │
[Checkpoint 5: Quest Mapping] ──────► Review quest DAG, reachability, achievements
    │
[Export Complete]
```

### The 3 Control Actions at Every Checkpoint

1. **Approve (`[A]`)**:
   - Accepts the generated stage output and advances the graph to the next checkpoint.
2. **Regenerate with Notes (`[R]`)**:
   - Rejects the current stage output.
   - Opens a feedback text field where you supply directorial instructions (e.g., *"Make the villain's motives more ambiguous and add more rain/fog atmosphere"*).
   - The agent re-executes with your specific notes injected into its prompt context.
3. **Manual Edit (`[E]`)**:
   - Directly edit titles, summaries, choices, character names, or objectives in the UI before approving.

---

## 6. In-Depth Guide to the 8 Designer Tabs

---

### Tab 1: Story Overview

The **Story Overview** tab visualizes your overall narrative spine on an interactive React Flow canvas.

#### Key Features:
- **Connected Chapter Graph**: Each chapter appears as an interactive node connected by transition lines.
- **Act Color Bands**: Nodes are visual-coded by Act (Act 1: Discovery, Act 2: Confrontation, Act 3: Climax).
- **Chapter Contract Cards**: Inspect chapter titles, dramatic goals, primary locations, and characters present.
- **Entry & Exit Flags**: View state prerequisites required to enter each chapter and flags set upon completion.
- **Inspector Drawer**: Click any chapter node to open the side inspector drawer to edit titles, summaries, or dramatic questions in real time.
- **Fit View & Grid Tools**: Quick zoom, pan, and layout centering buttons.

---

### Tab 2: Dialogue Editor

The **Dialogue Editor** is an interactive visual scripting suite for branching point-and-click conversation trees and scene prose.

#### Key Features:
- **Interactive Node Canvas**:
  - Dialogue nodes display speaker avatars, spoken text, choice buttons, and trait tags.
  - Connect choice ports directly to target dialogue nodes to build branching conversational webs.
- **Chapter Selection Dropdown**: Switch between authored chapters to view and edit that chapter's dialogue tree.
- **Scene Prose Inspector**:
  - Toggle the Scene Prose panel to read and edit the literary scene prose generated by the Narrator.
  - Edit sensory prose, emotional beats, and environmental descriptions.
- **Add Dialogue Node (`+ New Node`)**:
  - Interactive popup to quickly insert new speaker nodes, choice labels, and target links.
- **Trait-Tagged Choices**:
  - Each choice can be tagged with one of your story's two traits (e.g. `[Cunning]` or `[Empathy]`).
  - Colors match the Trait Architecture color-coding.
- **Dialogue History Undo/Redo**: Full state stack allowing `Undo` and `Redo` for node placements and edits.

---

### Tab 3: Quest Graph

The **Quest Graph** transforms narrative milestones into game design architecture.

#### Key Features:
- **3 Filterable Quest Categories**:
  - <span style="color:#ef4444; font-weight:bold;">Main Blocking (Red)</span>: Mandatory plot progression quests that gate access to the next chapter.
  - <span style="color:#10b981; font-weight:bold;">Latent Advantage (Green)</span>: Optional narrative discoveries that reward advantage flags or lower future skill checks.
  - <span style="color:#f59e0b; font-weight:bold;">Achievements (Gold)</span>: Special player accolades unlocked by exploring narrative corners or making specific trait commitments.
- **Attachment Points**: Shows exactly which scene or dialogue node triggers each quest, and which entity rewards completion.
- **Trait Gate Reachability**:
  - Automatically flags if a quest requires a trait level that the player cannot reach based on the available dialogue choices.
- **Detail Drawer**: Click any quest node to inspect its objective, trigger flag, reward flags, and assigned location.

---

### Tab 4: Trait Arc

QuestForge enforces a **2-Trait Philosophy** to create tight, meaningful player identity arcs without bloated RPG stat systems.

#### Key Features:
- **Two-Trait Architecture**:
  - Displays the 2 primary opposing traits generated for your story (e.g., *Cunning* vs. *Empathy*, or *Logic* vs. *Intuition*).
- **Choice Distribution Metrics**:
  - Live bar graphs displaying the total dialogue choices authored for Trait A and Trait B across all chapters.
- **3-Tier Threshold Progression**:
  - **Tier 1 (Latent)**: 0–3 choices made. Baseline personality.
  - **Tier 2 (Established)**: 4–7 choices made. Unlocks specialized dialogue options and advantage quests.
  - **Tier 3 (Apex)**: 8+ choices made. Unlocks exclusive chapter climax solutions.
- **Climax Branch Previews**:
  - Previews how Chapter 6/final chapter resolves differently based on whether the player leaned towards Trait A, Trait B, or maintained a balanced duality.

---

### Tab 5: Cast & World

The **Cast & World** tab is your story bible and character design studio, split into three sub-tabs:

#### Sub-Tab 1: Characters
- Comprehensive character sheets for the Protagonist, Antagonist, and Allies.
- **Psychological Profiling**: Core desire, fatal flaw, secrets, and speech cadence.
- **Relationship Matrix**: Explains dynamic tensions between each character.
- In-place editing: Click the edit pencil on any field to refine character details.

#### Sub-Tab 2: World Bible
- **Locations**: Catalog of scene backdrops, sensory notes, atmosphere, and secrets.
- **World Rules & Laws**: Explicit constraints (technological limits, magic systems, syndicate rules) enforced by the Lore Weaver to avoid continuity errors.
- **Historical Timeline**: Pre-story lore and pivotal events that set the stage for Chapter 1.

#### Sub-Tab 3: Portrait Studio
- Visual Novel Portrait Generator and Lightbox Gallery.
- Generates high-quality character and NPC portrait art prompts.
- Upload custom portrait images or view generated portrait variants in a full-screen lightbox.

---

### Tab 6: Export & Packages

The **Export & Packages** tab compiles your authored world into game-ready artifacts.

#### Key Features:
- **Pre-Export Validation Checklist**:
  - Automatically audits:
    - ✔ Referential integrity (all choice targets point to existing nodes).
    - ✔ World consistency (all scenes reference valid locations and characters).
    - ✔ Trait reachability (all quest trait gates are mathematically unlockable).
    - ✔ Entry/exit flag continuity (every chapter's entry flag is provided by the preceding chapter).
- **JSON Package Inspector**:
  - Live syntax-highlighted viewer for `manifest.json`, `world_bible.json`, `characters.json`, `trait_arc.json`, and chapter JSON files.
- **1-Click Twine Export**:
  - Generates standalone, playable interactive fiction in **Twine / SugarCube 2 / Twee3** format.
  - Provides instant download for `.twee` source code and standalone `.html` playable file.
- **Export Package Button**:
  - Bundles the complete game package into `projects/<project_id>/game_package/` and root `game_package/`.

---

### Tab 7: Debug & Diagnostics

The **Debug & Diagnostics** tab provides complete transparency into the LLM runtime, server health, and diagnostic logs.

#### Key Features:
- **Server Health Banner**: Displays live API server status, latency, and active generation threads.
- **Active Model Diagnostics**:
  - Inspects active LLM backend (`vertex_ai`, `gemini_api`, `openai`, `anthropic`, or `mock`).
  - Displays loaded credentials path, project ID, location, and model names.
  - Highlights configuration warnings or missing API keys.
- **Interactive Prompt Playground**:
  - Test prompts against any LLM backend without modifying active project state.
  - **Backend Override**: Test against OpenAI, Anthropic, Gemini, Vertex AI, or Mock on the fly.
  - **Model Override**: Input arbitrary model identifiers (e.g. `gpt-4o`, `claude-3-7-sonnet`, `deepseek-chat`).
  - **Temperature & JSON Mode**: Sliders and toggles to test model formatting adherence.
  - **Performance Benchmarking**: Displays roundtrip latency in milliseconds (`latency_ms`).
- **Live Diagnostic Logs Buffer**:
  - Real-time event log categorized by `API`, `Pipeline`, `LLM`, and `System`.
  - Filter by `ALL`, `ERROR`, `WARNING`, or `LLM`.
  - Copy and clear log controls.

---

### Tab 8: Play Novel (Interactive Playtester)

The **Play Novel** tab is a full visual novel engine built directly into QuestForge so you can playtest your story as a player before exporting.

#### Key Features:
- **Title Screen**: Displays the story title, genre, tone, and prologue hook with "Begin Story" and "Chapter Select".
- **Chapter Intros & Transition Cards**: Smooth chapter cards showing dramatic questions and bridge summaries.
- **Scene Reader**:
  - Renders full literary prose scene-by-scene.
  - Displays character portraits of individuals present in the scene.
  - Environmental mood backdrop styling.
- **Dialogue Player**:
  - Presents interactive dialogue nodes with speaker names, avatar portraits, and selectable dialogue choices.
  - Displays trait tags (`[Cunning]`, `[Empathy]`) on choices.
- **Live Trait Meters**:
  - Top hud meters track trait points in real time as you make choices.
- **Real-Time Quest Tracker & Journal Drawer (`J`)**:
  - Displays active quests, completed objectives, and unlocked flags.
  - Press `J` anytime to slide open the detective's journal drawer.
- **Chapter Jump Menu**: Jump directly to any chapter to test specific branches without replaying from Chapter 1.

---

## 7. Global Tools & Keyboard Shortcuts

### Global Search & Command Palette (`Ctrl+K` / `Cmd+K`)
Press `Ctrl+K` from any tab to open the global search modal:
- Search across:
  - 💬 **Dialogue**: Spoken lines and player choices.
  - 📖 **Prose**: Scene text, sensory descriptions, and chapter summaries.
  - 🧭 **Quests**: Objectives, reward flags, and trigger conditions.
  - 👥 **Characters**: Character names, flaws, and motivations.
  - 🗺️ **World**: Locations, lore rules, and factions.
- Selecting any search result instantly jumps you to that specific chapter and tab.

### Keyboard Shortcuts Reference

| Shortcut | Context | Action |
|---|---|---|
| `Ctrl + K` / `Cmd + K` | Global | Open / Close Search and Command Palette |
| `Space` / `ArrowRight` | Play Novel | Advance to next scene / dismiss chapter card |
| `ArrowLeft` | Play Novel | Return to previous scene |
| `1` – `9` | Play Novel | Select dialogue choice by index number |
| `J` | Play Novel | Toggle detective journal / quest drawer |
| `Esc` | Play Novel | Exit playtest mode and return to Story Overview |
| `Esc` | Modals | Close Project Modal, Search Modal, or Lightbox |

---

## 8. Export Targets: Unity & Twine

### 1. Unity Engine Integration
QuestForge exports a production-ready JSON package into `game_package/`:
```
game_package/
├── manifest.json            # Story metadata, chapter sequence, trait config
├── world_bible.json         # Locations, factions, rules, and timeline
├── characters.json          # Psychological character sheets and relationships
├── trait_arc.json           # Trait definitions, thresholds, and climax branches
├── achievements.json        # Achievement requirements and trigger flags
├── attachment_points.json   # Quest scene/node mappings
└── chapters/
    ├── chapter_01.json      # Scenes, prose, dialogue tree, exit flags
    ├── chapter_02.json
    └── ...
```

For C# data contract models, asset importing, and dialogue tree parsing scripts in Unity, see **[`UNITY_INTEGRATION.md`](file:///k:/AI/QuestBasedStory/UNITY_INTEGRATION.md)**.

### 2. Twine / SugarCube 2 / Twee3 Standalone HTML
From the **Export** tab, click **Export to Twine**:
- Produces a single, self-contained `story.html` file in `projects/<id>/twine/story.html`.
- Plays in any web browser with zero server dependencies.
- Includes full variable tracking (`$flags`, `$completed_quests`, `$trait_scores`).

---

## 9. Pro Tips, Best Practices & Suggestions

### Writing Story Seeds for Maximum Depth
- **Include opposing philosophical poles**: Good: *"An undercover cyber-detective torn between institutional duty and sympathy for an android rebellion."* (Naturally generates clear opposing traits like *Order* vs. *Empathy*).
- **Mention concrete physical constraints**: Give the Lore Weaver a setting constraint (e.g., *"Set in a submerged deep-sea research spire where air is strictly rationed"*).

### Overcoming Critic Rejections
- If the Critic scores below 75 or reports a hard gate violation:
  1. Inspect the **Stage Review Panel** to read the Critic's specific feedback.
  2. The most common violation is **Missing Exit Flags** (e.g. Chapter 1 contract states it must set `found_keycard`, but the Narrator omitted it).
  3. Use **Regenerate with Notes** and provide: *"Ensure Elena explicitly discovers and logs the exit flag 'found_keycard' in Scene 3."*

### Explicit / Adult Mode Policy Directive
QuestForge includes a specialized directive (`EXPLICIT_MODE_DIRECTIVE`) for adult/mature interactive fiction (18+). When authoring noir thrillers or mature stories:
- In `.env`, ensure safety filter thresholds are set to `BLOCK_NONE` if supported by your model.
- Mature themes, visceral combat, and unfiltered adult dialogue will be honored by the agents without softening or censoring.

### Switching Models for Cost & Speed Optimization
- **Development / Drafting**: Use fast, economical models for initial planning:
  - `OPENAI_MODEL=gpt-4o-mini`
  - `ANTHROPIC_MODEL=claude-3-5-haiku-20241022`
  - `GEMINI_MODEL=gemini-2.0-flash`
- **Final Polish**: Switch to reasoning and flagship models for rich literary prose in Chapter Authoring:
  - `OPENAI_MODEL=gpt-4o`
  - `ANTHROPIC_MODEL=claude-3-7-sonnet-20250219`
  - `GEMINI_MODEL=gemini-2.0-pro`
