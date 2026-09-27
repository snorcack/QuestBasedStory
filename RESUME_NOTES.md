# QuestForge Session Resume Notes

> **Saved On:** 2026-09-25  
> **Conversation ID:** `9d45c049-d813-40f7-abbe-15356bb27ed8`  
> **Workspace Root:** `k:/AI/QuestBasedStory`

---

## 1. Running the Services

| Service | Address | Start Command |
|---|---|---|
| **Python Backend** | `http://127.0.0.1:8000` | `python -m uvicorn pipeline.api.server:app --port 8000 --reload` |
| **Designer Frontend** | `http://localhost:5173` | `cd designer && npm run dev` |
| **ComfyUI (Local)** | `http://127.0.0.1:8005` | Started locally (verified on RTX 3060 Ti, v0.37.0) |

---

## 2. Key Architecture & Features Completed in This Thread

### A. "Play Novel" Interactive Reader (`designer/src/components/play/NovelPlayer.tsx`)
- **Step-by-Step Traversal**: Speaker nodes require explicit clicks to advance.
- **Quest Tracking**: Flag-driven branching display showing active/completed quest states.
- **Chapter Jumping**: Dedicated config modal allowing player to adjust traits/inventory before jumping to any chapter.
- **Ephemeral Sessions**: Playthrough progress is stored in local component state.

### B. Portrait Studio & ComfyUI Generation (`PortraitStudio.tsx`)
- **Backend ComfyUI Proxy**: Solves browser CORS limitations via `/api/portraits/comfyui/test-connection` and `/generate`.
- **Workflow Format Converter** (`pipeline/api/server.py`): Converts ComfyUI UI format (`nodes`, `links`) into API execution graph format (`class_type`, `inputs`).
- **Ultra-Detailed Casting Prompts**: Generates photorealistic casting-style prompts (age, build, heritage, anatomical proportions, tactile wardrobe architecture, jewelry, hair architecture, studio lighting) matching user's reference format.
- **Multi-Image Character Gallery**: Added `portrait_gallery: list[str]` to Character and NPC schemas, allowing multiple portraits per character.
- **Full-Screen Lightbox Modal** (`PortraitLightbox.tsx`): High-res enlargement with keyboard navigation (arrows/esc), thumbnail reel, "Set as Primary", prompt drawer, image download, and deletion.

### C. Performance & Latency Optimizations
- **Targeted Single-Entity Generation**: `PortraitStudio.tsx` passes `character_id: id` so "Regen Prompt" only calls the LLM for that character instead of triggering the whole cast (dropped from ~75s to ~7s).
- **Parallelized Batch Generation**: In `server.py`, batch generation runs concurrently via `asyncio.gather(*[asyncio.to_thread(...)])` across all characters and NPCs simultaneously (~7.5s total batch time).
- **OAuth2 & HTTP Session Reuse**: `pipeline/tools/llm_client.py` caches Google OAuth credentials and reuses a persistent `requests.Session()` with connection pooling.

---

## 3. Important Files & Locations

- **Prompt Generator & ComfyUI Endpoints**: [`pipeline/api/server.py`](file:///k:/AI/QuestBasedStory/pipeline/api/server.py#L520-L760)
- **LLM Client & Auth**: [`pipeline/tools/llm_client.py`](file:///k:/AI/QuestBasedStory/pipeline/tools/llm_client.py)
- **Portrait Studio View**: [`designer/src/components/play/PortraitStudio.tsx`](file:///k:/AI/QuestBasedStory/designer/src/components/play/PortraitStudio.tsx)
- **Lightbox Component**: [`designer/src/components/play/PortraitLightbox.tsx`](file:///k:/AI/QuestBasedStory/designer/src/components/play/PortraitLightbox.tsx)
- **Novel Player View**: [`designer/src/components/play/NovelPlayer.tsx`](file:///k:/AI/QuestBasedStory/designer/src/components/play/NovelPlayer.tsx)
- **TypeScript Types**: [`designer/src/types/index.ts`](file:///k:/AI/QuestBasedStory/designer/src/types/index.ts)
- **Data Models**: [`pipeline/models/character.py`](file:///k:/AI/QuestBasedStory/pipeline/models/character.py) & [`pipeline/models/world.py`](file:///k:/AI/QuestBasedStory/pipeline/models/world.py)

---

## 4. Current State & Where We Left Off

- Both frontend (`npm run build`) and backend (`python -m py_compile`) compile with **0 errors**.
- Prompt generation is tuned, fast, and tested.
- ComfyUI workflow JSON import and direct image generation proxy are fully wired up.
- Active reference file open in user downloads: `cast_image_prompts.json`.
- When resuming, simply load this project or reference `RESUME_NOTES.md` and conversation ID `9d45c049-d813-40f7-abbe-15356bb27ed8`.
