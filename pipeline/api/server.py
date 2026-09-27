"""FastAPI server with Server-Sent Events (SSE) for QuestForge."""
import asyncio
import json
from typing import Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from langgraph.types import Command

import datetime
import os
import shutil
from pathlib import Path
from pipeline.graph.pipeline import build_questforge_graph, get_default_sqlite_checkpointer
from pipeline.models.context import SharedContext
from pipeline.models.project import (
    ProjectSummary,
    ProjectDetail,
    CreateProjectRequest,
    ResumeProjectRequest,
)
from pipeline.tools.llm_client import LLMClient, get_llm_client
from pipeline.tools.project_manager import get_project_manager

app = FastAPI(title="QuestForge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory graph instance, event queues, diagnostic log buffer, and project manager
pipeline_graph = build_questforge_graph()
project_manager = get_project_manager()
project_graphs: dict[str, Any] = {}
thread_queues: dict[str, asyncio.Queue] = {}
thread_states: dict[str, dict[str, Any]] = {}
recent_logs: list[dict[str, Any]] = []


def get_graph_for_project(project_id: str):
    """Retrieve or instantiate a StateGraph bound to the project's SQLite checkpointer."""
    if project_id not in project_graphs:
        sqlite_path = project_manager.get_sqlite_path(project_id)
        saver = get_default_sqlite_checkpointer(sqlite_path)
        project_graphs[project_id] = build_questforge_graph(checkpointer=saver)
    return project_graphs[project_id]


def record_log(level: str, category: str, message: str, details: Any = None):
    entry = {
        "id": f"log_{len(recent_logs)+1}_{int(datetime.datetime.now().timestamp()*1000)}",
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
        "level": level,  # "INFO", "WARNING", "ERROR"
        "category": category,  # "API", "Pipeline", "LLM", "System"
        "message": message,
        "details": details,
    }
    recent_logs.append(entry)
    if len(recent_logs) > 200:
        recent_logs.pop(0)
    return entry


record_log("INFO", "System", "QuestForge API Server initialized.")


class StartPipelineRequest(BaseModel):
    story_seed: str = "A detective in a neon city uncovers a forgotten vault."
    thread_id: str = "default-session"
    is_explicit: bool = False


class ResumePipelineRequest(BaseModel):
    action: str = "approve"  # "approve" | "regenerate"
    notes: str = ""
    override_data: dict[str, Any] | None = None


class TestPromptRequest(BaseModel):
    user_prompt: str
    system_prompt: str = "You are a creative story assistant."
    temperature: float = 0.7
    max_tokens: int = 1024
    json_mode: bool = False
    backend: str | None = None
    model: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "app": "QuestForge", "version": "0.1.0"}


@app.get("/api/debug/status")
def debug_status():
    """Returns server health, diagnostic configuration, and active sessions."""
    client = get_llm_client()
    diag = client.diagnose()
    return {
        "server_status": "online",
        "timestamp": datetime.datetime.now().isoformat(),
        "active_threads": list(thread_queues.keys()),
        "llm_diagnostics": diag,
    }


@app.get("/api/debug/logs")
def debug_logs():
    """Returns recent diagnostic and error logs."""
    return list(reversed(recent_logs))


@app.post("/api/debug/clear-logs")
def debug_clear_logs():
    """Clears diagnostic log buffer."""
    recent_logs.clear()
    record_log("INFO", "System", "Diagnostic logs cleared.")
    return {"status": "cleared"}


@app.post("/api/debug/test-prompt")
def debug_test_prompt(req: TestPromptRequest):
    """Executes a test prompt directly against configured LLM backend and captures diagnostics."""
    record_log("INFO", "LLM", f"Received test prompt: '{req.user_prompt[:50]}...'")
    
    if req.backend:
        test_client = LLMClient(backend=req.backend)
        if req.model:
            test_client.model_name = req.model.strip()
    else:
        test_client = get_llm_client()
        if req.model:
            test_client.model_name = req.model.strip()

    result = test_client.test_call(
        prompt=req.user_prompt,
        system_prompt=req.system_prompt,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        json_mode=req.json_mode,
    )

    if result["success"]:
        record_log(
            "INFO",
            "LLM",
            f"Prompt succeeded ({result['latency_ms']}ms, backend={result['backend']}, model={result['model']})",
            {"prompt_length": len(req.user_prompt), "response_length": len(result["response"] or "")}
        )
    else:
        record_log(
            "ERROR",
            "LLM",
            f"Prompt failed ({result['latency_ms']}ms): {result['error']}",
            {"hint": result["hint"], "backend": result["backend"], "model": result["model"]}
        )

    return result


# ---------------------------------------------------------------------------
# Dialogue Editor AI Endpoints
# ---------------------------------------------------------------------------

class DialogueExpandRequest(BaseModel):
    mode: str = "continue"          # "continue" | "rewrite" | "custom"
    parent_text: str = ""           # source node's dialogue text (for context)
    current_text: str = ""          # text currently in the textarea (for rewrite)
    seed_prompt: str = ""           # user direction hint / custom prompt
    speaker: str = "Narrator"
    chapter_context: str = ""       # chapter title / narrative scope
    is_explicit: bool = False


class DialogueSuggestChoicesRequest(BaseModel):
    node_text: str                  # the node's current dialogue text
    speaker: str = "Narrator"
    chapter_context: str = ""
    existing_choices: list[str] = []   # already existing choice labels to avoid repeating
    is_explicit: bool = False


