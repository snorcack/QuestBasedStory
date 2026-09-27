"""Terminal-based Checkpoint Reviewer CLI for QuestForge."""
import os
import sys
import json
import argparse
from typing import Any
from langgraph.types import Command

from pipeline.graph.pipeline import build_questforge_graph, get_default_sqlite_checkpointer
from pipeline.models.context import StageEnum


def print_banner():
    print("=" * 70)
    print("                 QUESTFORGE NARRATIVE ENGINE")
    print("            Interactive Story Spine Authoring System")
    print("=" * 70)


def format_checkpoint_payload(checkpoint_num: int, payload: Any):
    print("\n" + "#" * 70)
    print(f"               CHECKPOINT {checkpoint_num} REVIEW")
    print("#" * 70 + "\n")

    if checkpoint_num == 1:
        arc = payload.get("story_arc", {})
        traits = payload.get("trait_vocabulary", [])
        print(f"TITLE:    {arc.get('title')}")
        print(f"GENRE:    {arc.get('genre')} | TONE: {arc.get('tone')}")
        print(f"THEMES:   {', '.join(arc.get('themes', []))}\n")
        print("PROTAGONIST:")
        print(f"  {arc.get('protagonist_sketch')}\n")
        print("ANTAGONIST:")
        print(f"  {arc.get('antagonist_sketch')}\n")
        print("CENTRAL CONFLICT:")
        print(f"  {arc.get('central_conflict')}\n")
        print("3-ACT STRUCTURE:")
        for act in arc.get("acts", []):
            print(f"  Act {act.get('act_number')}: {act.get('title')}")
            print(f"    {act.get('summary')}")
        print("\nEMERGENT TRAITS (Max 2):")
        for t in traits:
            print(f"  • {t.get('name')} [{t.get('color_hex')}]: {t.get('description')}")

    elif checkpoint_num == 2:
        contracts = payload.get("chapter_contracts", [])
        print(f"TOTAL CHAPTER CONTRACTS: {len(contracts)}\n")
        for c in contracts:
            print(f"[{c.get('chapter_id')}] (Order: {c.get('order')}) - {c.get('title')}")
            print(f"  Scope:       {c.get('narrative_scope')}")
            entry = c.get('entry_state', {})
            exit_st = c.get('exit_state', {})
            print(f"  Entry:       Loc: {entry.get('location')} | Traits: {entry.get('trait_snapshot')} | Inv: {entry.get('inventory')}")
            print(f"  Exit:        Loc: {exit_st.get('location')} | Traits: {exit_st.get('trait_snapshot')} | Flags: {exit_st.get('active_flags')}")
            slots = c.get("attachment_points", [])
            print(f"  Side Slots:  {len(slots)} open attachment point(s)\n")

    elif checkpoint_num == 3:
        transitions = payload.get("transitions", [])
        print(f"TOTAL CHAPTER TRANSITIONS: {len(transitions)}\n")
        for t in transitions:
            print(f"TRANSITION: {t.get('from_chapter_id')} ──► {t.get('to_chapter_id')}")
            print(f"  Summary: {t.get('scene_summary')}")
            print(f"  Hook:    \"{t.get('narrative_hook')}\"")
            print(f"  Delta:   {t.get('state_delta')}\n")

    elif checkpoint_num == 4:
        chapters = payload if isinstance(payload, list) else []
        print(f"AUTHORED CHAPTERS: {len(chapters)}")
        for ch in chapters:
            print(f"Chapter ID: {ch.get('chapter_id')} | Critic Score: {ch.get('critic_score')}")

    elif checkpoint_num == 5:
        quests = payload if isinstance(payload, list) else []
        print(f"TOTAL QUESTS: {len(quests)}")
        for q in quests:
            print(f"[{q.get('type')}] {q.get('title')} (Loc: {q.get('location_id')})")

    print("-" * 70)


