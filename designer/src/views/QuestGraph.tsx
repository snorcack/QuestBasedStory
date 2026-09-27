import React, { useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
} from '@xyflow/react';
import { useStoryStore } from '../store/useStoryStore';
import { QuestNode } from '../nodes/QuestNode';
import { Quest, QuestType } from '../types';
import { Compass, Filter, Trophy, ShieldAlert, Gift } from 'lucide-react';

const nodeTypes = {
  questNode: QuestNode,
};

export const QuestGraph: React.FC = () => {
  const { questGraph, achievements } = useStoryStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  const filteredQuests = useMemo(() => {
    if (filterType === 'all') return questGraph;
    return questGraph.filter((q) => q.type === filterType);
  }, [questGraph, filterType]);

  const { nodes, edges } = useMemo(() => {
    const calculatedNodes: Node[] = [];
    const calculatedEdges: Edge[] = [];

    // Group quests by chapter
    const byChapter: Record<string, Quest[]> = {};
    filteredQuests.forEach((q) => {
      if (!byChapter[q.chapter_id]) byChapter[q.chapter_id] = [];
      byChapter[q.chapter_id].push(q);
    });

    let chIndex = 0;
    Object.entries(byChapter).forEach(([chapterId, quests]) => {
      quests.forEach((quest, qIdx) => {
        const x = chIndex * 300 + 60;
        const y = qIdx * 200 + 80;

        calculatedNodes.push({
          id: quest.quest_id,
          type: 'questNode',
          position: { x, y },
          data: quest as any,
        });
      });
      chIndex++;
    });

    return { nodes: calculatedNodes, edges: calculatedEdges };
  }, [filteredQuests]);

  return (
    <div className="relative w-full h-full bg-[#060911]">
      {/* Filter Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 glass-panel p-1.5 rounded-xl border border-slate-800 shadow-xl">
        <span className="text-xs font-mono text-slate-400 px-2 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Filters:
        </span>
        <button
          onClick={() => setFilterType('all')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
            filterType === 'all'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          All ({questGraph.length})
        </button>
        <button
          onClick={() => setFilterType('main_blocking')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
            filterType === 'main_blocking'
              ? 'bg-red-600 text-white shadow'
              : 'text-red-400 hover:bg-red-950/40'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" /> Blocking
        </button>
        <button
          onClick={() => setFilterType('latent_advantage')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
            filterType === 'latent_advantage'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-emerald-400 hover:bg-emerald-950/40'
          }`}
        >
          <Gift className="w-3.5 h-3.5" /> Advantage
        </button>
      </div>

      {questGraph.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <Compass className="w-12 h-12 mb-3 stroke-[1.5] text-slate-600" />
          <p className="text-sm font-medium">No quests mapped yet.</p>
          <p className="text-xs text-slate-600">The Quest Architect maps quests after chapters are authored.</p>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedQuest(node.data as any as Quest)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      )}

      {/* Quest Details Drawer */}
      {selectedQuest && (
        <div className="absolute right-4 top-4 bottom-4 w-80 glass-panel rounded-xl p-5 border border-slate-800 shadow-2xl z-20 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Quest Inspector
              </span>
              <button
                onClick={() => setSelectedQuest(null)}
                className="text-xs text-slate-500 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <h3 className="font-semibold text-base text-slate-100 mb-2">
              {selectedQuest.title}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Objective:</span>
                <p className="text-slate-200 bg-slate-900/60 p-2 rounded border border-slate-800">
                  {selectedQuest.objective}
                </p>
              </div>

              {selectedQuest.journal_entry && (
                <div>
                  <span className="text-slate-500 block mb-0.5">Protagonist Journal:</span>
                  <p className="text-amber-200/90 italic bg-amber-950/20 p-2 rounded border border-amber-500/20">
                    "{selectedQuest.journal_entry}"
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">Chapter</span>
                  <span className="text-slate-300">{selectedQuest.chapter_id}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">Location</span>
                  <span className="text-slate-300">{selectedQuest.location_id}</span>
                </div>
              </div>

              {selectedQuest.latent_payoff && (
                <div className="bg-emerald-950/30 p-2.5 rounded border border-emerald-500/30">
                  <span className="text-emerald-400 font-semibold block mb-1">
                    Latent Payoff ({selectedQuest.latent_payoff.chapter_id}):
                  </span>
                  <p className="text-emerald-200/90 text-xs">
                    {selectedQuest.latent_payoff.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-3 border-t border-slate-800">
            Quest ID: {selectedQuest.quest_id}
          </div>
        </div>
      )}
    </div>
  );
};
