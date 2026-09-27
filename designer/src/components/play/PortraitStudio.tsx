import React, { useState, useEffect } from 'react';
import { useStoryStore } from '../../store/useStoryStore';
import { CharacterPortrait } from './CharacterPortrait';
import { PortraitLightbox } from './PortraitLightbox';
import { Character, NPC } from '../../types';
import {
  Sparkles,
  Cpu,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Link,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Sliders,
  Play,
  Save,
  Loader2,
  ExternalLink,
  Maximize2,
  Images,
  Plus,
  Star,
} from 'lucide-react';

const roleColors: Record<string, string> = {
  protagonist: '#3b82f6',
  antagonist: '#ef4444',
  ally: '#10b981',
  neutral: '#6b7280',
  antagonist_ally: '#f59e0b',
  npc: '#8b5cf6',
};

// Default minimal SD1.5/SDXL txt2img ComfyUI workflow template
const DEFAULT_COMFY_WORKFLOW = {
  "3": {
    "inputs": {
      "seed": 156680208700286,
      "steps": 20,
      "cfg": 7,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler"
  },
  "4": {
    "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" },
    "class_type": "CheckpointLoaderSimple"
  },
  "5": {
    "inputs": { "width": 512, "height": 512, "batch_size": 1 },
    "class_type": "EmptyLatentImage"
  },
  "6": {
    "inputs": {
      "text": "character portrait, highly detailed, digital art",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": {
      "text": "low quality, blurry, deformed, disfigured, bad anatomy",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
    "class_type": "VAEDecode"
  },
  "9": {
    "inputs": { "filename_prefix": "QuestForge_Portrait", "images": ["8", 0] },
    "class_type": "SaveImage"
  }
};

export const PortraitStudio: React.FC = () => {
  const {
    characters,
    worldBible,
    currentProjectId,
    updateCharacter,
    updateNPC,
  } = useStoryStore();

  // ComfyUI config state
  const [comfyUrl, setComfyUrl] = useState<string>(() => {
    return localStorage.getItem('questforge_comfy_url') || 'http://127.0.0.1:8005';
  });
  const [promptNodeId, setPromptNodeId] = useState<string>(() => {
    return localStorage.getItem('questforge_prompt_node_id') || '6';
  });
  const [outputNodeId, setOutputNodeId] = useState<string>(() => {
    return localStorage.getItem('questforge_output_node_id') || '9';
  });
  const [workflowJson, setWorkflowJson] = useState<any>(() => {
    const saved = localStorage.getItem('questforge_workflow_json');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return DEFAULT_COMFY_WORKFLOW;
  });

  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'testing' | 'connected' | 'error'>('untested');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Filter & search
  const [filterType, setFilterType] = useState<'all' | 'characters' | 'npcs'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Generation status per entity id
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [statusMap, setStatusMap] = useState<Record<string, { status: 'idle' | 'generating' | 'success' | 'error'; message?: string }>>({});
  const [isBatchGeneratingPrompts, setIsBatchGeneratingPrompts] = useState(false);
  const [isBatchGeneratingImages, setIsBatchGeneratingImages] = useState(false);
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});

  // Lightbox enlarged view state
  const [lightboxEntity, setLightboxEntity] = useState<{
    id: string;
    name: string;
    role: string;
    isNpc: boolean;
    images: string[];
    currentImageUrl: string;
    promptText?: string | null;
  } | null>(null);

  // Save ComfyUI settings to localStorage
  useEffect(() => {
    localStorage.setItem('questforge_comfy_url', comfyUrl);
  }, [comfyUrl]);

  useEffect(() => {
    localStorage.setItem('questforge_prompt_node_id', promptNodeId);
    localStorage.setItem('questforge_output_node_id', outputNodeId);
  }, [promptNodeId, outputNodeId]);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError(null);
    setConnectionMessage(null);
    try {
      const res = await fetch('/api/portraits/comfyui/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comfyui_url: comfyUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setConnectionStatus('connected');
        setConnectionMessage(data.message || 'Connected successfully!');
      } else {
        setConnectionStatus('error');
        setConnectionError(data.detail || 'Connection test failed');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionError(err.message || 'Cannot reach QuestForge backend to test ComfyUI');
    }
  };

  const handleWorkflowUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        setWorkflowJson(parsed);
        localStorage.setItem('questforge_workflow_json', JSON.stringify(parsed));

        // Auto-detect nodes
        let detectedPrompt: string | null = null;
        let detectedOutput: string | null = null;

        if (Array.isArray(parsed.nodes)) {
          // UI format (like KreaCharacterGen.json)
          for (const node of parsed.nodes) {
            if (node.type === 'CLIPTextEncode' && !detectedPrompt) {
              detectedPrompt = String(node.id);
            }
            if ((node.type === 'SaveImage' || node.type === 'ImageSave') && !detectedOutput) {
              detectedOutput = String(node.id);
            }
          }
        } else if (typeof parsed === 'object') {
          // API format
          for (const [nid, ndata] of Object.entries(parsed)) {
            const ctype = (ndata as any)?.class_type;
            if (ctype === 'CLIPTextEncode' && !detectedPrompt) {
              detectedPrompt = nid;
            }
            if ((ctype === 'SaveImage' || ctype === 'ImageSave') && !detectedOutput) {
              detectedOutput = nid;
            }
          }
        }

        if (detectedPrompt) {
          setPromptNodeId(detectedPrompt);
          localStorage.setItem('questforge_prompt_node_id', detectedPrompt);
        }
        if (detectedOutput) {
          setOutputNodeId(detectedOutput);
          localStorage.setItem('questforge_output_node_id', detectedOutput);
        }

        const isUIFormat = Array.isArray(parsed.nodes);
        alert(
          `Workflow "${file.name}" loaded!\n` +
          `• Format: ${isUIFormat ? 'UI Graph (Auto-converted)' : 'API Format'}\n` +
          `• Prompt Node ID: ${detectedPrompt || promptNodeId}\n` +
          `• Output Node ID: ${detectedOutput || outputNodeId}`
        );
      } catch (err: any) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Generate prompts via LLM for all characters + NPCs
  const handleGenerateAllPrompts = async () => {
    if (!currentProjectId) {
      alert('Please select or open an active project first.');
      return;
    }
    setIsBatchGeneratingPrompts(true);
    try {
      const res = await fetch('/api/portraits/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          include_npcs: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to generate prompts');

      if (data.prompts && Array.isArray(data.prompts)) {
        for (const p of data.prompts) {
          if (p.type === 'npc') {
            updateNPC(p.id, { portrait_prompt: p.portrait_prompt });
          } else {
            updateCharacter(p.id, { portrait_prompt: p.portrait_prompt });
          }
        }
      }
    } catch (err: any) {
      alert(`Prompt generation error: ${err.message}`);
    } finally {
      setIsBatchGeneratingPrompts(false);
    }
  };

  // Generate single prompt for an entity
  const handleGenerateSinglePrompt = async (id: string, isNpc: boolean) => {
    if (!currentProjectId) return;
    setStatusMap(prev => ({ ...prev, [id]: { status: 'generating', message: 'Generating prompt...' } }));
    try {
      const res = await fetch('/api/portraits/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          character_id: id,
          include_npcs: isNpc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      const found = data.prompts?.find((p: any) => p.id === id);
      if (found) {
        if (isNpc) {
          updateNPC(id, { portrait_prompt: found.portrait_prompt });
        } else {
          updateCharacter(id, { portrait_prompt: found.portrait_prompt });
        }
        setStatusMap(prev => ({ ...prev, [id]: { status: 'success', message: 'Prompt created' } }));
      }
    } catch (err: any) {
      setStatusMap(prev => ({ ...prev, [id]: { status: 'error', message: err.message } }));
    }
  };

  // Generate image via ComfyUI proxy for a single entity
  const handleGenerateImage = async (entity: { id: string; portrait_prompt?: string | null }, isNpc: boolean) => {
    if (!currentProjectId) {
      alert('Please open an active project.');
      return;
    }
    if (!entity.portrait_prompt?.trim()) {
      alert('Please enter or generate a portrait prompt first.');
      return;
    }

    setGeneratingIds(prev => new Set(prev).add(entity.id));
    setStatusMap(prev => ({ ...prev, [entity.id]: { status: 'generating', message: 'Queueing in ComfyUI...' } }));

    try {
      const res = await fetch('/api/portraits/comfyui/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          character_id: entity.id,
          portrait_prompt: entity.portrait_prompt,
          comfyui_url: comfyUrl.replace(/\/$/, ''),
          workflow_json: workflowJson,
          prompt_node_id: promptNodeId,
          output_node_id: outputNodeId,
          is_npc: isNpc,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'ComfyUI generation failed');

      if (data.portrait_url) {
        const bustUrl = `${data.portrait_url}?t=${Date.now()}`;
        const newGallery = (data.portrait_gallery && data.portrait_gallery.length > 0)
          ? data.portrait_gallery.map((u: string) => u === data.portrait_url ? bustUrl : u)
          : [bustUrl];

        if (isNpc) {
          updateNPC(entity.id, { portrait_url: bustUrl, portrait_gallery: newGallery });
        } else {
          updateCharacter(entity.id, { portrait_url: bustUrl, portrait_gallery: newGallery });
        }
        setStatusMap(prev => ({ ...prev, [entity.id]: { status: 'success', message: 'Generated!' } }));
      }
    } catch (err: any) {
      setStatusMap(prev => ({ ...prev, [entity.id]: { status: 'error', message: err.message } }));
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(entity.id);
        return next;
      });
    }
  };

  // Set active primary portrait from gallery
  const handleSetActivePortrait = async (entityId: string, isNpc: boolean, targetUrl: string) => {
    if (!currentProjectId) return;
    try {
      const res = await fetch('/api/portraits/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          character_id: entityId,
          action: 'set_active',
          target_image_url: targetUrl,
          is_npc: isNpc,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isNpc) {
          updateNPC(entityId, { portrait_url: targetUrl, portrait_gallery: data.portrait_gallery });
        } else {
          updateCharacter(entityId, { portrait_url: targetUrl, portrait_gallery: data.portrait_gallery });
        }
        if (lightboxEntity && lightboxEntity.id === entityId) {
          setLightboxEntity({
            ...lightboxEntity,
            currentImageUrl: targetUrl,
            images: data.portrait_gallery || lightboxEntity.images,
          });
        }
      }
    } catch (err: any) {
      alert('Failed to set active portrait: ' + err.message);
    }
  };

  // Delete image from gallery
  const handleDeletePortrait = async (entityId: string, isNpc: boolean, targetUrl: string) => {
    if (!currentProjectId) return;
    try {
      const res = await fetch('/api/portraits/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          character_id: entityId,
          action: 'delete_image',
          target_image_url: targetUrl,
          is_npc: isNpc,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isNpc) {
          updateNPC(entityId, { portrait_url: data.portrait_url, portrait_gallery: data.portrait_gallery });
        } else {
          updateCharacter(entityId, { portrait_url: data.portrait_url, portrait_gallery: data.portrait_gallery });
        }
        if (lightboxEntity && lightboxEntity.id === entityId) {
          setLightboxEntity({
            ...lightboxEntity,
            currentImageUrl: data.portrait_url || '',
            images: data.portrait_gallery || [],
          });
        }
      }
    } catch (err: any) {
      alert('Failed to delete image: ' + err.message);
    }
  };

  // Add custom image URL to gallery
  const handleAddImageUrl = async (entityId: string, isNpc: boolean, targetUrl: string) => {
    if (!currentProjectId || !targetUrl?.trim()) return;
    try {
      const res = await fetch('/api/portraits/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          character_id: entityId,
          action: 'add_image',
          target_image_url: targetUrl.trim(),
          is_npc: isNpc,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isNpc) {
          updateNPC(entityId, { portrait_url: targetUrl.trim(), portrait_gallery: data.portrait_gallery });
        } else {
          updateCharacter(entityId, { portrait_url: targetUrl.trim(), portrait_gallery: data.portrait_gallery });
        }
        setUrlDrafts(prev => ({ ...prev, [entityId]: '' }));
        setStatusMap(prev => ({ ...prev, [entityId]: { status: 'success', message: 'Added to gallery!' } }));
      }
    } catch (err: any) {
      alert('Failed to add image: ' + err.message);
    }
  };

  // Generate images for all visible entities that have prompts
  const handleGenerateAllImages = async () => {
    if (!currentProjectId) return;
    setIsBatchGeneratingImages(true);
    for (const char of characters) {
      if (char.portrait_prompt?.trim()) {
        await handleGenerateImage(char, false);
      }
    }
    if (worldBible?.npcs) {
      for (const npc of worldBible.npcs) {
        if (npc.portrait_prompt?.trim()) {
          await handleGenerateImage(npc, true);
        }
      }
    }
    setIsBatchGeneratingImages(false);
  };

  // Manually update portrait URL or prompt on backend
  const handleManualSave = async (id: string, isNpc: boolean, portraitUrl?: string | null, prompt?: string | null) => {
    if (!currentProjectId) return;
    try {
      await fetch('/api/portraits/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId,
          character_id: id,
          portrait_url: portraitUrl,
          portrait_prompt: prompt,
          is_npc: isNpc,
        }),
      });
      setStatusMap(prev => ({ ...prev, [id]: { status: 'success', message: 'Saved' } }));
      setTimeout(() => {
        setStatusMap(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 2000);
    } catch (err: any) {
      setStatusMap(prev => ({ ...prev, [id]: { status: 'error', message: 'Failed to save' } }));
    }
  };

  // Build entity list
  const charEntities = characters.map(c => ({
    id: c.id,
    name: c.name,
    role: c.role,
    isNpc: false,
    portrait_url: c.portrait_url,
    portrait_gallery: c.portrait_gallery || (c.portrait_url ? [c.portrait_url] : []),
    portrait_prompt: c.portrait_prompt,
    description: c.backstory || c.motivation || '',
  }));

  const npcEntities = (worldBible?.npcs || []).map(n => ({
    id: n.id,
    name: n.name,
    role: n.role || 'NPC',
    isNpc: true,
    portrait_url: n.portrait_url,
    portrait_gallery: n.portrait_gallery || (n.portrait_url ? [n.portrait_url] : []),
    portrait_prompt: n.portrait_prompt,
    description: n.personality || n.location || '',
  }));

  const allEntities = [...charEntities, ...npcEntities].filter(e => {
    if (filterType === 'characters' && e.isNpc) return false;
    if (filterType === 'npcs' && !e.isNpc) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Studio Intro */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">Portrait Studio</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              ComfyUI & Custom URL
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Generate AI portrait art for your novel's cast using local ComfyUI workflows, or paste custom image URLs. Portraits are shown across the Dialogue reader and Scene explorer.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              showConfig ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>ComfyUI Settings</span>
            {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={handleGenerateAllPrompts}
            disabled={isBatchGeneratingPrompts || !currentProjectId}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
          >
            {isBatchGeneratingPrompts ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Writing Prompts...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>✨ Generate All Prompts</span>
              </>
            )}
          </button>

          <button
            onClick={handleGenerateAllImages}
            disabled={isBatchGeneratingImages || !currentProjectId}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-all"
          >
            {isBatchGeneratingImages ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>Generating All...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-purple-400" />
                <span>🖼 Generate All Portraits</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ComfyUI Config Drawer */}
      {showConfig && (
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 bg-slate-950/80 animate-in fade-in duration-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-slate-200">ComfyUI Connection & Workflow</span>
            </div>
            {connectionStatus === 'connected' && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> {connectionMessage || 'Connected'}
              </span>
            )}
            {connectionStatus === 'error' && (
              <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                <AlertCircle className="w-3 h-3" /> Connection Failed
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ComfyUI URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">ComfyUI Instance URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comfyUrl}
                  onChange={e => setComfyUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8188"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-indigo-500 outline-none"
                />
                <button
                  onClick={testConnection}
                  disabled={connectionStatus === 'testing'}
                  className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-mono transition-colors disabled:opacity-50"
                >
                  {connectionStatus === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                </button>
              </div>
              {connectionError && <p className="text-[10px] text-red-400 mt-1">{connectionError}</p>}
            </div>

            {/* Prompt & Output Nodes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">Node Mapping</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Prompt Node ID:</span>
                  <input
                    type="text"
                    value={promptNodeId}
                    onChange={e => setPromptNodeId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Output Node ID:</span>
                  <input
                    type="text"
                    value={outputNodeId}
                    onChange={e => setOutputNodeId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Workflow Uploader */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">Custom Workflow Template</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-indigo-500 rounded-lg text-xs text-slate-300 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Upload .json Workflow</span>
                  <input type="file" accept=".json" onChange={handleWorkflowUpload} className="hidden" />
                </label>
                <button
                  onClick={() => {
                    setWorkflowJson(DEFAULT_COMFY_WORKFLOW);
                    localStorage.setItem('questforge_workflow_json', JSON.stringify(DEFAULT_COMFY_WORKFLOW));
                    alert('Reset to default SD1.5 txt2img workflow');
                  }}
                  title="Reset to default workflow"
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg text-xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(['all', 'characters', 'npcs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filterType === tab
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'all' ? `All (${characters.length + (worldBible?.npcs?.length || 0)})` : tab === 'characters' ? `Characters (${characters.length})` : `NPCs (${worldBible?.npcs?.length || 0})`}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter by name or role..."
          className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none"
        />
      </div>

      {/* Entities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {allEntities.map(entity => {
          const isGenerating = generatingIds.has(entity.id);
          const currentStatus = statusMap[entity.id];
          const color = roleColors[entity.role] || (entity.isNpc ? roleColors.npc : '#6b7280');

          return (
            <div
              key={entity.id}
              className="glass-panel rounded-2xl border border-slate-800/80 hover:border-slate-700/80 p-5 flex flex-col justify-between transition-all bg-slate-950/40 relative overflow-hidden group"
            >
              {/* Header: Portrait + Identity */}
              <div>
                <div className="flex items-start gap-4 mb-3">
                  <div className="shrink-0 relative">
                    <CharacterPortrait
                      character={{ id: entity.id, name: entity.name, role: entity.role, portrait_url: entity.portrait_url }}
                      size="lg"
                      showName={false}
                      isGenerating={isGenerating}
                      onClick={entity.portrait_url ? () => setLightboxEntity({
                        id: entity.id,
                        name: entity.name,
                        role: entity.role,
                        isNpc: entity.isNpc,
                        images: entity.portrait_gallery,
                        currentImageUrl: entity.portrait_url!,
                        promptText: entity.portrait_prompt,
                      }) : undefined}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-100 truncate">{entity.name}</span>
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full border capitalize"
                        style={{
                          color: color,
                          borderColor: `${color}40`,
                          backgroundColor: `${color}15`,
                        }}
                      >
                        {entity.role}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {entity.description || 'No backstory provided.'}
                    </p>

                    {/* Status message */}
                    {currentStatus && (
                      <div className="mt-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                            currentStatus.status === 'generating'
                              ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20'
                              : currentStatus.status === 'success'
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : 'text-red-400 bg-red-500/10 border border-red-500/20'
                          }`}
                        >
                          {currentStatus.status === 'generating' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                          {currentStatus.message}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multiple Images Gallery Strip */}
                {entity.portrait_gallery && entity.portrait_gallery.length > 0 && (
                  <div className="mb-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                        <Images className="w-3 h-3 text-indigo-400" />
                        Gallery ({entity.portrait_gallery.length})
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">click to enlarge</span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {entity.portrait_gallery.map((imgUrl, gIdx) => {
                        const isActive = imgUrl === entity.portrait_url;
                        return (
                          <div
                            key={gIdx}
                            onClick={() => setLightboxEntity({
                              id: entity.id,
                              name: entity.name,
                              role: entity.role,
                              isNpc: entity.isNpc,
                              images: entity.portrait_gallery,
                              currentImageUrl: imgUrl,
                              promptText: entity.portrait_prompt,
                            })}
                            className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer transition-all border-2 group/thumb ${
                              isActive
                                ? 'border-amber-400 ring-2 ring-amber-400/30'
                                : 'border-slate-800 hover:border-indigo-500/60 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img src={imgUrl} alt={`thumb-${gIdx}`} className="w-full h-full object-cover" />
                            {isActive && (
                              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-slate-950" title="Primary Portrait" />
                            )}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                              <Maximize2 className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Prompt Field */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      Portrait Prompt
                    </label>
                    <button
                      onClick={() => handleGenerateSinglePrompt(entity.id, entity.isNpc)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-mono transition-colors"
                    >
                      Regen Prompt
                    </button>
                  </div>
                  <textarea
                    value={entity.portrait_prompt || ''}
                    onChange={e => {
                      const v = e.target.value;
                      if (entity.isNpc) {
                        updateNPC(entity.id, { portrait_prompt: v });
                      } else {
                        updateCharacter(entity.id, { portrait_prompt: v });
                      }
                    }}
                    onBlur={() => handleManualSave(entity.id, entity.isNpc, entity.portrait_url, entity.portrait_prompt)}
                    placeholder="Enter prompt or click 'Generate Prompts' above..."
                    rows={5}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 outline-none resize-y leading-relaxed font-sans"
                  />
                </div>

                {/* Custom Image URL / Add to Gallery Input */}
                <div className="space-y-1 mb-4">
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Link className="w-3 h-3 text-slate-500" />
                    Custom Image URL / Add to Gallery
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={urlDrafts[entity.id] !== undefined ? urlDrafts[entity.id] : (entity.portrait_url || '')}
                      onChange={e => setUrlDrafts(prev => ({ ...prev, [entity.id]: e.target.value }))}
                      placeholder="https://... or /api/projects/.../portraits/..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 font-mono placeholder-slate-600 focus:border-indigo-500 outline-none"
                    />
                    <button
                      onClick={() => handleManualSave(entity.id, entity.isNpc, urlDrafts[entity.id] || entity.portrait_url, entity.portrait_prompt)}
                      title="Set as Active Portrait"
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleAddImageUrl(entity.id, entity.isNpc, urlDrafts[entity.id] || '')}
                      disabled={!urlDrafts[entity.id]?.trim()}
                      title="Add to Gallery (+)"
                      className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-mono transition-colors disabled:opacity-40 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleGenerateImage(entity, entity.isNpc)}
                  disabled={isGenerating || !entity.portrait_prompt?.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all disabled:opacity-40"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Generate Image</span>
                    </>
                  )}
                </button>

                {entity.portrait_url && (
                  <button
                    onClick={() => setLightboxEntity({
                      id: entity.id,
                      name: entity.name,
                      role: entity.role,
                      isNpc: entity.isNpc,
                      images: entity.portrait_gallery,
                      currentImageUrl: entity.portrait_url!,
                      promptText: entity.portrait_prompt,
                    })}
                    title="Enlarge Portrait (Lightbox)"
                    className="p-2 rounded-xl bg-slate-900 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {entity.portrait_url && (
                  <a
                    href={entity.portrait_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open image file in new tab"
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {allEntities.length === 0 && (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800">
          <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No characters or NPCs found</p>
          <p className="text-xs text-slate-500 mt-1">Generate a story or characters in the Cast & World tab first.</p>
        </div>
      )}

      {/* Portrait Lightbox Modal */}
      {lightboxEntity && (
        <PortraitLightbox
          isOpen={!!lightboxEntity}
          onClose={() => setLightboxEntity(null)}
          entityName={lightboxEntity.name}
          entityRole={lightboxEntity.role}
          images={lightboxEntity.images}
          currentImageUrl={lightboxEntity.currentImageUrl}
          promptText={lightboxEntity.promptText}
          onSetActive={url => handleSetActivePortrait(lightboxEntity.id, lightboxEntity.isNpc, url)}
          onDeleteImage={url => handleDeletePortrait(lightboxEntity.id, lightboxEntity.isNpc, url)}
        />
      )}
    </div>
  );
};
