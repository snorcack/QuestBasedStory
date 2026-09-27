import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useStoryStore } from '../store/useStoryStore';
import { DialogueNodeComponent } from '../nodes/DialogueNode';
import { DialogueNode, DialogueChoice } from '../types';
import {
  NodeCreationPopup,
  NewNodePayload,
} from '../components/dialogue/NodeCreationPopup';
import { SceneProseEditor } from '../components/dialogue/SceneProseEditor';
import {
  MessageSquare,
  BookOpen,
  Plus,
  Maximize2,
  Grid3X3,
  X,
  Trash2,
  GitBranch,
  User,
  ArrowRight,
  Sparkles,
  Layers,
  Award,
  Undo2,
  Redo2,
} from 'lucide-react';

const nodeTypes = {
  dialogueNode: DialogueNodeComponent,
};

const DialogueEditorInner: React.FC = () => {
  const {
    chapters,
    chapterContracts,
    selectedChapterId,
    setSelectedChapterId,
    characters,
    worldBible,
    traitVocabulary,
    dialogueNodePositions,
    setDialogueNodePosition,
    addDialogueNode,
    updateDialogueNode,
    removeDialogueNode,
    undoDialogue,
    redoDialogue,
    canUndoDialogue,
    canRedoDialogue,
  } = useStoryStore();

  const { fitView } = useReactFlow();

  // All available chapter IDs from contracts and chapters
  const allChapterIds = useMemo(() => {
    const ids = new Set<string>();
    chapterContracts.forEach((c) => ids.add(c.chapter_id));
    chapters.forEach((c) => ids.add(c.chapter_id));
    return Array.from(ids);
  }, [chapterContracts, chapters]);

  // Current active chapter ID
  const activeChapterId = selectedChapterId || allChapterIds[0] || 'chapter_01';

  // Active authored chapter
  const activeChapter = chapters.find((c) => c.chapter_id === activeChapterId);
  const activeContract = chapterContracts.find((c) => c.chapter_id === activeChapterId);

  // Inspector Drawer state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const canUndo = canUndoDialogue(activeChapterId);
  const canRedo = canRedoDialogue(activeChapterId);

  // Keyboard shortcuts for Dialogue Undo (Ctrl+Z / Cmd+Z) and Redo (Ctrl+Y / Shift+Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (canRedoDialogue(activeChapterId)) {
            redoDialogue(activeChapterId);
          }
        } else {
          e.preventDefault();
          if (canUndoDialogue(activeChapterId)) {
            undoDialogue(activeChapterId);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (canRedoDialogue(activeChapterId)) {
          redoDialogue(activeChapterId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChapterId, canUndoDialogue, canRedoDialogue, undoDialogue, redoDialogue]);

  // High performance React Flow states
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ── Drag-to-create state ──
  const canvasRef = useRef<HTMLDivElement>(null);
  const [plusDrag, setPlusDrag] = useState<{
    sourceNodeId: string;
    startX: number; // relative to canvas
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [creationPopup, setCreationPopup] = useState<{
    position: { x: number; y: number }; // screen px
    parentNodeId: string;
    parentNodeText: string;
    newNodeId: string;
    canvasDropX: number; // canvas-relative for node placement
    canvasDropY: number;
  } | null>(null);

  // Ref to always point at latest onPlusHandleDragStart without causing circular deps
  const plusHandleDragStartRef = useRef<((nodeId: string, event: React.MouseEvent) => void) | null>(null);

  // Synchronize chapter's dialogue_tree into nodes & edges
  useEffect(() => {
    const dialogueTree = activeChapter?.dialogue_tree || [];
    const calculatedNodes: Node[] = [];
    const calculatedEdges: Edge[] = [];

    dialogueTree.forEach((dNode, index) => {
      const posKey = `${activeChapterId}_${dNode.node_id}`;
      const defaultX = (index % 3) * 360 + 60;
      const defaultY = Math.floor(index / 3) * 320 + 80;
      const pos = dialogueNodePositions[posKey] || { x: defaultX, y: defaultY };

      calculatedNodes.push({
        id: dNode.node_id,
        type: 'dialogueNode',
        position: pos,
        data: {
          ...dNode,
          chapterId: activeChapterId,
          onEdit: (id: string) => setSelectedNodeId(id),
          onPlusHandleDragStart: (nodeId: string, e: React.MouseEvent) =>
            plusHandleDragStartRef.current?.(nodeId, e),
        },
      });

      // Linear connection
      if (dNode.next_node) {
        calculatedEdges.push({
          id: `edge-${dNode.node_id}-${dNode.next_node}`,
          source: dNode.node_id,
          target: dNode.next_node,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 },
        });
      }

      // Choice branches
      dNode.choices?.forEach((choice, cIdx) => {
        if (choice.next_node) {
          calculatedEdges.push({
            id: `edge-${dNode.node_id}-choice${cIdx}-${choice.next_node}`,
            source: dNode.node_id,
            sourceHandle: 'choice-branch',
            target: choice.next_node,
            animated: true,
            style: {
              stroke: choice.trait_tag ? '#f59e0b' : '#38bdf8',
              strokeWidth: 1.8,
            },
          });
        }
      });
    });

    setNodes(calculatedNodes);
    setEdges(calculatedEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter, activeChapterId]);

  // Save node position to store on drag stop
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      const posKey = `${activeChapterId}_${node.id}`;
      setDialogueNodePosition(posKey, node.position);
    },
    [activeChapterId, setDialogueNodePosition]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // ── Duplicate connection guard ──
  const isDuplicateChoice = useCallback(
    (node: DialogueNode, targetId: string) => {
      return node.choices?.some((c) => c.next_node === targetId) ?? false;
    },
    []
  );

  // ── Connect-as-choice (wire dragging or plus handle drop onto existing node) ──
  const connectAsChoice = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const sourceNode = activeChapter?.dialogue_tree?.find((n) => n.node_id === sourceId);
      if (!sourceNode) return;
      if (isDuplicateChoice(sourceNode, targetId)) return;

      const newChoice: DialogueChoice = {
        label: `Choice ${(sourceNode.choices?.length || 0) + 1}`,
        trait_tag: null,
        next_node: targetId,
      };

      // Always add choice; if previously a linear or end node, retain or evolve gracefully
      updateDialogueNode(activeChapterId, sourceId, {
        type: sourceNode.type === 'end' ? 'speaker' : sourceNode.type,
        choices: [...(sourceNode.choices || []), newChoice],
      });
    },
    [activeChapter, activeChapterId, updateDialogueNode, isDuplicateChoice]
  );

  // Connect nodes by dragging wires between handles -> Always creates a choice
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return;
      connectAsChoice(params.source, params.target);
    },
    [connectAsChoice]
  );

  // ── ID generation helper ──
  const generateNextNodeId = useCallback(
    (tree: DialogueNode[]) => {
      const prefix = `node_${activeChapterId}_`;
      const nums = tree
        .map((n) => parseInt(n.node_id.replace(prefix, ''), 10))
        .filter((n) => !isNaN(n));
      const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      return `${prefix}${String(next).padStart(2, '0')}`;
    },
    [activeChapterId]
  );

  // ── Plus handle: drag start ──
  const onPlusHandleDragStart = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      setPlusDrag({ sourceNodeId: nodeId, startX, startY, currentX: startX, currentY: startY });

      const onMouseMove = (e: MouseEvent) => {
        const r = canvas.getBoundingClientRect();
        setPlusDrag((prev) =>
          prev ? { ...prev, currentX: e.clientX - r.left, currentY: e.clientY - r.top } : null
        );
      };

      const onMouseUp = (e: MouseEvent) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        // Hit-test: is cursor over an existing node?
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let targetNodeId: string | null = null;
        for (const el of elements) {
          const nid = (el as HTMLElement).getAttribute?.('data-nodeid');
          if (nid && nid !== nodeId) { targetNodeId = nid; break; }
          // walk up to parent elements
          let parent = (el as HTMLElement).parentElement;
          while (parent) {
            const pid = parent.getAttribute('data-nodeid');
            if (pid && pid !== nodeId) { targetNodeId = pid; break; }
            parent = parent.parentElement;
          }
          if (targetNodeId) break;
        }

        if (targetNodeId) {
          // Drop on existing node → connect as choice
          connectAsChoice(nodeId, targetNodeId);
          setPlusDrag(null);
        } else {
          // Drop on canvas → open creation popup
          const r2 = canvas.getBoundingClientRect();
          const canvasDropX = e.clientX - r2.left;
          const canvasDropY = e.clientY - r2.top;
          const sourceNode = activeChapter?.dialogue_tree?.find((n) => n.node_id === nodeId);
          const tree = activeChapter?.dialogue_tree || [];
          setCreationPopup({
            position: { x: e.clientX, y: e.clientY },
            parentNodeId: nodeId,
            parentNodeText: sourceNode?.text || '',
            newNodeId: generateNextNodeId(tree),
            canvasDropX,
            canvasDropY,
          });
          setPlusDrag(null);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [activeChapter, generateNextNodeId, connectAsChoice]
  );

  // Keep ref up to date
  plusHandleDragStartRef.current = onPlusHandleDragStart;

  // ── Popup confirm ──
  const onPopupConfirm = useCallback(
    (payload: NewNodePayload) => {
      if (!creationPopup) return;
      const { parentNodeId, newNodeId, canvasDropX, canvasDropY } = creationPopup;

      // 1. Add the new node
      addDialogueNode(activeChapterId, payload.node);
      setDialogueNodePosition(`${activeChapterId}_${newNodeId}`, {
        x: canvasDropX - 160,
        y: canvasDropY + 20,
      });

      // 2. Update parent: add connecting choice (dedup)
      const parentNode = activeChapter?.dialogue_tree?.find((n) => n.node_id === parentNodeId);
      if (parentNode && !isDuplicateChoice(parentNode, newNodeId)) {
        const connectChoice: DialogueChoice = {
          label: payload.connectingChoiceLabel,
          trait_tag: payload.connectingChoiceTrait || null,
          next_node: newNodeId,
        };
        updateDialogueNode(activeChapterId, parentNodeId, {
          choices: [...(parentNode.choices || []), connectChoice],
        });
      }

      // 3. Additional choices on the new node are already embedded in payload.node.choices
      //    (set by the popup). They reference existing node IDs.

      setCreationPopup(null);
      setSelectedNodeId(newNodeId);
    },
    [creationPopup, activeChapter, activeChapterId, addDialogueNode, setDialogueNodePosition, updateDialogueNode, isDuplicateChoice]
  );

  // Add new Dialogue Node
  const handleAddNode = useCallback(() => {
    const existing = activeChapter?.dialogue_tree || [];
    const nextNum = existing.length + 1;
    const newId = `node_${activeChapterId}_${String(nextNum).padStart(2, '0')}`;
    const x = (existing.length % 3) * 360 + 80;
    const y = Math.floor(existing.length / 3) * 280 + 100;

    addDialogueNode(activeChapterId, {
      node_id: newId,
      speaker: characters[0]?.name || 'Narrator',
      text: 'New dialogue beat or interaction...',
      type: 'speaker',
      choices: [],
      next_node: null,
    });

    setDialogueNodePosition(`${activeChapterId}_${newId}`, { x, y });
    setSelectedNodeId(newId);
  }, [activeChapter, activeChapterId, characters, addDialogueNode, setDialogueNodePosition]);

  // Reset to auto layout
  const resetLayout = useCallback(() => {
    const dialogueTree = activeChapter?.dialogue_tree || [];
    dialogueTree.forEach((dNode, index) => {
      const x = (index % 3) * 360 + 60;
      const y = Math.floor(index / 3) * 280 + 80;
      setDialogueNodePosition(`${activeChapterId}_${dNode.node_id}`, { x, y });
    });

    setNodes((prev) =>
      prev.map((n, idx) => ({
        ...n,
        position: {
          x: (idx % 3) * 360 + 60,
          y: Math.floor(idx / 3) * 280 + 80,
        },
      }))
    );

    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [activeChapter, activeChapterId, setDialogueNodePosition, setNodes, fitView]);

  // Selected Node data
  const selectedNode = activeChapter?.dialogue_tree?.find((n) => n.node_id === selectedNodeId);

  // List of all characters for speaker dropdown
  const speakerOptions = useMemo(() => {
    const list = ['Narrator', 'Player'];
    characters.forEach((c) => {
      if (c.name && !list.includes(c.name)) list.push(c.name);
    });
    worldBible?.npcs?.forEach((npc) => {
      if (npc.name && !list.includes(npc.name)) list.push(npc.name);
    });
    return list;
  }, [characters, worldBible]);

  return (
    <>
    <div className="relative w-full h-full flex bg-[#060911]">
      {/* Chapter Selection & Prose Left Sidebar */}
      <div className="w-84 h-full border-r border-slate-800/80 glass-panel flex flex-col z-10 shrink-0 bg-[#070b16]/95 backdrop-blur-md">
        <div className="p-4 border-b border-slate-800">
          <label className="text-[10px] font-mono text-slate-400 block mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" /> SELECT CHAPTER
          </label>
          <select
            value={activeChapterId}
            onChange={(e) => {
              setSelectedChapterId(e.target.value);
              setSelectedNodeId(null);
            }}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg p-2.5 font-mono outline-none focus:border-blue-500 shadow-sm transition-colors"
          >
            {allChapterIds.map((chId) => {
              const ch = chapters.find((c) => c.chapter_id === chId);
              const contract = chapterContracts.find((c) => c.chapter_id === chId);
              const nodeCount = ch?.dialogue_tree?.length || 0;
              const title = contract?.title || chId;
              return (
                <option key={chId} value={chId}>
                  {title} ({nodeCount} nodes)
                </option>
              );
            })}
          </select>
        </div>

        {/* Interactive Scene Prose Beats Panel */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <SceneProseEditor
            chapterId={activeChapterId}
            chapterTitle={activeContract?.title}
            chapterContext={activeContract?.narrative_scope}
          />

          {activeChapter?.critic_score && (
            <div className="mt-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs shrink-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-400 font-mono flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-400" /> CRITIC SCORE
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  {activeChapter.critic_score} / 100
                </span>
              </div>
              <p className="text-[11px] text-slate-300 italic leading-relaxed">
                "{activeChapter.critic_notes}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* React Flow Dialogue Canvas */}
      <div className="flex-1 h-full relative">
        {/* Top Canvas Toolbar */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 glass-panel p-1.5 rounded-xl border border-slate-800 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 px-2 text-[10px] text-slate-400 font-mono border-r border-slate-800 pr-2">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>{activeChapter?.dialogue_tree?.length || 0} Nodes</span>
          </div>

          {/* Dialogue Tree Undo / Redo */}
          <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
            <button
              onClick={() => undoDialogue(activeChapterId)}
              disabled={!canUndo}
              title="Undo dialogue edit (Ctrl+Z)"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => redoDialogue(activeChapterId)}
              disabled={!canRedo}
              title="Redo dialogue edit (Ctrl+Y)"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleAddNode}
            title="Add a new dialogue node to this chapter"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Node
          </button>

          <button
            onClick={resetLayout}
            title="Auto organize nodes into neat grid"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-all font-mono"
          >
            <Grid3X3 className="w-3.5 h-3.5" /> Auto Layout
          </button>

          <button
            onClick={() => fitView({ padding: 0.2, duration: 400 })}
            title="Fit all nodes in view"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-all font-mono"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Fit View
          </button>
        </div>

        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 select-none">
            <MessageSquare className="w-14 h-14 mb-3 text-slate-700" />
            <p className="text-sm font-semibold text-slate-300">
              No dialogue trees in {activeChapterId}
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Add your first interactive dialogue node or generate with the Branch Keeper agent.
            </p>
            <button
              onClick={handleAddNode}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" /> Create First Node
            </button>
          </div>
        ) : (
          <div ref={canvasRef} className="w-full h-full relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onConnect={onConnect}
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
                nodeColor="#6366f1"
                maskColor="rgba(6, 9, 17, 0.85)"
                className="glass-panel border border-slate-800 rounded-xl"
              />
            </ReactFlow>

            {/* Ghost SVG line while dragging + handle */}
            {plusDrag && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-30"
                style={{ left: 0, top: 0 }}
              >
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#6366f1" opacity={0.8} />
                  </marker>
                </defs>
                <line
                  x1={plusDrag.startX}
                  y1={plusDrag.startY}
                  x2={plusDrag.currentX}
                  y2={plusDrag.currentY}
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  strokeLinecap="round"
                  markerEnd="url(#arrowhead)"
                />
                <circle cx={plusDrag.currentX} cy={plusDrag.currentY} r={6} fill="#6366f1" opacity={0.7} />
              </svg>
            )}
          </div>
        )}

        {/* Slide-out Node Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-0 right-0 w-96 h-full bg-[#0a0f1d]/95 backdrop-blur-xl border-l border-slate-800 z-20 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                  {selectedNode.type.toUpperCase()}
                </span>
                <span className="text-xs font-mono text-slate-300 font-bold">
                  {selectedNode.node_id}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (window.confirm(`Delete node ${selectedNode.node_id}?`)) {
                      removeDialogueNode(activeChapterId, selectedNode.node_id);
                      setSelectedNodeId(null);
                    }
                  }}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Delete Node"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inspector Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Speaker */}
              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" /> Speaker
                </label>
                <input
                  type="text"
                  list="speaker-list"
                  value={selectedNode.speaker}
                  onChange={(e) =>
                    updateDialogueNode(activeChapterId, selectedNode.node_id, {
                      speaker: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none transition-colors font-sans"
                />
                <datalist id="speaker-list">
                  {speakerOptions.map((spk) => (
                    <option key={spk} value={spk} />
                  ))}
                </datalist>
              </div>

              {/* Node Type */}
              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Node Type
                </label>
                <select
                  value={selectedNode.type}
                  onChange={(e) =>
                    updateDialogueNode(activeChapterId, selectedNode.node_id, {
                      type: e.target.value as any,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                >
                  <option value="speaker">Speaker Dialogue</option>
                  <option value="choice">Player Choice Branch</option>
                  <option value="flag">State / World Flag Check</option>
                  <option value="end">End of Scene / Chapter</option>
                </select>
              </div>

              {/* Dialogue Text */}
              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Dialogue / Narration Text
                </label>
                <textarea
                  rows={4}
                  value={selectedNode.text}
                  onChange={(e) =>
                    updateDialogueNode(activeChapterId, selectedNode.node_id, {
                      text: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none resize-none leading-relaxed transition-colors font-sans"
                  placeholder="What is spoken or described in this beat?"
                />
              </div>

              {/* Next Node (Linear) */}
              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Direct Next Node</span>
                  {selectedNode.next_node && (
                    <button
                      onClick={() =>
                        updateDialogueNode(activeChapterId, selectedNode.node_id, {
                          next_node: null,
                        })
                      }
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Clear Link
                    </button>
                  )}
                </label>
                <select
                  value={selectedNode.next_node || ''}
                  onChange={(e) =>
                    updateDialogueNode(activeChapterId, selectedNode.node_id, {
                      next_node: e.target.value || null,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                >
                  <option value="">None / Branching</option>
                  {activeChapter?.dialogue_tree
                    ?.filter((n) => n.node_id !== selectedNode.node_id)
                    .map((n) => (
                      <option key={n.node_id} value={n.node_id}>
                        {n.node_id} ({n.speaker})
                      </option>
                    ))}
                </select>
              </div>

              {/* Player Choices / Branching Options */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-amber-400" /> Player Choices ({selectedNode.choices?.length || 0})
                  </label>
                  <button
                    onClick={() => {
                      const newChoice: DialogueChoice = {
                        label: `Choice ${(selectedNode.choices?.length || 0) + 1}`,
                        trait_tag: null,
                        next_node: null,
                      };
                      updateDialogueNode(activeChapterId, selectedNode.node_id, {
                        choices: [...(selectedNode.choices || []), newChoice],
                      });
                    }}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20"
                  >
                    <Plus className="w-3 h-3" /> Add Choice
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedNode.choices?.map((choice, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400">
                          Option #{cIdx + 1}
                        </span>
                        <button
                          onClick={() => {
                            const updated = selectedNode.choices?.filter((_, i) => i !== cIdx);
                            updateDialogueNode(activeChapterId, selectedNode.node_id, {
                              choices: updated,
                            });
                          }}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Remove Choice"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Choice Label */}
                      <div>
                        <input
                          type="text"
                          value={choice.label}
                          placeholder="Player dialog option..."
                          onChange={(e) => {
                            const updated = [...(selectedNode.choices || [])];
                            updated[cIdx] = { ...updated[cIdx], label: e.target.value };
                            updateDialogueNode(activeChapterId, selectedNode.node_id, {
                              choices: updated,
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                        />
                      </div>

                      {/* Trait Tag & Next Node Target */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-mono text-slate-400 block mb-1">
                            Trait Bonus
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. CUNNING"
                            value={choice.trait_tag || ''}
                            onChange={(e) => {
                              const updated = [...(selectedNode.choices || [])];
                              updated[cIdx] = {
                                ...updated[cIdx],
                                trait_tag: e.target.value ? e.target.value.toUpperCase() : null,
                              };
                              updateDialogueNode(activeChapterId, selectedNode.node_id, {
                                choices: updated,
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-mono text-slate-400 block mb-1">
                            Next Node Target
                          </label>
                          <select
                            value={choice.next_node || ''}
                            onChange={(e) => {
                              const updated = [...(selectedNode.choices || [])];
                              updated[cIdx] = {
                                ...updated[cIdx],
                                next_node: e.target.value || null,
                              };
                              updateDialogueNode(activeChapterId, selectedNode.node_id, {
                                choices: updated,
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-400 rounded-lg px-2 py-1 text-[11px] text-slate-200 font-mono outline-none"
                          >
                            <option value="">Unlinked</option>
                            {activeChapter?.dialogue_tree
                              ?.filter((n) => n.node_id !== selectedNode.node_id)
                              .map((n) => (
                                <option key={n.node_id} value={n.node_id}>
                                  {n.node_id}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-center">
              <span className="text-[10px] font-mono text-slate-500">
                Changes saved automatically to story store
              </span>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Node Creation Popup */}
    <NodeCreationPopup
      isOpen={!!creationPopup}
      position={creationPopup?.position || { x: 0, y: 0 }}
      parentNodeId={creationPopup?.parentNodeId || ''}
      parentNodeText={creationPopup?.parentNodeText || ''}
      chapterId={activeChapterId}
      chapterTitle={activeContract?.title || activeChapterId}
      newNodeId={creationPopup?.newNodeId || ''}
      allNodes={activeChapter?.dialogue_tree || []}
      characters={characters}
      onConfirm={onPopupConfirm}
      onCancel={() => setCreationPopup(null)}
    />
    </>
  );
};

export const DialogueEditor: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DialogueEditorInner />
    </ReactFlowProvider>
  );
};
