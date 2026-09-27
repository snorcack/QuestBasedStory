"""Twine / Twee 3 Exporter for QuestForge.

Converts QuestForge projects (chapters, scenes, dialogue trees, traits, world bible,
quests) into standard Twee 3 (.twee) and standalone playable Twine 2 HTML (.html) packages.
Fully compatible with Twine 2 desktop/web importer, Tweego, and standalone web playback.
"""

import os
import re
import json
import uuid
import html
from pathlib import Path
from typing import Any


class TwineExporter:
    """Exports QuestForge stories into Twee 3 source files and Twine 2 HTML packages."""

    def __init__(self, projects_dir: str = "projects"):
        self.projects_dir = Path(projects_dir)

    def _sanitize_passage_name(self, name: str) -> str:
        """Sanitizes a string to be a valid Twine passage name."""
        clean = re.sub(r"[\[\]\->|:]", "", name).strip()
        clean = re.sub(r"\s+", " ", clean)
        return clean or "Passage"

    def _slugify(self, text: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9_-]", "_", text.lower().strip())
        slug = re.sub(r"_+", "_", slug).strip("_")
        return slug[:32] or "story"

    def _generate_ifid(self, seed: str) -> str:
        """Generates a stable, standard uppercase UUID IFID for Twine story data."""
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"questforge.{seed}")).upper()

    def build_twee_and_html(
        self,
        story_arc: dict[str, Any],
        chapters: list[dict[str, Any]],
        contracts: list[dict[str, Any]] | None = None,
        transitions: list[dict[str, Any]] | None = None,
        world_bible: dict[str, Any] | None = None,
        characters: list[dict[str, Any]] | None = None,
        traits: list[dict[str, Any]] | None = None,
        quests: list[dict[str, Any]] | None = None,
        achievements: list[dict[str, Any]] | None = None,
        is_explicit: bool = False,
    ) -> tuple[str, str, dict[str, Any]]:
        """Builds both Twee 3 source text and standalone Twine 2 HTML string.

        Returns (twee_text, html_text, stats_dict).
        """
        title = story_arc.get("title") or "QuestForge Story"
        genre = story_arc.get("genre") or "Interactive Fiction"
        tone = story_arc.get("tone") or "Engaging"
        seed_premise = story_arc.get("central_conflict") or story_arc.get("story_seed") or ""
        themes = story_arc.get("themes") or []
        protag = story_arc.get("protagonist_sketch") or ""
        antag = story_arc.get("antagonist_sketch") or ""
        acts = story_arc.get("acts") or []

        contracts = contracts or []
        transitions = transitions or []
        world_bible = world_bible or {}
        characters = characters or []
        traits = traits or story_arc.get("trait_vocabulary") or []
        quests = quests or []
        achievements = achievements or []

        story_ifid = self._generate_ifid(f"{title}_{genre}")

        # Trait variable mapping
        # Maps trait name to harlowe safe variable: e.g. "Impulsiveness" -> "impulsiveness"
        trait_vars: dict[str, str] = {}
        for t in traits:
            name = t.get("name", "Trait")
            var_name = re.sub(r"[^a-zA-Z0-9_]", "", name.lower())
            trait_vars[name] = var_name

        passages: list[dict[str, Any]] = []
        pid_counter = 1

        def add_passage(name: str, tags: list[str], content: str, x: int, y: int) -> int:
            nonlocal pid_counter
            current_pid = pid_counter
            pid_counter += 1
            passages.append({
                "pid": current_pid,
                "name": self._sanitize_passage_name(name),
                "tags": " ".join(tags),
                "content": content.strip(),
                "x": x,
                "y": y,
            })
            return current_pid

        # ─── 1. StoryInit Passage ──────────────────────────────────────────────
        init_lines = [
            ":: StoryInit",
            "(set: $flags to (a:))",
            "(set: $completed_quests to (a:))",
            "(set: $inventory to (a:))",
            "(set: $current_chapter to 1)",
        ]
        for t_name, var in trait_vars.items():
            init_lines.append(f"(set: ${var} to 0)")

        # ─── 2. Header Passage (Harlowe header tag for status display) ─────────
        header_lines = [
            ":: StoryHeader [header]",
            '<div class="qf-status-bar">',
            f'  <span class="qf-badge-title">📖 {title}</span>',
        ]
        if trait_vars:
            trait_chips = []
            for t_name, var in trait_vars.items():
                trait_chips.append(f'{t_name}: <b>(${var})</b>')
            header_lines.append(f'  <span class="qf-badge-traits">🎭 {" | ".join(trait_chips)}</span>')
        header_lines.append('  <span class="qf-badge-quests">⚔️ Quests: <b>(count: $completed_quests)</b></span>')
        header_lines.append('  <span class="qf-links">[[Menu->Codex_Menu]]</span>')
        header_lines.append('</div>\n---')

        # Add StoryInit and StoryHeader passages to passages list
        add_passage("StoryInit", [], "\n".join(init_lines[1:]), 20, 20)
        add_passage("StoryHeader", ["header"], "\n".join(header_lines[1:]), 140, 20)

        # ─── 3. Title Screen Passage ──────────────────────────────────────────
        start_pid = pid_counter
        title_content = []
        title_content.append(f"# {title}")
        title_content.append(f"*{genre}* • *{tone}*\n")
        if is_explicit:
            title_content.append("> [!NOTE]\n> **Content Advisory:** Mature 18+ (Explicit Uncensored Content)\n")

        if seed_premise:
            title_content.append(f"**The Conflict:** {seed_premise}\n")

        if themes:
            theme_str = ", ".join(themes) if isinstance(themes, list) else str(themes)
            title_content.append(f"**Themes:** {theme_str}\n")

        if protag:
            title_content.append(f"**Protagonist:** {protag}\n")
        if antag:
            title_content.append(f"**Antagonist:** {antag}\n")

        if traits:
            title_content.append("### Emergent Character Traits")
            for t in traits:
                t_name = t.get("name", "Trait")
                t_desc = t.get("description", "")
                t_col = t.get("color_hex", "#4A90E2")
                title_content.append(f"* **<span style='color:{t_col}'>{t_name}</span>**: {t_desc}")
            title_content.append("")

        title_content.append("---")
        title_content.append("### Begin Experience")
        first_chapter_target = "Chapter_01_Intro" if (chapters or contracts) else "Story_Conclusion"
        title_content.append(f"[[▶ Begin Story->{first_chapter_target}]]")
        title_content.append("[[📑 Chapter Jump / Selection->Chapter_Select]]")
        title_content.append("[[👥 Dramatis Personae (Cast)->Dramatis_Personae]]")
        title_content.append("[[🗺️ World Codex->World_Codex]]")
        title_content.append("[[🏆 Quest & Achievement Tracker->Quest_Log]]")

        add_passage("Title_Screen", ["title"], "\n".join(title_content), 300, 100)

        # ─── 4. Codex & Utility Passages ───────────────────────────────────────
        # Codex Menu
        codex_menu = [
            "## 📖 Story Codex & Archives",
            "Access detailed world intelligence, cast files, and quest progression records.\n",
            "* [[👥 Cast & Dramatis Personae->Dramatis_Personae]]",
            "* [[🗺️ Locations & Lore Codex->World_Codex]]",
            "* [[⚔️ Active & Completed Quests->Quest_Log]]",
            "* [[🏆 Achievements->Achievements_List]]",
            "* [[📑 Jump to Specific Chapter->Chapter_Select]]",
            "* [[🔙 Return to Title Screen->Title_Screen]]",
        ]
        add_passage("Codex_Menu", ["codex"], "\n".join(codex_menu), 100, 240)

        # Dramatis Personae
        dp_lines = ["## 👥 Dramatis Personae (Cast of Characters)\n"]
        all_chars = list(characters)
        npcs = world_bible.get("npcs", [])
        if all_chars or npcs:
            for c in all_chars:
                c_name = c.get("name", "Unknown")
                c_role = c.get("archetype", c.get("role", "Character"))
                c_desc = c.get("visual_prompt", c.get("appearance", c.get("backstory", "")))
                dp_lines.append(f"### {c_name} *({c_role})*")
                if c_desc:
                    dp_lines.append(f"{c_desc}\n")
            for n in npcs:
                n_name = n.get("name", "Unknown NPC")
                n_role = n.get("role", "NPC")
                n_desc = n.get("summary", n.get("dialogue_hook", ""))
                dp_lines.append(f"### {n_name} *({n_role})*")
                if n_desc:
                    dp_lines.append(f"{n_desc}\n")
        else:
            dp_lines.append("*No character records registered yet.*")
        dp_lines.append("\n---\n[[🔙 Return to Codex Menu->Codex_Menu]] | [[Return to Story->Title_Screen]]")
        add_passage("Dramatis_Personae", ["codex"], "\n".join(dp_lines), 260, 240)

        # World Codex
        wc_lines = ["## 🗺️ World Codex & Setting\n"]
        locations = world_bible.get("locations", [])
        factions = world_bible.get("factions", [])
        lore_items = world_bible.get("lore_items", [])
        if locations:
            wc_lines.append("### Locations")
            for loc in locations:
                wc_lines.append(f"* **{loc.get('name', 'Location')}**: {loc.get('description', '')}")
            wc_lines.append("")
        if factions:
            wc_lines.append("### Factions & Organizations")
            for fac in factions:
                wc_lines.append(f"* **{fac.get('name', 'Faction')}**: {fac.get('ideology', fac.get('description', ''))}")
            wc_lines.append("")
        if lore_items:
            wc_lines.append("### Historical & Cultural Lore")
            for li in lore_items:
                wc_lines.append(f"* **{li.get('topic', 'Lore')}**: {li.get('content', '')}")
            wc_lines.append("")
        if not locations and not factions and not lore_items:
            wc_lines.append("*No world records registered yet.*")
        wc_lines.append("\n---\n[[🔙 Return to Codex Menu->Codex_Menu]] | [[Return to Story->Title_Screen]]")
        add_passage("World_Codex", ["codex"], "\n".join(wc_lines), 420, 240)

        # Quest Log
        ql_lines = ["## ⚔️ Quest Log & Progression\n"]
        if quests:
            for q in quests:
                q_title = q.get("title", "Untitled Quest")
                q_type = q.get("type", "quest")
                q_obj = q.get("objective", "")
                q_trig = q.get("trigger_flag", "")
                ql_lines.append(f"### [{q_type.upper()}] {q_title}")
                ql_lines.append(f"* **Objective:** {q_obj}")
                if q_trig:
                    ql_lines.append(f'(if: $flags contains "{q_trig}")[**Status:** ✅ Completed](else:)[**Status:** ⏳ In Progress]')
                ql_lines.append("")
        else:
            ql_lines.append("*No quests recorded in this story spine.*")
        ql_lines.append("\n---\n[[🔙 Return to Codex Menu->Codex_Menu]] | [[Return to Story->Title_Screen]]")
        add_passage("Quest_Log", ["codex"], "\n".join(ql_lines), 580, 240)

        # Achievements List
        ach_lines = ["## 🏆 Story Achievements\n"]
        if achievements:
            for a in achievements:
                a_title = a.get("title", "Achievement")
                a_desc = a.get("description", "")
                a_flag = a.get("trigger_flag", "")
                ach_lines.append(f"### 🎖️ {a_title}")
                ach_lines.append(f"* {a_desc}")
                if a_flag:
                    ach_lines.append(f'(if: $flags contains "{a_flag}")[**Status:** 🌟 UNLOCKED!](else:)[**Status:** 🔒 Locked]')
                ach_lines.append("")
        else:
            ach_lines.append("*No achievements configured for this story.*")
        ach_lines.append("\n---\n[[🔙 Return to Codex Menu->Codex_Menu]] | [[Return to Story->Title_Screen]]")
        add_passage("Achievements_List", ["codex"], "\n".join(ach_lines), 740, 240)

        # ─── 5. Chapter Select Passage ─────────────────────────────────────────
        cs_lines = ["## 📑 Chapter Select\nSelect any chapter to begin or jump directly into its sequence:\n"]
        # Determine total chapters: either authored chapters or chapter contracts
        total_ch = max(len(chapters), len(contracts))
        for i in range(1, total_ch + 1):
            ch_id = f"chapter_{i:02d}"
            # Find matching contract or chapter
            c_meta = next((c for c in contracts if c.get("chapter_id") == ch_id or c.get("order") == i), None)
            ch_data = next((ch for ch in chapters if ch.get("chapter_id") == ch_id), None)
            ch_title = (c_meta and c_meta.get("title")) or (ch_data and ch_data.get("title")) or f"Chapter {i}"
            ch_scope = (c_meta and c_meta.get("narrative_scope")) or ""
            cs_lines.append(f"* **[[Chapter {i}: {ch_title}->Chapter_{i:02d}_Intro]]**")
            if ch_scope:
                cs_lines.append(f"  *{ch_scope[:140]}...*")
        cs_lines.append("\n---\n[[🔙 Return to Title Screen->Title_Screen]]")
        add_passage("Chapter_Select", ["menu"], "\n".join(cs_lines), 900, 240)

        # ─── 6. Build Chapter Passages (Scenes, Dialogue Trees, Transitions) ──
        y_cursor = 420
        for i in range(1, total_ch + 1):
            ch_id = f"chapter_{i:02d}"
            ch_data = next((ch for ch in chapters if ch.get("chapter_id") == ch_id), None)
            c_meta = next((c for c in contracts if c.get("chapter_id") == ch_id or c.get("order") == i), None)

            ch_title = (c_meta and c_meta.get("title")) or (ch_data and ch_data.get("title")) or f"Chapter {i}"
            ch_scope = (c_meta and c_meta.get("narrative_scope")) or ""
            scenes = (ch_data and ch_data.get("scenes")) or []
            dialogue_nodes = (ch_data and ch_data.get("dialogue_tree")) or []
            if isinstance(dialogue_nodes, dict):
                dialogue_nodes = list(dialogue_nodes.values())

            x_cursor = 100

            # Chapter Intro Passage
            intro_lines = [
                f"(set: $current_chapter to {i})",
                f"## Chapter {i}: {ch_title}\n",
            ]
            if ch_scope:
                intro_lines.append(f"> *{ch_scope}*\n")

            entry_st = (c_meta and c_meta.get("entry_state")) or {}
            if entry_st:
                req_loc = entry_st.get("location")
                if req_loc:
                    intro_lines.append(f"**Setting:** `{req_loc}`")
                req_inv = entry_st.get("inventory", [])
                if req_inv:
                    intro_lines.append(f"**Key Assets Required:** {', '.join(req_inv)}")
                intro_lines.append("")

            # Determine where intro leads
            if scenes:
                next_target = f"Chapter_{i:02d}_Scene_01"
            elif dialogue_nodes:
                root_node = dialogue_nodes[0].get("node_id", "node_01")
                next_target = f"Chapter_{i:02d}_Dialogue_{root_node}"
            elif i < total_ch:
                next_target = f"Chapter_{i:02d}_Transition"
            else:
                next_target = "Story_Conclusion"

            intro_lines.append("---")
            intro_lines.append(f"[[▶ Proceed into Chapter {i}->{next_target}]]")
            intro_lines.append(f"[[📑 Chapter Select->Chapter_Select]]")

            add_passage(f"Chapter_{i:02d}_Intro", ["chapter", f"ch_{i:02d}"], "\n".join(intro_lines), x_cursor, y_cursor)
            x_cursor += 180

            # Chapter Scenes Passages
            for s_idx, scene in enumerate(scenes, 1):
                sc_title = scene.get("title") or f"Scene {s_idx}"
                sc_loc = scene.get("location_id") or ""
                sc_prose = scene.get("prose") or ""
                sc_chars = scene.get("characters_present") or []
                sc_beat = scene.get("emotional_beat") or ""

                sc_lines = [
                    f"### Chapter {i}, Scene {s_idx}: {sc_title}\n",
                ]
                meta_tags = []
                if sc_loc:
                    meta_tags.append(f"📍 Location: `{sc_loc}`")
                if sc_chars:
                    meta_tags.append(f"👥 Present: {', '.join(sc_chars)}")
                if sc_beat:
                    meta_tags.append(f"💓 Beat: *{sc_beat}*")
                if meta_tags:
                    sc_lines.append(f"<small>{' | '.join(meta_tags)}</small>\n")

                sc_lines.append(sc_prose)
                sc_lines.append("\n---")

                # Where does scene lead?
                if s_idx < len(scenes):
                    next_sc = f"Chapter_{i:02d}_Scene_{s_idx+1:02d}"
                    sc_lines.append(f"[[Continue to Next Scene ➔->{next_sc}]]")
                elif dialogue_nodes:
                    # Lead to dialogue tree
                    root_node = dialogue_nodes[0].get("node_id", "node_01")
                    sc_lines.append(f"[[Engage in Dialogue 💬->Chapter_{i:02d}_Dialogue_{root_node}]]")
                elif i < total_ch:
                    sc_lines.append(f"[[Complete Chapter {i} ➔->Chapter_{i:02d}_Transition]]")
                else:
                    sc_lines.append("[[Conclude Narrative Journey 🌟->Story_Conclusion]]")

                add_passage(f"Chapter_{i:02d}_Scene_{s_idx:02d}", ["scene", f"ch_{i:02d}"], "\n".join(sc_lines), x_cursor, y_cursor)
                x_cursor += 180

            # Chapter Dialogue Nodes Passages
            if dialogue_nodes:
                node_map = {n.get("node_id"): n for n in dialogue_nodes}
                for n_idx, node in enumerate(dialogue_nodes):
                    nid = node.get("node_id", f"node_{n_idx:02d}")
                    speaker = node.get("speaker") or "narrator"
                    ntype = (node.get("type") or "speaker").lower()
                    text = node.get("text") or ""
                    choices = node.get("choices") or []
                    linear_next = node.get("next_node")

                    d_lines = []
                    # Speaker banner
                    if speaker.lower() in ("narrator", "narration", ""):
                        d_lines.append(f"*{text}*\n")
                    else:
                        d_lines.append(f"**[{speaker.upper()}]**\n> \"{text}\"\n")

                    d_lines.append("---")

                    # Handle branching choices
                    if choices:
                        d_lines.append("### Choices:")
                        for c in choices:
                            clabel = c.get("label", "Continue")
                            ctrait = c.get("trait_tag")
                            cflags = c.get("flags_set") or []
                            if isinstance(cflags, str):
                                cflags = [cflags]
                            cnext = c.get("next_node")
                            ccond = c.get("condition_flag")

                            # Determine target passage
                            if cnext and cnext in node_map:
                                target_p = f"Chapter_{i:02d}_Dialogue_{cnext}"
                            elif i < total_ch:
                                target_p = f"Chapter_{i:02d}_Transition"
                            else:
                                target_p = "Story_Conclusion"

                            # Build Harlowe setter logic
                            set_stmts = []
                            if ctrait and ctrait in trait_vars:
                                set_stmts.append(f"(set: ${trait_vars[ctrait]} to ${trait_vars[ctrait]} + 1)")
                            if cflags:
                                quoted_flags = ", ".join(f'"{f}"' for f in cflags)
                                set_stmts.append(f"(set: $flags to $flags + (a: {quoted_flags}))")
                                # Quest completion check
                                for q in quests:
                                    if q.get("trigger_flag") in cflags:
                                        qid = q.get("quest_id")
                                        set_stmts.append(f'(set: $completed_quests to $completed_quests + (a: "{qid}"))')

                            choice_code = ""
                            if set_stmts:
                                setters = "".join(set_stmts)
                                choice_code = f'(link: "{clabel}")[{setters}(go-to: "{target_p}")]'
                            else:
                                choice_code = f'[[{clabel}->{target_p}]]'

                            if ccond:
                                d_lines.append(f'(if: $flags contains "{ccond}")[* {choice_code}]')
                            else:
                                d_lines.append(f'* {choice_code}')

                    elif linear_next and linear_next in node_map:
                        # Linear speaker node
                        target_p = f"Chapter_{i:02d}_Dialogue_{linear_next}"
                        d_lines.append(f"[[Continue...->{target_p}]]")
                    else:
                        # Terminal dialogue node
                        if i < total_ch:
                            d_lines.append(f"[[Chapter {i} Completed. Continue ➔->Chapter_{i:02d}_Transition]]")
                        else:
                            d_lines.append("[[Journey Reaches Conclusion 🌟->Story_Conclusion]]")

                    add_passage(f"Chapter_{i:02d}_Dialogue_{nid}", ["dialogue", f"ch_{i:02d}"], "\n".join(d_lines), x_cursor, y_cursor)
                    x_cursor += 160

            # Chapter Transition Passage (if not final chapter)
            if i < total_ch:
                trans = next((t for t in transitions if t.get("from_chapter_id") == ch_id), None)
                trans_lines = [
                    f"## Passage: Transition from Chapter {i} to Chapter {i+1}\n",
                ]
                if trans:
                    sc_sum = trans.get("scene_summary") or ""
                    hook = trans.get("narrative_hook") or ""
                    delta = trans.get("state_delta") or {}
                    if sc_sum:
                        trans_lines.append(f"{sc_sum}\n")
                    if hook:
                        trans_lines.append(f'> "{hook}"\n')
                    if delta:
                        trans_lines.append(f"**State Shift:** `{json.dumps(delta)}`\n")
                else:
                    trans_lines.append(f"You prepare for the next chapter of your journey across the unfolding narrative.\n")

                next_ch_intro = f"Chapter_{i+1:02d}_Intro"
                trans_lines.append("---")
                trans_lines.append(f"[[Enter Chapter {i+1} ➔->{next_ch_intro}]]")
                trans_lines.append("[[📑 Chapter Select->Chapter_Select]]")

                add_passage(f"Chapter_{i:02d}_Transition", ["transition", f"ch_{i:02d}"], "\n".join(trans_lines), x_cursor, y_cursor)

            y_cursor += 180

        # ─── 7. Story Conclusion Passage ───────────────────────────────────────
        concl_lines = [
            f"# {title} — Epilogue & Conclusion\n",
            "You have reached the culmination of your narrative journey!\n",
            "### Emergent Alignment & Character Traits",
        ]
        if trait_vars:
            for t_name, var in trait_vars.items():
                concl_lines.append(f"* **{t_name}**: (print: ${var}) points")
        else:
            concl_lines.append("*Your choices have shaped the world and guided your companions.*")

        concl_lines.append("\n### Journey Review")
        concl_lines.append("* Total Quests Completed: **(count: $completed_quests)**")
        concl_lines.append("* [[Review Full Quest & Achievement Log->Quest_Log]]")
        concl_lines.append("* [[Review Story Codex & World Lore->World_Codex]]")
        concl_lines.append("\n---")
        concl_lines.append("[[🔄 Play Again from Title Screen->Title_Screen]]")
        concl_lines.append("[[📑 Revisit Any Chapter->Chapter_Select]]")

        add_passage("Story_Conclusion", ["ending"], "\n".join(concl_lines), 500, y_cursor + 60)

        # ─── 8. Generate Twee 3 Source Text ────────────────────────────────────
        twee_chunks = [
            f":: StoryTitle\n{title}\n",
            f":: StoryData\n{{\n  \"ifid\": \"{story_ifid}\",\n  \"format\": \"Harlowe\",\n  \"format-version\": \"3.3.8\",\n  \"start\": \"Title_Screen\",\n  \"zoom\": 1\n}}\n",
        ]

        for p in passages:
            p_name = p["name"]
            p_tags = f" [{p['tags']}]" if p["tags"] else ""
            pos_json = f'{{"position":"{p["x"]},{p["y"]}","size":"100,100"}}'
            twee_chunks.append(f":: {p_name}{p_tags} {pos_json}\n{p['content']}\n")

        twee_text = "\n".join(twee_chunks)

        # ─── 9. Generate Twine 2 Standalone HTML ────────────────────────────────
        html_text = self._build_twine2_html(
            title=title,
            ifid=story_ifid,
            start_passage_pid=start_pid,
            passages=passages,
            story_arc=story_arc,
            trait_vars=trait_vars,
            traits=traits,
            characters=characters,
        )

        stats = {
            "title": title,
            "ifid": story_ifid,
            "passages_count": len(passages),
            "chapters_count": total_ch,
            "traits_count": len(traits),
            "quests_count": len(quests),
        }

        return twee_text, html_text, stats

    def _build_twine2_html(
        self,
        title: str,
        ifid: str,
        start_passage_pid: int,
        passages: list[dict[str, Any]],
        story_arc: dict[str, Any],
        trait_vars: dict[str, str],
        traits: list[dict[str, Any]],
        characters: list[dict[str, Any]],
    ) -> str:
        """Constructs a standard Twine 2 HTML document containing <tw-storydata> and

        <tw-passagedata> tags, coupled with a zero-dependency, dark-mode, responsive
        visual novel player for immediate browser play.
        """
        escaped_title = html.escape(title)

        passage_tags_html = []
        for p in passages:
            escaped_name = html.escape(p["name"])
            escaped_tags = html.escape(p["tags"])
            escaped_content = html.escape(p["content"])
            pos_str = f"{p['x']},{p['y']}"
            passage_tags_html.append(
                f'<tw-passagedata pid="{p["pid"]}" name="{escaped_name}" tags="{escaped_tags}" pos="{pos_str}" size="100,100">{escaped_content}</tw-passagedata>'
            )

        passages_blob = "\n  ".join(passage_tags_html)
        traits_json = json.dumps(traits)
        story_arc_json = json.dumps(story_arc)

        # Embedded standalone runtime reader
        html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escaped_title} — QuestForge Twine Edition</title>
  <style id="twine-user-stylesheet" type="text/twine-css">
    :root {{
      --bg-dark: #07090e;
      --card-bg: rgba(18, 23, 37, 0.85);
      --border-color: rgba(66, 82, 110, 0.4);
      --accent: #3b82f6;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: var(--bg-dark);
      background-image: radial-gradient(circle at 50% 10%, rgba(30, 58, 138, 0.18) 0%, transparent 60%);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }}
    header.qf-runner-nav {{
      border-bottom: 1px solid var(--border-color);
      background: rgba(10, 14, 26, 0.8);
      backdrop-filter: blur(12px);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }}
    .qf-logo {{
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.05em;
      color: #60a5fa;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .qf-trait-meters {{
      display: flex;
      gap: 16px;
      align-items: center;
    }}
    .qf-trait-badge {{
      font-size: 0.8rem;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    .qf-score-val {{
      font-weight: bold;
      color: #93c5fd;
    }}
    main.qf-stage {{
      flex: 1;
      max-width: 860px;
      width: 100%;
      margin: 32px auto;
      padding: 0 20px;
      display: flex;
      flex-direction: column;
    }}
    .qf-card {{
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 36px 40px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(16px);
      animation: fadeIn 0.25s ease-out;
    }}
    @keyframes fadeIn {{
      from {{ opacity: 0; transform: translateY(6px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
    .qf-passage-title {{
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 20px;
      color: #e2e8f0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 12px;
    }}
    .qf-passage-content {{
      font-size: 1.05rem;
      line-height: 1.75;
      color: #cbd5e1;
    }}
    .qf-passage-content p {{
      margin-bottom: 1.25rem;
    }}
    .qf-passage-content blockquote {{
      border-left: 3px solid #3b82f6;
      padding: 10px 18px;
      margin: 16px 0;
      background: rgba(59, 130, 246, 0.08);
      border-radius: 0 8px 8px 0;
      font-style: italic;
    }}
    .qf-passage-content h1, .qf-passage-content h2, .qf-passage-content h3 {{
      margin: 20px 0 12px 0;
      color: #f8fafc;
    }}
    .qf-passage-content hr {{
      border: 0;
      height: 1px;
      background: var(--border-color);
      margin: 24px 0;
    }}
    .qf-choices {{
      margin-top: 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}
    .qf-btn-choice {{
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 12px;
      padding: 14px 20px;
      color: #f1f5f9;
      font-size: 0.95rem;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    .qf-btn-choice:hover {{
      background: rgba(59, 130, 246, 0.25);
      border-color: #3b82f6;
      transform: translateX(4px);
    }}
    .qf-choice-arrow {{
      color: #60a5fa;
      font-weight: bold;
    }}
    footer.qf-footer {{
      padding: 16px;
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted);
      border-top: 1px solid rgba(255,255,255,0.05);
    }}
  </style>
</head>
<body>

  <!-- Twine 2 Canonical Specification Data Root -->
  <tw-storydata name="{escaped_title}" startnode="{start_passage_pid}" creator="QuestForge" creator-version="1.0.0" format="Harlowe" format-version="3.3.8" ifid="{ifid}" zoom="1" options="">
  <style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css"></style>
  <script role="script" id="twine-user-script" type="text/twine-javascript"></script>
  {passages_blob}
  </tw-storydata>

  <!-- Interactive Web Runner UI -->
  <header class="qf-runner-nav">
    <div class="qf-logo">
      <span>⚔️</span>
      <span id="qf-story-title">{escaped_title}</span>
    </div>
    <div class="qf-trait-meters" id="qf-trait-meters"></div>
    <div style="display:flex; gap:10px;">
      <button class="qf-trait-badge" style="cursor:pointer;" onclick="qfRestart()">🔄 Restart</button>
      <button class="qf-trait-badge" style="cursor:pointer;" onclick="qfGoto('Codex_Menu')">📑 Menu</button>
    </div>
  </header>

  <main class="qf-stage">
    <div class="qf-card">
      <div class="qf-passage-title" id="qf-title"></div>
      <div class="qf-passage-content" id="qf-body"></div>
      <div class="qf-choices" id="qf-choices"></div>
    </div>
  </main>

  <footer class="qf-footer">
    Exported from QuestForge Engine • Twine 2 & Twee 3 Compatible Edition
  </footer>

  <script>
    (function() {{
      const traitsDef = {traits_json};
      const storyArc = {story_arc_json};

      // State
      let state = {{
        flags: [],
        completedQuests: [],
        traits: {{}},
      }};

      traitsDef.forEach(t => {{
        const key = t.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        state.traits[key] = 0;
      }});

      // Load Twine DOM Passages
      const passageMap = new Map();
      let startPassageName = "Title_Screen";

      document.querySelectorAll('tw-passagedata').forEach(el => {{
        const pid = el.getAttribute('pid');
        const name = el.getAttribute('name');
        const tags = (el.getAttribute('tags') || '').split(' ');
        const rawContent = el.textContent || '';
        passageMap.set(name, {{ pid, name, tags, rawContent }});
      }});

      // Trait UI rendering
      function renderTraitMeters() {{
        const container = document.getElementById('qf-trait-meters');
        container.innerHTML = '';
        traitsDef.forEach(t => {{
          const key = t.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
          const val = state.traits[key] || 0;
          const badge = document.createElement('div');
          badge.className = 'qf-trait-badge';
          badge.innerHTML = `<span style="color:${{t.color_hex || '#60a5fa'}}">●</span> ${{t.name}}: <span class="qf-score-val">${{val}}</span>`;
          container.appendChild(badge);
        }});
      }}

      // Parse passage text into displayable HTML and interactive choices
      function renderPassage(passageName) {{
        const passage = passageMap.get(passageName);
        if (!passage) {{
          console.warn("Passage not found:", passageName);
          return;
        }}

        window.scrollTo({{ top: 0, behavior: 'smooth' }});
        document.getElementById('qf-title').innerText = passage.name.replace(/_/g, ' ');

        let raw = passage.rawContent;

        // Process Harlowe macros in text
        // (set: $trait to $trait + 1)
        // (if: $flags contains "...") [...]
        raw = raw.replace(/\\(set:\\s*\\$([a-zA-Z0-9_]+)\\s*to\\s*\\$\\1\\s*\\+\\s*(\\d+)\\)/g, (match, varName, amt) => {{
          state.traits[varName] = (state.traits[varName] || 0) + parseInt(amt, 10);
          renderTraitMeters();
          return '';
        }});

        raw = raw.replace(/\\(set:\\s*\\$flags\\s*to\\s*\\$flags\\s*\\+\\s*\\(a:\\s*(.*?)\\)\\)/g, (match, flagsStr) => {{
          const flags = flagsStr.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          flags.forEach(f => {{ if (f && !state.flags.includes(f)) state.flags.push(f); }});
          return '';
        }});

        // Handle (if: $flags contains "flag")[Content](else:)[Alt]
        raw = raw.replace(/\\(if:\\s*\\$flags\\s*contains\\s*["'](.*?)["']\\)\\[(.*?)\\](?:\\(else:\\)\\[(.*?)\\])?/gs, (match, flag, yesContent, noContent) => {{
          return state.flags.includes(flag) ? yesContent : (noContent || '');
        }});

        // Extract choices: [[label->target]] or (link: "label")[(set:...)(go-to: "target")]
        const choices = [];

        // 1. Harlowe links: (link: "label")[(set:...)(go-to: "target")]
        raw = raw.replace(/\\(link:\\s*["'](.*?)["']\\)\\[(.*?)\\(go-to:\\s*["'](.*?)["']\\)\\]/gs, (match, label, setters, target) => {{
          choices.push({{ label, target, setters }});
          return '';
        }});

        // 2. Standard Twine links: [[Label->Target]] or [[Target]]
        raw = raw.replace(/\\[\\[(.*?)\\]\\]/g, (match, inner) => {{
          if (inner.includes('->')) {{
            const parts = inner.split('->');
            choices.push({{ label: parts[0].trim(), target: parts[1].trim() }});
          }} else {{
            choices.push({{ label: inner.trim(), target: inner.trim() }});
          }}
          return '';
        }});

        // Clean up markdown in body
        let bodyHtml = raw
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^\\> \\[!NOTE\\]/gim, '<blockquote><strong>Note:</strong>')
          .replace(/^\\> (.*$)/gim, '<blockquote>$1</blockquote>')
          .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
          .replace(/\\n\\n+/g, '</p><p>')
          .replace(/\\n/g, '<br>');

        document.getElementById('qf-body').innerHTML = `<p>${{bodyHtml}}</p>`;

        // Render choices buttons
        const choiceContainer = document.getElementById('qf-choices');
        choiceContainer.innerHTML = '';

        choices.forEach(ch => {{
          const btn = document.createElement('button');
          btn.className = 'qf-btn-choice';
          btn.innerHTML = `<span>${{ch.label}}</span><span class="qf-choice-arrow">➔</span>`;
          btn.onclick = () => {{
            if (ch.setters) {{
              // Apply setters
              const traitMatch = ch.setters.match(/\\$([a-zA-Z0-9_]+)\\s*to\\s*\\$\\1\\s*\\+\\s*(\\d+)/);
              if (traitMatch) {{
                const varName = traitMatch[1];
                const amt = parseInt(traitMatch[2], 10);
                state.traits[varName] = (state.traits[varName] || 0) + amt;
                renderTraitMeters();
              }}
              const flagMatch = ch.setters.match(/\\$flags\\s*to\\s*\\$flags\\s*\\+\\s*\\(a:\\s*(.*?)\\)/);
              if (flagMatch) {{
                const flags = flagMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                flags.forEach(f => {{ if (f && !state.flags.includes(f)) state.flags.push(f); }});
              }}
            }}
            renderPassage(ch.target);
          }};
          choiceContainer.appendChild(btn);
        }});
      }}

      window.qfGoto = renderPassage;
      window.qfRestart = function() {{
        state.flags = [];
        state.completedQuests = [];
        traitsDef.forEach(t => {{
          const key = t.name.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
          state.traits[key] = 0;
        }});
        renderTraitMeters();
        renderPassage(startPassageName);
      }};

      // Init
      renderTraitMeters();
      renderPassage(startPassageName);
    }})();
  </script>
</body>
</html>"""
        return html_template

    def export_project(
        self,
        project_id: str,
        output_dir: str | Path | None = None,
    ) -> dict[str, Any]:
        """Loads an existing project by ID and exports both Twee and HTML files."""
        pdir = self.projects_dir / project_id
        if not pdir.exists():
            raise FileNotFoundError(f"Project directory '{project_id}' not found in {self.projects_dir}")

        # 1. Read state_snapshot.json
        state_file = pdir / "state_snapshot.json"
        state_data: dict[str, Any] = {}
        if state_file.exists():
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    snap = json.load(f)
                    state_data = snap.get("values", snap)
            except Exception as e:
                print(f"Warning: Failed reading state snapshot for {project_id}: {e}")

        # 2. Read game_package if present
        pkg_dir = pdir / "game_package"
        world_bible = state_data.get("world_bible") or {}
        characters = state_data.get("characters") or []
        story_arc = state_data.get("story_arc") or {}
        traits = state_data.get("trait_vocabulary") or []
        contracts = state_data.get("chapter_contracts") or []
        transitions = state_data.get("transitions") or []
        chapters = state_data.get("chapters") or []
        quests = state_data.get("quest_graph") or []
        achievements = state_data.get("achievements") or []
        is_explicit = state_data.get("is_explicit", False)

        # Fallback to reading disk game_package if snapshot didn't have full chapters
        if pkg_dir.exists():
            if not world_bible and (pkg_dir / "world_bible.json").exists():
                with open(pkg_dir / "world_bible.json", "r", encoding="utf-8") as f:
                    world_bible = json.load(f)
            if not characters and (pkg_dir / "characters.json").exists():
                with open(pkg_dir / "characters.json", "r", encoding="utf-8") as f:
                    characters = json.load(f)
            if not achievements and (pkg_dir / "achievements.json").exists():
                with open(pkg_dir / "achievements.json", "r", encoding="utf-8") as f:
                    achievements = json.load(f)
            if not chapters and (pkg_dir / "chapters").exists():
                for ch_file in sorted((pkg_dir / "chapters").glob("chapter_*.json")):
                    try:
                        with open(ch_file, "r", encoding="utf-8") as f:
                            chapters.append(json.load(f))
                    except Exception:
                        pass
            if not quests and (pkg_dir / "side_quests").exists():
                for q_file in sorted((pkg_dir / "side_quests").glob("*.json")):
                    try:
                        with open(q_file, "r", encoding="utf-8") as f:
                            quests.append(json.load(f))
                    except Exception:
                        pass

        # If project.json has metadata, check for custom project title
        if (pdir / "project.json").exists():
            try:
                with open(pdir / "project.json", "r", encoding="utf-8") as f:
                    pmeta = json.load(f)
                    p_title = pmeta.get("title")
                    if p_title and (not story_arc.get("title") or (story_arc.get("title") == "A Neon Grave" and project_id != "proj_neon_grave")):
                        story_arc["title"] = p_title
                    if pmeta.get("genre") and not story_arc.get("genre"):
                        story_arc["genre"] = pmeta.get("genre")
                    if pmeta.get("tone") and not story_arc.get("tone"):
                        story_arc["tone"] = pmeta.get("tone")
                    if pmeta.get("story_seed") and not story_arc.get("story_seed"):
                        story_arc["story_seed"] = pmeta.get("story_seed")
                    if "is_explicit" in pmeta:
                        is_explicit = pmeta["is_explicit"]
            except Exception:
                pass

        twee_text, html_text, stats = self.build_twee_and_html(
            story_arc=story_arc,
            chapters=chapters,
            contracts=contracts,
            transitions=transitions,
            world_bible=world_bible,
            characters=characters,
            traits=traits,
            quests=quests,
            achievements=achievements,
            is_explicit=is_explicit,
        )

        # Output targets:
        # Default writes to both project root /twine/ and game_package/twine/ (if pkg exists)
        target_dir = Path(output_dir) if output_dir else (pdir / "twine")
        target_dir.mkdir(parents=True, exist_ok=True)

        slug = self._slugify(story_arc.get("title", project_id))
        twee_file = target_dir / f"{slug}.twee"
        html_file = target_dir / f"{slug}.html"
        # Also write canonical story.twee and story.html for universal access
        canon_twee = target_dir / "story.twee"
        canon_html = target_dir / "story.html"

        with open(twee_file, "w", encoding="utf-8") as f:
            f.write(twee_text)
        with open(canon_twee, "w", encoding="utf-8") as f:
            f.write(twee_text)

        with open(html_file, "w", encoding="utf-8") as f:
            f.write(html_text)
        with open(canon_html, "w", encoding="utf-8") as f:
            f.write(html_text)

        # If project has game_package, also sync twine folder there
        if pkg_dir.exists():
            pkg_twine = pkg_dir / "twine"
            pkg_twine.mkdir(parents=True, exist_ok=True)
            with open(pkg_twine / "story.twee", "w", encoding="utf-8") as f:
                f.write(twee_text)
            with open(pkg_twine / "story.html", "w", encoding="utf-8") as f:
                f.write(html_text)

        stats["project_id"] = project_id
        stats["twee_file"] = str(twee_file)
        stats["html_file"] = str(html_file)
        stats["canonical_twee"] = str(canon_twee)
        stats["canonical_html"] = str(canon_html)
        return stats

    def export_all_projects(self) -> list[dict[str, Any]]:
        """Scans the projects directory and exports Twine files for all found projects."""
        results = []
        if not self.projects_dir.exists():
            return results

        for item in sorted(self.projects_dir.iterdir()):
            if item.is_dir() and (item / "project.json").exists() or (item / "state_snapshot.json").exists():
                try:
                    res = self.export_project(item.name)
                    results.append(res)
                    print(f"[OK] Exported '{item.name}' -> {res['passages_count']} passages ({res['html_file']})")
                except Exception as e:
                    print(f"[FAIL] Failed exporting '{item.name}': {e}")
                    results.append({"project_id": item.name, "error": str(e)})

        return results


def main():
    import argparse
    parser = argparse.ArgumentParser(description="QuestForge Twine / Twee 3 Exporter")
    parser.add_argument("--project", default=None, help="Project ID to export (e.g. proj_the_dust_of_time...)")
    parser.add_argument("--all", action="store_true", help="Export all existing projects")
    parser.add_argument("--output-dir", default=None, help="Custom output directory")
    args = parser.parse_args()

    exporter = TwineExporter()
    if args.all or not args.project:
        print("\n=== Exporting all existing QuestForge projects to Twine ===")
        results = exporter.export_all_projects()
        print(f"\nCompleted Twine export for {len(results)} project(s).")
    else:
        print(f"\n=== Exporting project '{args.project}' to Twine ===")
        res = exporter.export_project(args.project, output_dir=args.output_dir)
        print(f"[OK] Successfully exported '{res['title']}'!")
        print(f"   Passages: {res['passages_count']}")
        print(f"   Twee Source: {res['twee_file']}")
        print(f"   Playable Twine HTML: {res['html_file']}")


if __name__ == "__main__":
    main()