@app.post("/api/dialogue/expand")
def dialogue_expand(req: DialogueExpandRequest):
    """
    Single-shot LLM call to expand/generate dialogue text for a node.
    Modes:
      - continue  : write a new beat that follows the parent_text
      - rewrite   : rewrite current_text keeping the same meaning but better prose
      - custom    : use seed_prompt as the direct creative direction
    Returns { expanded_text: str }
    """
    client = get_llm_client()

    if req.mode == "rewrite":
        system = (
            "You are an expert narrative writer for interactive fiction. "
            "Rewrite the dialogue beat provided, keeping the same meaning and story purpose "
            "but with sharper, more vivid prose. Return ONLY the improved dialogue text, no quotes, "
            "no JSON, no commentary."
        )
        user = (
            f"Speaker: {req.speaker}\n"
            f"Chapter: {req.chapter_context}\n\n"
            f"Original text to rewrite:\n{req.current_text}"
        )
    elif req.mode == "custom":
        system = (
            "You are an expert narrative writer for interactive fiction. "
            "Write a single dialogue beat or narration following the creative direction given. "
            "Return ONLY the dialogue text, no quotes, no JSON, no commentary."
        )
        user = (
            f"Speaker: {req.speaker}\n"
            f"Chapter: {req.chapter_context}\n"
            + (f"Parent dialogue (context): {req.parent_text}\n\n" if req.parent_text else "")
            + f"Creative direction: {req.seed_prompt}"
        )
    else:  # continue
        system = (
            "You are an expert narrative writer for interactive fiction. "
            "Write a single dialogue beat or narration that naturally continues the story. "
            "Keep it concise (1-3 sentences). Return ONLY the dialogue text, "
            "no quotes, no JSON, no commentary."
        )
        seed_line = f"\nWriter direction: {req.seed_prompt}" if req.seed_prompt.strip() else ""
        user = (
            f"Speaker: {req.speaker}\n"
            f"Chapter: {req.chapter_context}\n"
            + (f"Preceding dialogue: {req.parent_text}\n" if req.parent_text else "")
            + seed_line
        )

    try:
        result = client.generate(
            system_prompt=system,
            user_prompt=user,
            temperature=0.82,
            max_tokens=512,
            json_mode=False,
            is_explicit=req.is_explicit,
        )
        expanded = result.strip().strip('"').strip("'")
        if not expanded:
            raise ValueError("LLM returned empty text.")
        record_log("INFO", "LLM", f"dialogue/expand ({req.mode}): generated {len(expanded)} chars")
        return {"expanded_text": expanded}
    except Exception as e:
        record_log("ERROR", "LLM", f"dialogue/expand failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/dialogue/suggest-choices")
def dialogue_suggest_choices(req: DialogueSuggestChoicesRequest):
    """
    Generate 2-4 player choice options for a dialogue node.
    Returns { choices: [{ label: str }] }
    """
    client = get_llm_client()

    existing_str = (
        "\nAlready existing choices (do not repeat):\n"
        + "\n".join(f"- {c}" for c in req.existing_choices)
        if req.existing_choices
        else ""
    )

    system = (
        "You are a game writer for interactive fiction. "
        "Generate 3 distinct, compelling player response choices for the given dialogue beat. "
        "Each choice should feel meaningfully different (e.g. aggressive, empathetic, cunning). "
        "Return JSON: {\"choices\": [{\"label\": \"...\"}]}"
    )
    user = (
        f"Chapter: {req.chapter_context}\n"
        f"Speaker: {req.speaker}\n"
        f"Dialogue: {req.node_text}"
        + existing_str
    )

    try:
        raw = client.generate(
            system_prompt=system,
            user_prompt=user,
            temperature=0.9,
            max_tokens=512,
            json_mode=True,
            is_explicit=req.is_explicit,
        )
        import json as _json
        data = _json.loads(raw)
        choices = data.get("choices", [])
        if not choices:
            raise ValueError("No choices returned.")
        record_log("INFO", "LLM", f"dialogue/suggest-choices: {len(choices)} choices generated")
        return {"choices": choices}
    except Exception as e:
        record_log("ERROR", "LLM", f"dialogue/suggest-choices failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ProsePolishRequest(BaseModel):
    mode: str = "punch_up"          # "punch_up" | "more_sensory" | "heighten_tension" | "condense" | "custom"
    scene_title: str = ""
    current_prose: str = ""
    emotional_beat: str = ""
    characters_present: list[str] = []
    custom_instruction: str = ""
    chapter_context: str = ""
    is_explicit: bool = False


@app.post("/api/prose/polish")
def prose_polish(req: ProsePolishRequest):
    """
    Rewrite or polish scene prose with targeted narrative directions:
      - punch_up: improve rhythm, strong verbs, active voice, evocative vocabulary
      - more_sensory: enrich visceral descriptions (sound, smell, tactile atmosphere)
      - heighten_tension: elevate pacing, stakes, dramatic suspense, subtext
      - condense: tighten prose, eliminate fluff while keeping core dramatic moments
      - custom: apply custom author instructions
    Returns: {"polished_prose": str, "emotional_beat": str}
    """
    client = get_llm_client()

    mode_instructions = {
        "punch_up": (
            "Elevate the literary quality and flow. Use vivid, kinetic verbs, crisp pacing, "
            "and eliminate clichés or passive phrasing. Keep the emotional tone punchy and evocative."
        ),
        "more_sensory": (
            "Imbue the prose with rich, multi-sensory details (lighting, ambient sound, scent, "
            "temperature, visceral physical sensations). Ground the reader deeply in the environment."
        ),
        "heighten_tension": (
            "Heighten dramatic suspense and stakes. Emphasize dangerous subtext, unspoken conflict, "
            "paranoia, or mounting pressure between characters. Sharpen the edge of every sentence."
        ),
        "condense": (
            "Tighten and compress the prose into high-impact, economical storytelling. Strip filler, "
            "redundancy, and exposition while keeping all key narrative beats and visceral impact."
        ),
        "custom": (
            f"Follow the author's custom creative instruction: {req.custom_instruction}"
            if req.custom_instruction
            else "Enhance the narrative prose with polished dramatic depth."
        ),
    }

    selected_instruction = mode_instructions.get(req.mode, mode_instructions["punch_up"])

    system_prompt = (
        "You are an acclaimed narrative novelist and story director. "
        "Your task is to refine and polish authored scene prose for interactive fiction. "
        "Preserve existing plot facts, character names, and core events. "
        "Return a JSON object with: "
        "{\"polished_prose\": string, \"emotional_beat\": string}"
    )

    chars_str = ", ".join(req.characters_present) if req.characters_present else "Unspecified"
    user_prompt = (
        f"Chapter Context: {req.chapter_context}\n"
        f"Scene Title: {req.scene_title}\n"
        f"Current Emotional Beat: {req.emotional_beat}\n"
        f"Characters Present: {chars_str}\n\n"
        f"Instruction: {selected_instruction}\n\n"
        f"Original Prose:\n{req.current_prose}\n\n"
        "Refine the prose and output JSON with keys 'polished_prose' and 'emotional_beat'."
    )

    try:
        raw = client.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.8,
            max_tokens=1024,
            json_mode=True,
            is_explicit=req.is_explicit,
        )
        import json as _json
        try:
            data = _json.loads(raw)
            polished = data.get("polished_prose", "").strip()
            beat = data.get("emotional_beat", req.emotional_beat or "").strip()
        except Exception:
            polished = raw.strip()
            beat = req.emotional_beat

        if not polished:
            raise ValueError("LLM returned empty prose.")

        record_log("INFO", "LLM", f"prose/polish ({req.mode}): refined {len(polished)} chars")
        return {"polished_prose": polished, "emotional_beat": beat}
    except Exception as e:
        record_log("ERROR", "LLM", f"prose/polish failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/pipeline/start")
