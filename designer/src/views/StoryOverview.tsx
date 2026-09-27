import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import { useStoryStore } from '../store/useStoryStore';
import { ChapterNode } from '../nodes/ChapterNode';
import {
  Sparkles,
  Layers,
  BookOpen,
  Maximize2,
  Grid3X3,
  Plus,
  X,
  MapPin,
  Film,
  ExternalLink,
  Edit3,
} from 'lucide-react';

const nodeTypes = {
  chapterNode: ChapterNode,
};

const StoryOverviewInner: React.FC = () => {
  const {
    storyArc,
    chapterContracts,
    traitVocabulary,
    chapters,
    nodePositions,
    setNodePosition,
    addChapterContract,
    updateChapterContract,
    selectedChapterId,
    setSelectedChapterId,
    setActiveView,
    worldBible,
  } = useStoryStore();

  const { fitView } = useReactFlow();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Build a map from chapter_id → authoredChapter
  const authoredMap = useMemo(() => {
    const m: Record<string, any> = {};
    chapters.forEach((ch) => {
      m[ch.chapter_id] = ch;
    });
    return m;
  }, [chapters]);

  // High-performance React Flow node and edge state management
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Synchronize chapterContracts into nodes & edges smoothly
  useEffect(() => {
    const calculatedNodes: Node[] = chapterContracts.map((contract, index) => {
      const defaultX = index * 360 + 50;
      const defaultY = 160 + (index % 2 === 1 ? 50 : 0);
      const pos = nodePositions[contract.chapter_id] || { x: defaultX, y: defaultY };

      return {
        id: contract.chapter_id,
        type: 'chapterNode',
        position: pos,
        data: {
          ...contract,
          authoredChapter: authoredMap[contract.chapter_id] || null,
        },
      };
    });

    const calculatedEdges: Edge[] = [];
    chapterContracts.forEach((contract, index) => {
      if (index < chapterContracts.length - 1) {
        calculatedEdges.push({
          id: `edge-${contract.chapter_id}-${chapterContracts[index + 1].chapter_id}`,
          source: contract.chapter_id,
          target: chapterContracts[index + 1].chapter_id,
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
        });
      }
    });

    setNodes(calculatedNodes);
    setEdges(calculatedEdges);
  }, [chapterContracts, authoredMap]);

  // Save node position to store only on drag stop (no lag during dragging)
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      setNodePosition(node.id, node.position);
    },
    [setNodePosition]
  );

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      setSelectedChapterId(node.id);
      setIsDrawerOpen(true);
    },
    [setSelectedChapterId]
  );

  const resetLayout = useCallback(() => {
    chapterContracts.forEach((contract, index) => {
      const x = index * 360 + 50;
      const y = 160 + (index % 2 === 1 ? 50 : 0);
      setNodePosition(contract.chapter_id, { x, y });
    });

    setNodes((prevNodes) =>
      prevNodes.map((n, idx) => ({
        ...n,
        position: {
          x: idx * 360 + 50,
          y: 160 + (idx % 2 === 1 ? 50 : 0),
        },
      }))
    );

    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [chapterContracts, setNodePosition, setNodes, fitView]);

  const handleAddChapter = useCallback(() => {
    addChapterContract();
  }, [addChapterContract]);

  const selectedContract = chapterContracts.find((c) => c.chapter_id === selectedChapterId);
  const selectedAuthored = authoredMap[selectedChapterId || ''];

  return (
    <div className="relative w-full h-full bg-[#060911]">
      {/* Story Arc Header Pill */}
      {storyArc && (
        <div className="absolute top-4 left-4 z-10 glass-panel rounded-xl p-4 max-w-lg border border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-sm text-slate-100">{storyArc.title}</h2>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              {storyArc.genre}
            </span>
          </div>
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            {storyArc.central_conflict}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {traitVocabulary.map((t) => (
              <span
                key={t.name}
                className="text-[10px] font-mono px-2 py-0.5 rounded border"
                style={{
                  backgroundColor: `${t.color_hex}15`,
                  borderColor: `${t.color_hex}40`,
                  color: t.color_hex,
                }}
              >
                ◆ {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Canvas Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 glass-panel p-1.5 rounded-xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-1 px-2 text-[10px] text-slate-400 font-mono border-r border-slate-800 pr-2">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>{chapterContracts.length} Chapters</span>
        </div>

        <button
          onClick={handleAddChapter}
          title="Add a new chapter contract"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md shadow-blue-600/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add Chapter
        </button>

        <button
          onClick={resetLayout}
          title="Reset to clean auto-layout"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-all font-mono"
        >
          <Grid3X3 className="w-3.5 h-3.5" /> Auto Layout
        </button>

        <button
          onClick={() => fitView({ padding: 0.15, duration: 400 })}
          title="Fit all nodes in view"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-all font-mono"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Fit View
        </button>
      </div>

      {chapterContracts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center p-6 glass-panel rounded-2xl border border-slate-800 pointer-events-auto">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 text-sm font-medium">No chapter contracts yet.</p>
            <p className="text-slate-500 text-xs mt-1 mb-4">
              Run Stage 2 to generate the story structure, or create chapters manually.
            </p>
            <button
              onClick={handleAddChapter}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" /> Create First Chapter
            </button>
          </div>
        </div>
      )}

      {/* Main Graph Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={24} size={1} />
        <Controls className="glass-panel border-slate-800 rounded-lg overflow-hidden fill-slate-300" />
        <MiniMap
          nodeColor="#3b82f6"
          maskColor="rgba(6, 9, 17, 0.85)"
          className="glass-panel border border-slate-800 rounded-xl"
        />
      </ReactFlow>

      {/* Slide-out Chapter Inspector Drawer */}
      {isDrawerOpen && selectedContract && (
        <div className="absolute top-0 right-0 w-96 h-full bg-[#0a0f1d]/95 backdrop-blur-xl border-l border-slate-800 z-20 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                CH {selectedContract.order}
              </span>
              <span className="text-xs font-mono text-slate-400">{selectedContract.chapter_id}</span>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Edit3 className="w-3 h-3 text-blue-400" /> Chapter Title
              </label>
              <input
                type="text"
                value={selectedContract.title}
                onChange={(e) =>
                  updateChapterContract(selectedContract.chapter_id, { title: e.target.value })
                }
                className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none transition-colors"
              />
            </div>

            {/* Narrative Scope */}
            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                Narrative Scope & Conflict
              </label>
              <textarea
                rows={4}
                value={selectedContract.narrative_scope}
                onChange={(e) =>
                  updateChapterContract(selectedContract.chapter_id, {
                    narrative_scope: e.target.value,
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none resize-none leading-relaxed transition-colors"
              />
            </div>

            {/* Locations */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" /> Entry Location
                </label>
                <input
                  type="text"
                  value={selectedContract.entry_state?.location || ''}
                  onChange={(e) =>
                    updateChapterContract(selectedContract.chapter_id, {
                      entry_state: { ...selectedContract.entry_state, location: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400" /> Exit Location
                </label>
                <input
                  type="text"
                  value={selectedContract.exit_state?.location || ''}
                  onChange={(e) =>
                    updateChapterContract(selectedContract.chapter_id, {
                      exit_state: { ...selectedContract.exit_state, location: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                />
              </div>
            </div>

            {/* Scenes Breakdown */}
            {selectedAuthored?.scenes?.length ? (
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 mb-2">
                  <Film className="w-3.5 h-3.5 text-blue-400" />
                  <span>Authored Scenes ({selectedAuthored.scenes.length})</span>
                </div>
                <div className="space-y-2">
                  {selectedAuthored.scenes.map((sc: any, idx: number) => (
                    <div
                      key={sc.scene_id || idx}
                      className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 text-xs"
                    >
                      <div className="font-semibold text-slate-200 mb-0.5">{sc.title}</div>
                      <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">
                        {sc.prose}
                      </p>
                      {sc.emotional_beat && (
                        <span className="inline-block mt-1 text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/20">
                          {sc.emotional_beat}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
            <button
              onClick={() => {
                setActiveView('dialogue');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in Chapter Detail & Dialogue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const StoryOverview: React.FC = () => {
  return (
    <ReactFlowProvider>
      <StoryOverviewInner />
    </ReactFlowProvider>
  );
};
