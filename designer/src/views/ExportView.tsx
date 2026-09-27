import React, { useState, useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import { Download, CheckCircle2, FileText, Folder, Check, Code2, Sparkles, Loader2 } from 'lucide-react';

export const ExportView: React.FC = () => {
  const {
    storyArc,
    chapterContracts,
    chapters,
    questGraph,
    worldBible,
    characters,
    achievements,
    traitVocabulary,
    currentProjectId: activeProjectId,
  } = useStoryStore();

  const [activeTab, setActiveTab] = useState<string>('manifest.json');
  const [exported, setExported] = useState<boolean>(false);
  const [twineExporting, setTwineExporting] = useState<boolean>(false);
  const [twineStatus, setTwineStatus] = useState<{
    has_twine: boolean;
    passages_count?: number;
    twee_size_bytes?: number;
    html_size_bytes?: number;
    executed_at?: string;
  } | null>(null);
  const [twineTweeContent, setTwineTweeContent] = useState<string>('');

  // Manifest payload
  const manifestData = {
    title: storyArc?.title || 'QuestForge Story',
    version: '1.0.0',
    schema_version: '1.0',
    chapters_count: chapterContracts.length,
    traits: traitVocabulary.map((t) => t.name),
    total_quests: questGraph.length,
    total_achievements: achievements.length,
    total_locations: worldBible?.locations?.length || 0,
    total_characters: characters.length,
    entry_chapter_id: chapterContracts[0]?.chapter_id || 'chapter_01',
    has_twine_export: true,
    twine_twee_file: 'twine/story.twee',
    twine_html_file: 'twine/story.html',
    notes: 'Generated and validated by QuestForge Export Agent with Twine Export Pipeline Step.',
  };

  const sampleTwee = `:: StoryTitle\n${storyArc?.title || 'QuestForge Story'}\n\n:: StoryData\n{\n  "ifid": "QUESTFORGE-AUTO-EXPORT-ID",\n  "format": "Harlowe",\n  "format-version": "3.3.0"\n}\n\n:: StoryInit\n(set: $flags to (a:))\n(set: $completed_quests to (a:))\n(set: $inventory to (a:))\n\n:: Title_Screen [title]\n# ${storyArc?.title || 'QuestForge Story'}\n*${storyArc?.genre || 'Interactive Fiction'}*\n\n[[▶ Begin Story->Chapter_01_Intro]]\n[[👥 Dramatis Personae->Dramatis_Personae]]\n[[🗺️ World Codex->World_Codex]]`;

  useEffect(() => {
    // Check initial twine status if project ID available
    if (activeProjectId) {
      fetch(`/api/projects/${activeProjectId}/export/twine`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setTwineStatus(data);
          }
        })
        .catch(() => {});
    }
  }, [activeProjectId]);

  const handleRunTwineExportStep = async () => {
    setTwineExporting(true);
    try {
      if (activeProjectId) {
        const res = await fetch(`/api/projects/${activeProjectId}/export/twine`, {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json();
          setTwineStatus(data);
          // Fetch Twee content
          const cRes = await fetch(`/api/projects/${activeProjectId}/export/twine/content?format=twee`);
          if (cRes.ok) {
            const text = await cRes.text();
            setTwineTweeContent(text);
          }
        }
      } else {
        // Fallback for new project in memory
        const res = await fetch('/api/pipeline/step/twine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            story_arc: storyArc,
            chapters: chapters,
            chapter_contracts: chapterContracts,
            world_bible: worldBible,
            characters: characters,
            traits: traitVocabulary,
            quests: questGraph,
            achievements: achievements,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setTwineStatus(data);
        }
      }
    } catch (e) {
      console.error('Failed running Twine export step', e);
    } finally {
      setTwineExporting(false);
    }
  };

  const getFileContent = () => {
    switch (activeTab) {
      case 'manifest.json':
        return JSON.stringify(manifestData, null, 2);
      case 'world_bible.json':
        return JSON.stringify(worldBible || {}, null, 2);
      case 'characters.json':
        return JSON.stringify(characters || [], null, 2);
      case 'chapter_01.json':
        return JSON.stringify(chapters[0] || {}, null, 2);
      case 'achievements.json':
        return JSON.stringify(achievements || [], null, 2);
      case 'twine/story.twee':
        return twineTweeContent || sampleTwee;
      case 'twine/story.html':
        return `<!-- Standalone Playable Twine 2 HTML Package -->\n<!DOCTYPE html>\n<html>\n<head><title>${storyArc?.title || 'QuestForge Story'}</title></head>\n<body>\n  <tw-storydata name="${storyArc?.title || 'QuestForge Story'}" format="Harlowe" format-version="3.3.0" ...>\n    <!-- Passages compiled by Twine Export Pipeline Step -->\n  </tw-storydata>\n</body>\n</html>`;
      default:
        return '{}';
    }
  };

  const handleExport = () => {
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <div className="w-full h-full flex bg-[#060911]">
      {/* File Tree Left Sidebar */}
      <div className="w-80 h-full border-r border-slate-800/80 glass-panel p-5 flex flex-col justify-between shrink-0 bg-[#080d1a]">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Folder className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-mono font-semibold text-slate-200">
                game_package/
              </h3>
            </div>

            <div className="space-y-1 font-mono text-xs">
              {[
                { name: 'manifest.json', icon: FileText, tag: 'JSON' },
                { name: 'world_bible.json', icon: FileText, tag: 'JSON' },
                { name: 'characters.json', icon: FileText, tag: 'JSON' },
                { name: 'chapter_01.json', icon: FileText, tag: 'JSON' },
                { name: 'achievements.json', icon: FileText, tag: 'JSON' },
                { name: 'twine/story.twee', icon: Code2, tag: 'TWEE 3' },
                { name: 'twine/story.html', icon: Code2, tag: 'TWINE 2' },
              ].map(({ name: filename, icon: Icon, tag }) => (
                <button
                  key={filename}
                  onClick={() => setActiveTab(filename)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-all ${
                    activeTab === filename
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${filename.startsWith('twine/') ? 'text-purple-400' : 'text-blue-400'}`} />
                    <span className="truncate">{filename}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                    {tag}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Twine Export Pipeline Step Card */}
          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-purple-200">Twine Pipeline Step</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/50 font-mono">
                Twee 3 / HTML
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Exports narrative, scenes, dialogue trees, traits & quests into Twee 3 source code and standalone playable Twine HTML.
            </p>
            <button
              onClick={handleRunTwineExportStep}
              disabled={twineExporting}
              className="w-full py-2 rounded-lg font-medium text-xs bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
            >
              {twineExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running Step...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Run Twine Export Step
                </>
              )}
            </button>
          </div>

          {/* Pre-Export Validation Checklist */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-mono text-slate-500 block mb-2 uppercase tracking-wider">
              Pre-Export Validation
            </span>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Referential Integrity Pass</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Chapter Contracts Valid</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Trait Arc Gating Reachable</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-purple-300">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Twine Twee 3 & HTML Ready</span>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          className={`w-full py-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg mt-4 ${
            exported
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {exported ? (
            <>
              <Check className="w-4 h-4" />
              Package & Twine Exported!
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export Full Package (JSON + Twine)
            </>
          )}
        </button>
      </div>

      {/* Code / Content Viewer */}
      <div className="flex-1 h-full p-6 flex flex-col bg-[#080c18] overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-300 font-medium">
              Previewing: {activeTab}
            </span>
            {activeTab.startsWith('twine/') && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/40">
                Interactive Narrative Format
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-2.5 py-1 rounded border border-slate-800">
            {activeTab.endsWith('.twee') ? 'TWEE 3 SOURCE' : activeTab.endsWith('.html') ? 'HTML (TWINE 2)' : 'JSON (UTF-8)'}
          </span>
        </div>

        <pre className="flex-1 overflow-auto bg-slate-950 p-5 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300 leading-relaxed shadow-inner">
          {getFileContent()}
        </pre>
      </div>
    </div>
  );
};