async def start_pipeline(req: StartPipelineRequest):
    """Initialize and advance pipeline up to first checkpoint."""
    thread_id = req.thread_id
    config = {"configurable": {"thread_id": thread_id}}
    
    # Initialize queue for SSE stream
    if thread_id not in thread_queues:
        thread_queues[thread_id] = asyncio.Queue()

    initial_input = {"story_seed": req.story_seed, "is_explicit": req.is_explicit}
    record_log("INFO", "Pipeline", f"Starting pipeline for thread '{thread_id}' with seed: '{req.story_seed[:50]}...' (explicit={req.is_explicit})")
    
    # Execute graph until first interrupt
    try:
        result = pipeline_graph.invoke(initial_input, config=config)
    except Exception as e:
        record_log("ERROR", "Pipeline", f"Failed starting pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # Check if graph paused on interrupt
    state_snapshot = pipeline_graph.get_state(config)
    checkpoint_data = None
    if state_snapshot.tasks:
        for task in state_snapshot.tasks:
            if task.interrupts:
                checkpoint_data = task.interrupts[0].value

    if checkpoint_data:
        record_log("INFO", "Pipeline", f"Checkpoint {checkpoint_data.get('checkpoint')} reached for '{thread_id}'")

    event = {
        "event_type": "checkpoint_reached",
        "thread_id": thread_id,
        "checkpoint_data": checkpoint_data,
        "current_values": state_snapshot.values,
    }
    await thread_queues[thread_id].put(event)

    return {
        "thread_id": thread_id,
        "status": "awaiting_review" if checkpoint_data else "running",
        "checkpoint": checkpoint_data,
    }


@app.post("/api/pipeline/resume/{thread_id}")
async def resume_pipeline(thread_id: str, req: ResumePipelineRequest):
    """Resume execution of an interrupted pipeline session."""
    config = {"configurable": {"thread_id": thread_id}}
    
    if thread_id not in thread_queues:
        thread_queues[thread_id] = asyncio.Queue()

    # Resume graph execution
    resume_payload = {
        "action": req.action,
        "notes": req.notes,
        "override_data": req.override_data,
    }
    
    record_log("INFO", "Pipeline", f"Resuming pipeline '{thread_id}' with action: '{req.action}'")
    try:
        pipeline_graph.invoke(Command(resume=resume_payload), config=config)
    except Exception as e:
        record_log("ERROR", "Pipeline", f"Failed resuming pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    state_snapshot = pipeline_graph.get_state(config)
    checkpoint_data = None
    if state_snapshot.tasks:
        for task in state_snapshot.tasks:
            if task.interrupts:
                checkpoint_data = task.interrupts[0].value

    if checkpoint_data:
        record_log("INFO", "Pipeline", f"Advanced to Checkpoint {checkpoint_data.get('checkpoint')}")
    else:
        record_log("INFO", "Pipeline", f"Pipeline '{thread_id}' completed successfully")

    event = {
        "event_type": "checkpoint_reached" if checkpoint_data else "pipeline_completed",
        "thread_id": thread_id,
        "checkpoint_data": checkpoint_data,
        "current_values": state_snapshot.values,
    }
    await thread_queues[thread_id].put(event)

    return {
        "thread_id": thread_id,
        "status": "awaiting_review" if checkpoint_data else "completed",
        "checkpoint": checkpoint_data,
    }


@app.get("/api/pipeline/events/{thread_id}")
async def stream_events(thread_id: str, request: Request):
    """Server-Sent Events endpoint streaming pipeline progress and checkpoints."""
    if thread_id not in thread_queues:
        thread_queues[thread_id] = asyncio.Queue()
    queue = thread_queues[thread_id]

    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            try:
                # Wait for next event with a periodic heartbeat
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield {
                    "event": "pipeline_event",
                    "data": json.dumps(event),
                }
            except asyncio.TimeoutError:
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"status": "alive"}),
                }

    return EventSourceResponse(event_generator())


# ------------------------------------------------------------------------------
# Project Management & Multi-Story Workspace Endpoints
# ------------------------------------------------------------------------------

@app.get("/api/projects")
def list_projects():
    """List all story projects with stage, status, and summary metadata."""
    return project_manager.list_projects()


@app.post("/api/projects")
def create_project(req: CreateProjectRequest):
    """Create a new story project on disk."""
    record_log("INFO", "Project", f"Creating new story project: '{req.title}' (explicit={req.is_explicit})")
    proj = project_manager.create_project(
        title=req.title,
        story_seed=req.story_seed,
        genre=req.genre,
        tone=req.tone,
        is_explicit=req.is_explicit,
    )
    return proj


