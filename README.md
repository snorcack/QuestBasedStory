# QuestForge

**QuestForge** is an interactive multi-agent story and narrative authoring system designed for point-and-click adventure games. It transforms an initial story seed into a rich, structured story arc, produces chapter-by-chapter prose and dialogue trees with narrative trait tracking, and automatically annotates game quests onto the narrative.

The shipped game reads static JSON packages; **no AI model runs at runtime**.

---

## System Architecture

```
Story Idea
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
[Quest Architect] ──► Quest Graph, Attachment Points, Achievements (Checkpoint 5)
    │
    ▼
[Export Agent] ──► Static JSON Game Package
```

---

## 8 Specialist Agents

| Agent | Role | Responsibility |
|---|---|---|
| **Main Planner** | Director / Story Architect | 3-pass decomposition: Arc → Chapter Contracts → Transitions |
| **Lore Weaver** | World Builder | World Bible (locations, rules, timeline) + ChromaDB contradiction detection |
| **Narrator** | Core Prose Writer | Scene-by-scene prose, emotional beats, blocking quest journals |
| **Critic** | Rigorous Story Editor | 100-point rubric scoring (threshold 75) + Chapter Contract hard gate |
| **Character Forge** | Psychological Cast Designer | Character sheets, flaws, motivations, relationship network |
| **Branch Keeper** | Dialogue Tree Architect | Interactive dialogue graphs, trait-tagged choices, climax branches |
| **Quest Architect** | Game Narrative Mapper | Identifies BLOCKING / ADVANTAGE / ACHIEVEMENT quests + trait reachability |
| **Export Agent** | Formatter & Validator | Referential integrity verification and `game_package/` builder |

---

## Quick Start Guide

### 1. Installation

```bash
# Clone or navigate to the repository
cd QuestBasedStory

# Install Python dependencies
pip install -r requirements.txt

# (Optional) Configure LLM Backend in .env
cp .env.example .env
# Edit .env with your GEMINI_API_KEY or Google Cloud Vertex AI credentials.
# Offline / mock testing works out of the box with zero API keys!
```

---

### 2. Option A: Visual Designer UI (React Flow)

Start the unified backend + frontend server:

```bash
python -m pipeline.api.server
```

Then open your browser at **[http://127.0.0.1:8000](http://127.0.0.1:8000)**.

#### Designer UI Views:
1. **Story Overview**: Chapter contracts as connected nodes on a React Flow canvas.
2. **Quest Graph**: Quest DAG filtered by Main Blocking (Red), Latent Advantage (Green), and Achievements (Gold).
3. **Dialogue Editor**: Interactive dialogue trees with trait-tagged choices and scene prose inspector.
4. **Trait Arc**: Trait progression bars and Chapter 6 convergent climax branch previews.
5. **Export**: Pre-export validation checklist, JSON tree inspector, and export button.

---

### 3. Option B: Interactive Terminal Reviewer CLI

To run the entire pipeline directly in your terminal with human checkpoints:

```bash
# Start a new story authoring session
python -m pipeline.cli --seed "A detective in a dying city uncovers a conspiracy that reaches into her own past."

# Resume an existing session from disk
python -m pipeline.cli --resume default-session
```

At each checkpoint, the CLI prompts:
- `[A]pprove`: Accepts stage output and advances to the next stage.
- `[R]egenerate with notes`: Prompts for director feedback, re-runs the agent with notes.
- `[E]dit`: Interactively modifies stage titles or fields.
- `[Q]uit`: Saves the session state to `.checkpoints/pipeline.sqlite` so you can close and resume anytime.

---

### 4. Running the Verification Test Suite

QuestForge includes 24 automated unit and integration tests covering all phases:

```bash
python -m pytest tests -v
```

```
tests/test_phase1_models.py::test_trait_tier_calculations PASSED
tests/test_phase1_models.py::test_shared_context_serialization PASSED
tests/test_phase1_models.py::test_all_8_prompts_load PASSED
tests/test_phase1_models.py::test_lore_store_chromadb_in_memory PASSED
tests/test_phase1_models.py::test_rubric_scoring_and_gates PASSED
tests/test_phase1_models.py::test_llm_client_initialization PASSED
tests/test_phase1_pipeline.py::test_langgraph_pipeline_all_5_checkpoints_end_to_end PASSED
tests/test_phase1_pipeline.py::test_fastapi_server_endpoints PASSED
tests/test_phase2_story_spine.py::test_main_planner_pass_1_story_arc PASSED
tests/test_phase2_story_spine.py::test_main_planner_pass_2_chapter_contracts PASSED
tests/test_phase2_story_spine.py::test_main_planner_pass_3_chapter_transitions PASSED
tests/test_phase2_story_spine.py::test_langgraph_regeneration_loop PASSED
tests/test_phase2_story_spine.py::test_sqlite_persistence_and_resume PASSED
tests/test_phase2_story_spine.py::test_phase_2_complete_milestone PASSED
tests/test_phase3_chapter_authoring.py::test_character_forge_agent PASSED
tests/test_phase3_chapter_authoring.py::test_lore_weaver_agent PASSED
tests/test_phase3_chapter_authoring.py::test_narrator_agent PASSED
tests/test_phase3_chapter_authoring.py::test_critic_agent_hard_gate PASSED
tests/test_phase3_chapter_authoring.py::test_branch_keeper_agent PASSED
tests/test_phase3_chapter_authoring.py::test_phase_3_chapter_authoring_end_to_end PASSED
tests/test_phase4_full_pipeline_export.py::test_quest_architect_trait_reachability PASSED
tests/test_phase4_full_pipeline_export.py::test_export_agent_referential_validation PASSED
tests/test_phase4_full_pipeline_export.py::test_export_agent_writes_complete_package PASSED
tests/test_phase4_full_pipeline_export.py::test_phase_4_end_to_end_pipeline_and_export PASSED

======================= 24 passed in 10.75s =======================
```

---

## Unity Engine Integration

For instructions on importing the generated `game_package/` into Unity, see **[`UNITY_INTEGRATION.md`](file:///k:/AI/QuestBasedStory/UNITY_INTEGRATION.md)**.