def run_cli_session(session_id: str, seed: str | None = None, auto_approve: bool = False):
    print_banner()
    db_path = os.getenv("CHECKPOINT_DB_PATH", ".checkpoints/pipeline.sqlite")
    checkpointer = get_default_sqlite_checkpointer(db_path)
    graph = build_questforge_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": session_id}}

    state = graph.get_state(config)

    # If new session, initiate
    if not state.values:
        story_seed = seed or "A detective in a dying city uncovers a conspiracy that reaches into her own past."
        print(f"\n[INIT] Starting new session: '{session_id}'")
        print(f"[SEED] \"{story_seed}\"\n")
        graph.invoke({"story_seed": story_seed}, config=config)
    else:
        print(f"\n[RESUME] Continuing existing session: '{session_id}'")

    while True:
        state = graph.get_state(config)

        # Check if paused at an interrupt
        if not state.tasks or not state.tasks[0].interrupts:
            print(f"\n[PIPELINE COMPLETE] Reached final stage: {state.values.get('current_stage')}")
            break

        interrupt_data = state.tasks[0].interrupts[0].value
        cp_num = interrupt_data.get("checkpoint", 0)
        payload = interrupt_data.get("payload", {})

        format_checkpoint_payload(cp_num, payload)

        if auto_approve:
            print(f"[AUTO-APPROVE] Checkpoint {cp_num} approved automatically.")
            graph.invoke(Command(resume={"action": "approve"}), config=config)
            continue

        while True:
            choice = input("\nAction: [A]pprove / [R]egenerate with notes / [E]dit / [Q]uit: ").strip().lower()
            if choice == "a":
                print(f"[ACTION] Checkpoint {cp_num} approved.")
                graph.invoke(Command(resume={"action": "approve"}), config=config)
                break
            elif choice == "r":
                notes = input("Enter directional notes for regeneration: ").strip()
                print(f"[ACTION] Regenerating with notes: \"{notes}\"...")
                graph.invoke(Command(resume={"action": "regenerate", "notes": notes}), config=config)
                break
            elif choice == "e":
                new_title = input("Enter new title: ").strip()
                override = {}
                if cp_num == 1 and new_title:
                    story_arc = payload.get("story_arc", {})
                    story_arc["title"] = new_title
                    override = {"story_arc": story_arc}
                print(f"[ACTION] Updating state and approving...")
                graph.invoke(Command(resume={"action": "edit", "override_data": override}), config=config)
                break
            elif choice == "q":
                print(f"\n[PAUSED] Session saved to disk ({db_path}).")
                print(f"To resume later, run: python -m pipeline.cli --resume {session_id}")
                return
            else:
                print("Invalid selection. Choose A, R, E, or Q.")


def list_projects_cli():
    from pipeline.tools.project_manager import get_project_manager
    pm = get_project_manager()
    projects = pm.list_projects()
    print("\n" + "=" * 70)
    print("                 QUESTFORGE SAVED STORY PROJECTS")
    print("=" * 70)
    if not projects:
        print("No saved projects found.")
        return
    for p in projects:
        export_tag = "[EXPORTED]" if p.has_export else ""
        print(f"• [{p.id}] {p.title} ({p.genre}) {export_tag}")
        print(f"  Stage: {p.current_stage} | Status: {p.status} | Chapters: {p.chapter_count} | Quests: {p.quest_count}")
        print(f"  Seed:  \"{p.story_seed[:65]}...\"")
        print(f"  Last updated: {p.updated_at[:19]}\n")


def main():
    parser = argparse.ArgumentParser(description="QuestForge Terminal Checkpoint Reviewer")
    parser.add_argument("--list-projects", action="store_true", help="List all saved story projects")
    parser.add_argument("--export-twine", default=None, metavar="PROJECT_ID", help="Export a specific project to Twine (.twee & .html)")
    parser.add_argument("--export-all-twine", action="store_true", help="Export all existing projects to Twine")
    parser.add_argument("--project", default=None, help="Project ID or title to open or resume")
    parser.add_argument("--session-id", default=None, help="Session ID thread")
    parser.add_argument("--seed", default=None, help="Initial story seed")
    parser.add_argument("--resume", default=None, help="Resume an existing session ID or project")
    parser.add_argument("--auto-approve", action="store_true", help="Auto approve all checkpoints (test mode)")

    args = parser.parse_args()

    if args.list_projects:
        list_projects_cli()
        return

    if args.export_all_twine:
        from pipeline.tools.twine_pipeline_step import twine_export_step
        from pipeline.tools.project_manager import get_project_manager
        pm = get_project_manager()
        print("\n=== [Twine Export Step] Batch exporting all existing projects ===")
        results = pm.export_all_projects_twine()
        print(f"\n[DONE] Twine export step completed for {len(results)} project(s).")
        return

    if args.export_twine:
        from pipeline.tools.twine_pipeline_step import twine_export_step
        print(f"\n=== [Twine Export Step] Exporting project '{args.export_twine}' ===")
        res = twine_export_step.execute_for_existing_project(args.export_twine)
        print(f"[OK] Exported '{res['title']}' ({res['passages_count']} passages)")
        print(f"     Twee 3: {res['twee_file']}")
        print(f"     Twine HTML: {res['html_file']}")
        return

    from pipeline.tools.project_manager import get_project_manager
    pm = get_project_manager()

    target_id = args.project or args.resume or args.session_id
    db_path = None
    seed = args.seed

    if target_id:
        proj = pm.get_project(target_id)
        if proj:
            db_path = pm.get_sqlite_path(target_id)
            if not seed:
                seed = proj.story_seed
        else:
            # If creating a new project ID
            if target_id.startswith("proj_"):
                new_proj = pm.create_project(title=target_id, story_seed=seed or "A new mystery begins.")
                db_path = pm.get_sqlite_path(new_proj.id)
                target_id = new_proj.id

    session = target_id or "default-session"
    run_cli_session(session_id=session, seed=seed, auto_approve=args.auto_approve, db_path=db_path)


if __name__ == "__main__":
    main()