@app.get("/api/projects/{project_id}")
def get_project_detail(project_id: str):
    """Get full project details, latest state snapshot, and pending checkpoint."""
    proj = project_manager.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    return proj


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    """Permanently delete a story project from disk."""
    record_log("WARNING", "Project", f"Deleting story project: '{project_id}'")
    if project_id in project_graphs:
        graph = project_graphs[project_id]
        if hasattr(graph, "checkpointer") and hasattr(graph.checkpointer, "conn"):
            try:
                graph.checkpointer.conn.close()
            except Exception:
                pass
        del project_graphs[project_id]
    if project_id in thread_queues:
        del thread_queues[project_id]

    success = project_manager.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    return {"status": "deleted", "project_id": project_id}


@app.post("/api/projects/{project_id}/start")
async def start_project_pipeline(project_id: str, req: StartPipelineRequest | None = None):
    """Start or advance generation for a specific story project."""
    proj = project_manager.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    seed = req.story_seed if (req and req.story_seed) else proj.story_seed
    is_explicit = req.is_explicit if (req and getattr(req, "is_explicit", False)) else getattr(proj, "is_explicit", False)
    config = {"configurable": {"thread_id": project_id}}
    graph = get_graph_for_project(project_id)

    if project_id not in thread_queues:
        thread_queues[project_id] = asyncio.Queue()

    record_log("INFO", "Pipeline", f"Starting project '{proj.title}' ({project_id}, explicit={is_explicit})")
    try:
        graph.invoke({"story_seed": seed, "is_explicit": is_explicit}, config=config)
    except Exception as e:
        project_manager.save_project_state(project_id, proj.state_snapshot, status="error")
        record_log("ERROR", "Pipeline", f"Failed starting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    state_snapshot = graph.get_state(config)
    checkpoint_data = None
    if state_snapshot.tasks:
        for task in state_snapshot.tasks:
            if task.interrupts:
                checkpoint_data = task.interrupts[0].value

    project_manager.save_project_state(
        project_id=project_id,
        state_values=state_snapshot.values,
        checkpoint_data=checkpoint_data,
    )

    event = {
        "event_type": "checkpoint_reached",
        "thread_id": project_id,
        "checkpoint_data": checkpoint_data,
        "current_values": state_snapshot.values,
    }
    await thread_queues[project_id].put(event)

    return {
        "project_id": project_id,
        "status": "awaiting_review" if checkpoint_data else "running",
        "checkpoint": checkpoint_data,
        "current_values": state_snapshot.values,
    }


@app.post("/api/projects/{project_id}/resume")
async def resume_project_pipeline(project_id: str, req: ResumePipelineRequest):
    """Resume an interrupted checkpoint for a specific project."""
    proj = project_manager.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    config = {"configurable": {"thread_id": project_id}}
    graph = get_graph_for_project(project_id)

    if project_id not in thread_queues:
        thread_queues[project_id] = asyncio.Queue()

    resume_payload = {
        "action": req.action,
        "notes": req.notes,
        "override_data": req.override_data,
    }
    record_log("INFO", "Pipeline", f"Resuming project '{project_id}' with action: '{req.action}'")
    try:
        graph.invoke(Command(resume=resume_payload), config=config)
    except Exception as e:
        record_log("ERROR", "Pipeline", f"Failed resuming project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    state_snapshot = graph.get_state(config)
    checkpoint_data = None
    if state_snapshot.tasks:
        for task in state_snapshot.tasks:
            if task.interrupts:
                checkpoint_data = task.interrupts[0].value

    project_manager.save_project_state(
        project_id=project_id,
        state_values=state_snapshot.values,
        checkpoint_data=checkpoint_data,
    )

    if state_snapshot.values.get("current_stage") == "export_complete":
        root_package = Path("game_package")
        if root_package.exists():
            pkg_dest = project_manager.get_package_dir(project_id)
            shutil.copytree(root_package, pkg_dest, dirs_exist_ok=True)

    event = {
        "event_type": "checkpoint_reached" if checkpoint_data else "pipeline_completed",
        "thread_id": project_id,
        "checkpoint_data": checkpoint_data,
        "current_values": state_snapshot.values,
    }
    await thread_queues[project_id].put(event)

    return {
        "project_id": project_id,
        "status": "awaiting_review" if checkpoint_data else "completed",
        "checkpoint": checkpoint_data,
        "current_values": state_snapshot.values,
    }


@app.get("/api/projects/{project_id}/state")
def get_project_state(project_id: str):
    """Retrieve the current state snapshot for a project."""
    if project_id in project_graphs:
        config = {"configurable": {"thread_id": project_id}}
        state_snapshot = project_graphs[project_id].get_state(config)
        if state_snapshot.values:
            return {
                "project_id": project_id,
                "values": state_snapshot.values,
                "next_nodes": state_snapshot.next,
            }

    proj = project_manager.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    return {
        "project_id": project_id,
        "values": proj.state_snapshot,
        "checkpoint": proj.checkpoint_data,
        "next_nodes": [],
    }


@app.get("/api/projects/{project_id}/export")
def get_project_export(project_id: str):
    """Retrieve exported package manifest for a project."""
    pkg_dir = project_manager.get_package_dir(project_id)
    manifest_path = pkg_dir / "manifest.json"
    if not manifest_path.exists():
        manifest_path = Path("game_package") / "manifest.json"
        if not manifest_path.exists():
            raise HTTPException(status_code=404, detail=f"No export package found for '{project_id}'")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    return manifest


@app.post("/api/projects/{project_id}/export/twine")
def export_project_to_twine(project_id: str):
    """Executes the Twine export pipeline step for an existing project."""
    from pipeline.tools.twine_pipeline_step import twine_export_step
    try:
        res = twine_export_step.execute_for_existing_project(project_id)
        record_log("INFO", "API", f"Executed Twine export step for project '{project_id}' ({res['passages_count']} passages).")
        return {"success": True, **res}
    except Exception as e:
        record_log("ERROR", "API", f"Failed executing Twine export step for project '{project_id}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pipeline/step/twine")
def run_twine_export_pipeline_step(payload: dict[str, Any]):
    """Executes the Twine export pipeline step for new/in-memory or active pipeline project state."""
    from pipeline.tools.twine_pipeline_step import twine_export_step
    try:
        res = twine_export_step.run_step(payload)
        record_log("INFO", "API", f"Executed Twine export pipeline step ({res.get('passages_count', 0)} passages).")
        return {"success": True, **res}
    except Exception as e:
        record_log("ERROR", "API", f"Failed running Twine export pipeline step: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/export/twine")
def get_project_twine_status(project_id: str):
    """Checks Twine export status and availability for a project."""
    pdir = project_manager._get_project_dir(project_id)
    twine_dir = pdir / "twine"
    pkg_twine = pdir / "game_package" / "twine"

    target_dir = twine_dir if twine_dir.exists() else pkg_twine
    has_twee = (target_dir / "story.twee").exists()
    has_html = (target_dir / "story.html").exists()

    twee_size = (target_dir / "story.twee").stat().st_size if has_twee else 0
    html_size = (target_dir / "story.html").stat().st_size if has_html else 0

    return {
        "project_id": project_id,
        "has_twine": has_twee and has_html,
        "twee_available": has_twee,
        "html_available": has_html,
        "twee_size_bytes": twee_size,
        "html_size_bytes": html_size,
        "twine_dir": str(target_dir) if (has_twee or has_html) else None,
    }


@app.get("/api/projects/{project_id}/export/twine/content")
def get_project_twine_content(project_id: str, format: str = "twee"):
    """Fetch content of story.twee or story.html for preview."""
    from fastapi.responses import Response
    pdir = project_manager._get_project_dir(project_id)
    twine_dir = pdir / "twine"
    if not twine_dir.exists():
        twine_dir = pdir / "game_package" / "twine"

    filename = "story.twee" if format.lower() == "twee" else "story.html"
    target_file = twine_dir / filename
    if not target_file.exists():
        raise HTTPException(status_code=404, detail=f"Twine file '{filename}' not found for project '{project_id}'")

    with open(target_file, "r", encoding="utf-8") as f:
        content = f.read()

    media_type = "text/plain; charset=utf-8" if format.lower() == "twee" else "text/html; charset=utf-8"
    return Response(content=content, media_type=media_type)


@app.post("/api/projects/export/twine/all")
def export_all_projects_to_twine():
    """Batch exports all existing projects to Twine using the Twine export pipeline step."""
    results = project_manager.export_all_projects_twine()
    record_log("INFO", "API", f"Batch executed Twine export step for {len(results)} projects.")
    return {"success": True, "count": len(results), "results": results}



@app.get("/api/pipeline/state/{thread_id}")
def get_state(thread_id: str):
    """Retrieve the current state snapshot for a given session or project."""
    config = {"configurable": {"thread_id": thread_id}}
    state_snapshot = pipeline_graph.get_state(config)
    if state_snapshot.values:
        return {
            "thread_id": thread_id,
            "values": state_snapshot.values,
            "next_nodes": state_snapshot.next,
        }

    # Fallback to checking project_manager for this id
    proj = project_manager.get_project(thread_id)
    if proj and proj.state_snapshot:
        return {
            "thread_id": thread_id,
            "values": proj.state_snapshot,
            "next_nodes": [],
        }

    raise HTTPException(status_code=404, detail="Thread not found")


# ─── Portrait Studio Endpoints ────────────────────────────────────────────────

class GeneratePromptsRequest(BaseModel):
    project_id: str
    character_id: str | None = None
    include_npcs: bool = True


class ComfyUITestRequest(BaseModel):
    comfyui_url: str = "http://127.0.0.1:8005"


class ComfyUIGenerateRequest(BaseModel):
    project_id: str
    character_id: str
    portrait_prompt: str
    comfyui_url: str = "http://127.0.0.1:8005"
    workflow_json: dict[str, Any]
    prompt_node_id: str = "6"
    output_node_id: str = "9"
    is_npc: bool = False


class UpdatePortraitRequest(BaseModel):
    project_id: str
    character_id: str
    portrait_url: str | None = None
    portrait_gallery: list[str] | None = None
    portrait_prompt: str | None = None
    action: str | None = None  # "set_active", "delete_image", "add_image"
    target_image_url: str | None = None
    is_npc: bool = False


@app.post("/api/portraits/comfyui/test-connection")
async def comfyui_test_connection(req: ComfyUITestRequest):
    """Test connection to a local ComfyUI instance from backend to bypass browser CORS limitations."""
    import httpx
    target_url = req.comfyui_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.get(f"{target_url}/system_stats")
            if resp.status_code == 200:
                stats = resp.json()
                comfy_ver = stats.get("system", {}).get("comfyui_version", "unknown")
                devices = stats.get("devices", [])
                device_names = [d.get("name") for d in devices if isinstance(d, dict) and d.get("name")]
                dev_str = f" ({', '.join(device_names)})" if device_names else ""
                record_log("INFO", "Portrait", f"Connected to ComfyUI at {target_url}: v{comfy_ver}{dev_str}")
                return {
                    "status": "ok",
                    "version": comfy_ver,
                    "message": f"Connected to ComfyUI v{comfy_ver}{dev_str}",
                    "stats": stats,
                }
            else:
                raise HTTPException(status_code=502, detail=f"ComfyUI returned HTTP {resp.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        record_log("WARNING", "Portrait", f"ComfyUI connection test failed for {target_url}: {e}")
        raise HTTPException(status_code=502, detail=f"Cannot reach ComfyUI at {target_url}: {str(e)}")


def convert_ui_to_api_workflow(ui_data: dict[str, Any], object_info: dict[str, Any] | None = None) -> tuple[dict[str, Any], str | None, str | None]:
    """Convert ComfyUI UI format ({nodes: [...], links: [...]}) to execution prompt API format."""
    nodes = {n["id"]: n for n in ui_data.get("nodes", []) if isinstance(n, dict) and "id" in n}
    links = {l[0]: l for l in ui_data.get("links", []) if isinstance(l, list) and len(l) >= 5}
    obj_info = object_info or {}
    
    prompt = {}
    detected_prompt_node = None
    detected_output_node = None
    ignored = {"Note", "MarkdownNote", "Label (rgthree)", "PrimitiveInt", "Reroute"}
    
    for nid, node in nodes.items():
        ntype = node.get("type", "")
        if ntype in ignored:
            continue
            
        schema = obj_info.get(ntype, {})
        inputs = {}
        
        # 1. Linked inputs
        for inp in node.get("inputs", []):
            link_id = inp.get("link")
            if link_id and link_id in links:
                l = links[link_id]
                origin_id = str(l[1])
                origin_slot = l[2]
                inputs[inp["name"]] = [origin_id, origin_slot]
                
        # 2. Widgets
        wvals = node.get("widgets_values", [])
        req_inputs = schema.get("input", {}).get("required", {})
        opt_inputs = schema.get("input", {}).get("optional", {})
        all_spec = {**req_inputs, **opt_inputs}
        widget_names = [k for k in all_spec.keys() if k not in inputs]
        
        if isinstance(wvals, list):
            for idx, val in enumerate(wvals):
                if idx < len(widget_names):
                    inputs[widget_names[idx]] = val
        elif isinstance(wvals, dict):
            inputs.update(wvals)
            
        str_nid = str(nid)
        prompt[str_nid] = {"class_type": ntype, "inputs": inputs}
        
        if ntype == "CLIPTextEncode" and detected_prompt_node is None:
            detected_prompt_node = str_nid
        if ntype in ("SaveImage", "ImageSave") and detected_output_node is None:
            detected_output_node = str_nid
            
    return prompt, detected_prompt_node, detected_output_node


@app.post("/api/portraits/generate-prompts")
async def generate_portrait_prompts(req: GeneratePromptsRequest):
    """Generate Stable Diffusion portrait prompts for all characters (and optionally NPCs) via LLM."""
    record_log("INFO", "Portrait", f"Generating portrait prompts for project {req.project_id}")
    try:
        proj = project_manager.get_project(req.project_id)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        
        snapshot = proj.state_snapshot or {}
        if not isinstance(snapshot, dict) and hasattr(snapshot, "model_dump"):
            snapshot = snapshot.model_dump()
        characters = snapshot.get("characters", [])
        npcs = snapshot.get("world_bible", {}).get("npcs", []) if req.include_npcs else []
        
        story_arc = snapshot.get("story_arc", {})
        genre = story_arc.get("genre", "fantasy")
        tone = story_arc.get("tone", "cinematic")
        
        client = get_llm_client()
        results = []
        
        is_explicit = bool(snapshot.get("is_explicit", False) or getattr(proj, "is_explicit", False))

        def make_char_prompt(entity: dict, entity_type: str) -> str:
            """Call LLM to generate an ultra-detailed, photorealistic casting portrait prompt for a character."""
            name = entity.get("name", "Unknown")
            role = entity.get("role", "neutral")
            backstory = str(entity.get("backstory", entity.get("personality", "")))
            flaw = str(entity.get("flaw", ""))
            motivation = str(entity.get("motivation", ""))
            dialogue_voice = str(entity.get("dialogue_voice", ""))
            
            system = (
                "You are an expert casting director and high-fashion/cinematic portrait prompt engineer for advanced AI image generators (Krea, Flux, SDXL).\n"
                "Your objective is to write an ultra-detailed, photorealistic casting portrait prompt for a story character, following this exact professional format, depth, and cadence:\n\n"
                "--- REFERENCE TARGET STYLE ---\n"
                "Professional Medium shot photo of a 21 y tall Indian curvy Falguni, She has a little fat around her waist and wider hips with a large bust.  \n"
                "She is wearing a medallion earrings , eyeliner, neutral red lipstick.  glasses \n"
                "chiffon  casual  A tunic top with a wide boat neck and three-quarter dolman sleeves that taper to ribbed cuffs. Side slits climb from the hem, which is adorned with an embroidered geometric border in contrasting thread. The relaxed, thigh-length fit drapes loosely and pairs perfectly with leggings or skinny jeans.  paired with a contrasting Straight-leg leather trousers with a soft, buttery hand-feel. Subtle pin-tucks run down the front of the leg, and exposed ankle zippers add an edge. The high-rise, cigarette-style fit is slim without being tight, offering a sleek rock-and-roll alternative to denim.    . soft expression and golden choker style necklace.\n\n"
                "With neat professional black A tiny, tight coil of wet hair clings to itself at the back of the head, unpinned and slowly drying into a flat, heatless wave that will release with soft bends later. hair.\n \n"
                "standing straight and posing for a casting photo against a flat white background. Soft studio light highlighting the skin of the model.\n"
                "--- END REFERENCE ---\n\n"
                "STRUCTURE TO FOLLOW:\n"
                "1. Opening sentence: 'Professional Medium shot photo of a [estimated age] y [height/build/heritage/physique] [Name], [concrete physical and anatomical description including body shape, waist, hips, shoulders, facial structure, skin texture, and posture].'\n"
                "2. Face & Accessories: Distinct jewelry (earrings, necklaces, choker), makeup/grooming, glasses/eyewear, and facial expression.\n"
                "3. Garment & Wardrobe Architecture: Deeply tactile clothing description matching the story genre/character role. Name specific textile fabrics (e.g. chiffon, raw silk, distressed leather, heavy wool, tailored cotton, synth-leather), specific cuts, necklines, sleeves, hems, embroideries, draping, and paired bottoms (trousers, skirts, boots) with textural descriptors (zippers, pin-tucks, stitch details).\n"
                "4. Hair Architecture: Tactile description of hair color, strand texture, styling, how it falls, coils, or is pinned/unpinned.\n"
                "5. Setting & Studio Lighting: 'standing straight and posing for a casting photo against a flat white background. Soft studio light highlighting the skin of the model.' (or genre-appropriate clean studio backdrop lighting).\n"
                + ("\nNote: Explicit mode is active. You may include sensual, mature, or form-fitting physical descriptors as appropriate for the character.\n" if is_explicit else "") +
                "\nOutput ONLY the raw prompt text. No markdown, no quotation marks, no preamble or explanation."
            )

            user = (
                f"Story Genre: {genre}\n"
                f"Story Tone: {tone}\n"
                f"Character Name: {name}\n"
                f"Role: {role}\n"
                f"Backstory & Persona: {backstory}\n"
                f"Character Flaw: {flaw}\n"
                f"Motivation: {motivation}\n"
                f"Dialogue Voice: {dialogue_voice}\n\n"
                f"Generate the complete casting portrait prompt for {name}:"
            )
            
            result = client.test_call(prompt=user, system_prompt=system, temperature=0.7, max_tokens=550, json_mode=False)
            return result.get("response", "").strip() if result.get("success") else ""
        
        # Determine which entities to generate for
        target_char_id = req.character_id
        entities_to_process: list[tuple[dict, str]] = []
        
        if target_char_id:
            char_matches = [c for c in characters if c.get("id") == target_char_id]
            npc_matches = [n for n in npcs if n.get("id") == target_char_id]
            if char_matches:
                entities_to_process.append((char_matches[0], "character"))
            elif npc_matches:
                entities_to_process.append((npc_matches[0], "npc"))
        else:
            for c in characters:
                entities_to_process.append((c, "character"))
            if req.include_npcs:
                for n in npcs:
                    entities_to_process.append((n, "npc"))

        # Run prompt generation concurrently in parallel via asyncio.gather
        async def run_entity(entity: dict, entity_type: str) -> dict:
            prompt_text = await asyncio.to_thread(make_char_prompt, entity, entity_type)
            return {
                "id": entity.get("id"),
                "name": entity.get("name"),
                "type": entity_type,
                "portrait_prompt": prompt_text,
            }

        results = await asyncio.gather(*[run_entity(e, t) for e, t in entities_to_process])

        # Save generated prompts back to project state snapshot so they persist
        state = dict(snapshot)
        prompt_map = {r["id"]: r["portrait_prompt"] for r in results if r.get("portrait_prompt")}
        if prompt_map:
            chars = list(state.get("characters", []))
            for c in chars:
                if c.get("id") in prompt_map:
                    c["portrait_prompt"] = prompt_map[c["id"]]
            state["characters"] = chars
            
            wb = dict(state.get("world_bible", {}))
            npcs_list = list(wb.get("npcs", []))
            for n in npcs_list:
                if n.get("id") in prompt_map:
                    n["portrait_prompt"] = prompt_map[n["id"]]
            wb["npcs"] = npcs_list
            state["world_bible"] = wb
            
            project_manager.save_project_state(req.project_id, state)

        record_log("INFO", "Portrait", f"Generated {len(results)} portrait prompts")
        return {"prompts": results}
    
    except HTTPException:
        raise
    except Exception as e:
        record_log("ERROR", "Portrait", f"Failed to generate prompts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/portraits/comfyui/generate")
async def comfyui_generate_portrait(req: ComfyUIGenerateRequest):
    """Proxy a portrait generation request to a local ComfyUI instance."""
    import httpx, uuid
    
    record_log("INFO", "Portrait", f"ComfyUI generation for {req.character_id} via {req.comfyui_url}")
    
    try:
        workflow = dict(req.workflow_json)
        prompt_node_id = str(req.prompt_node_id)
        output_node_id = str(req.output_node_id)
        
        # If UI format ({nodes: [...], links: [...]}), convert to API prompt format
        if "nodes" in workflow and isinstance(workflow.get("nodes"), list):
            record_log("INFO", "Portrait", "Converting ComfyUI UI format to API prompt format")
            obj_info = {}
            try:
                async with httpx.AsyncClient(timeout=10.0) as http:
                    obj_res = await http.get(f"{req.comfyui_url}/object_info")
                    if obj_res.status_code == 200:
                        obj_info = obj_res.json()
            except Exception as e:
                record_log("WARNING", "Portrait", f"Failed to fetch object_info: {e}")
            workflow, auto_p, auto_o = convert_ui_to_api_workflow(workflow, obj_info)
            if auto_p and prompt_node_id not in workflow:
                prompt_node_id = auto_p
            if auto_o and output_node_id not in workflow:
                output_node_id = auto_o

        # Inject prompt into workflow
        if prompt_node_id in workflow:
            if "inputs" in workflow[prompt_node_id]:
                workflow[prompt_node_id]["inputs"]["text"] = req.portrait_prompt
        else:
            # Fallback: find first CLIPTextEncode node
            for nid, ndata in workflow.items():
                if isinstance(ndata, dict) and ndata.get("class_type") == "CLIPTextEncode":
                    ndata.setdefault("inputs", {})["text"] = req.portrait_prompt
                    prompt_node_id = nid
                    break
        
        client_id = str(uuid.uuid4())
        payload = {"prompt": workflow, "client_id": client_id}
        
        async with httpx.AsyncClient(timeout=30.0) as http:
            # Submit prompt
            resp = await http.post(f"{req.comfyui_url}/prompt", json=payload)
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"ComfyUI rejected prompt: {resp.text}")
            
            prompt_id = resp.json().get("prompt_id")
            if not prompt_id:
                raise HTTPException(status_code=502, detail="ComfyUI did not return a prompt_id")
            
            # Poll for completion (max 180s, 2s intervals)
            for attempt in range(90):
                await asyncio.sleep(2)
                hist_resp = await http.get(f"{req.comfyui_url}/history/{prompt_id}")
                if hist_resp.status_code == 200:
                    history = hist_resp.json()
                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})
                        # Find output image from output node or any output node with images
                        output_node_data = outputs.get(output_node_id, {})
                        images = output_node_data.get("images", [])
                        if not images:
                            for nid, ndata in outputs.items():
                                if isinstance(ndata, dict) and ndata.get("images"):
                                    images = ndata["images"]
                                    break
                        if images:
                            img_info = images[0]
                            filename = img_info.get("filename")
                            subfolder = img_info.get("subfolder", "")
                            
                            # Download the image
                            img_url = f"{req.comfyui_url}/view?filename={filename}&subfolder={subfolder}&type=output"
                            img_resp = await http.get(img_url)
                            
                            if img_resp.status_code == 200:
                                # Save to project portraits directory with timestamp to preserve history
                                portraits_dir = Path(project_manager._get_project_dir(req.project_id)) / "portraits"
                                portraits_dir.mkdir(parents=True, exist_ok=True)
                                
                                timestamp_sec = int(datetime.datetime.now().timestamp())
                                filename_saved = f"{req.character_id}_{timestamp_sec}.png"
                                img_path = portraits_dir / filename_saved
                                img_path.write_bytes(img_resp.content)
                                
                                portrait_url = f"/api/projects/{req.project_id}/portraits/{filename_saved}"
                                gallery_result = []
                                
                                # Persist portrait URL and append to gallery in state snapshot
                                proj = project_manager.get_project(req.project_id)
                                if proj and proj.state_snapshot:
                                    state = dict(proj.state_snapshot)
                                    target_list = list(state.get("world_bible", {}).get("npcs", [])) if req.is_npc else list(state.get("characters", []))
                                    for entity in target_list:
                                        if entity.get("id") == req.character_id:
                                            # Existing gallery
                                            gallery = list(entity.get("portrait_gallery") or [])
                                            # If previous portrait_url was set, ensure it's in gallery
                                            prev_url = entity.get("portrait_url")
                                            if prev_url and prev_url not in gallery:
                                                gallery.append(prev_url)
                                            # Add newly generated portrait
                                            if portrait_url not in gallery:
                                                gallery.append(portrait_url)
                                            
                                            entity["portrait_url"] = portrait_url
                                            entity["portrait_gallery"] = gallery
                                            gallery_result = gallery
                                            if req.portrait_prompt:
                                                entity["portrait_prompt"] = req.portrait_prompt
                                    
                                    if req.is_npc:
                                        wb = dict(state.get("world_bible", {}))
                                        wb["npcs"] = target_list
                                        state["world_bible"] = wb
                                    else:
                                        state["characters"] = target_list
                                    project_manager.save_project_state(req.project_id, state)
                                
                                record_log("INFO", "Portrait", f"Portrait saved for {req.character_id} ({filename_saved})")
                                return {
                                    "character_id": req.character_id,
                                    "portrait_url": portrait_url,
                                    "portrait_gallery": gallery_result,
                                    "status": "complete",
                                }
            
            raise HTTPException(status_code=504, detail="ComfyUI timed out after 180 seconds")
    
    except HTTPException:
        raise
    except Exception as e:
        record_log("ERROR", "Portrait", f"ComfyUI generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/portraits/update")
async def update_portrait(req: UpdatePortraitRequest):
    """Manually update portrait URL, gallery, or prompt for a character or NPC."""
    try:
        proj = project_manager.get_project(req.project_id)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        state = dict(proj.state_snapshot or {})
        
        target_list = list(state.get("world_bible", {}).get("npcs", [])) if req.is_npc else list(state.get("characters", []))
        updated_portrait_url = None
        updated_gallery = []
        
        for entity in target_list:
            if entity.get("id") == req.character_id:
                gallery = list(entity.get("portrait_gallery") or [])
                prev_url = entity.get("portrait_url")
                if prev_url and prev_url not in gallery:
                    gallery.append(prev_url)
                
                if req.action == "set_active" and req.target_image_url:
                    entity["portrait_url"] = req.target_image_url
                    if req.target_image_url not in gallery:
                        gallery.append(req.target_image_url)
                elif req.action == "delete_image" and req.target_image_url:
                    if req.target_image_url in gallery:
                        gallery.remove(req.target_image_url)
                    if entity.get("portrait_url") == req.target_image_url:
                        entity["portrait_url"] = gallery[0] if gallery else None
                elif req.action == "add_image" and req.target_image_url:
                    if req.target_image_url not in gallery:
                        gallery.append(req.target_image_url)
                    entity["portrait_url"] = req.target_image_url
                else:
                    if req.portrait_url is not None:
                        entity["portrait_url"] = req.portrait_url
                        if req.portrait_url and req.portrait_url not in gallery:
                            gallery.append(req.portrait_url)
                    if req.portrait_gallery is not None:
                        gallery = req.portrait_gallery
                
                entity["portrait_gallery"] = gallery
                if req.portrait_prompt is not None:
                    entity["portrait_prompt"] = req.portrait_prompt
                
                updated_portrait_url = entity.get("portrait_url")
                updated_gallery = gallery
        
        if req.is_npc:
            wb = dict(state.get("world_bible", {}))
            wb["npcs"] = target_list
            state["world_bible"] = wb
        else:
            state["characters"] = target_list
            
        project_manager.save_project_state(req.project_id, state)
        return {
            "status": "ok",
            "character_id": req.character_id,
            "portrait_url": updated_portrait_url,
            "portrait_gallery": updated_gallery,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/portraits/{filename}")
async def serve_portrait(project_id: str, filename: str):
    """Serve a generated portrait image file."""
    from fastapi.responses import FileResponse
    portraits_dir = Path(project_manager._get_project_dir(project_id)) / "portraits"
    img_path = portraits_dir / filename
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Portrait not found")
    return FileResponse(str(img_path))


# Mount built Designer UI frontend if dist directory exists
import os
from fastapi.staticfiles import StaticFiles

designer_dist = os.path.join(os.path.dirname(__file__), "..", "..", "designer", "dist")
if os.path.exists(designer_dist):
    app.mount("/", StaticFiles(directory=designer_dist, html=True), name="designer")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("pipeline.api.server:app", host="127.0.0.1", port=8000, reload=True)
