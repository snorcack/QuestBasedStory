import React, { useState } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import {
  User, Globe, MapPin, Users, Shield, BookOpen, Scroll, Calendar,
  ChevronDown, ChevronRight, Edit3, Check, X, RefreshCw, Save, RotateCcw,
  Sparkles,
} from 'lucide-react';
import { CharacterPortrait } from '../components/play/CharacterPortrait';
import { PortraitStudio } from '../components/play/PortraitStudio';

type SubTab = 'characters' | 'world' | 'portraits';

const roleColors: Record<string, string> = {
  protagonist: '#3b82f6',
  antagonist: '#ef4444',
  ally: '#10b981',
  neutral: '#6b7280',
  antagonist_ally: '#f59e0b',
};

const EditableField: React.FC<{
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (v: string) => void;
}> = ({ label, value, multiline, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">{label}</span>
        {!editing && (
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-blue-400 transition-all"
          >
            <Edit3 className="w-3 h-3" />
          </button>
        )}
      </div>
      {editing ? (
        <div>
          {multiline ? (
            <textarea
              className="w-full bg-slate-900 border border-blue-500/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none resize-none"
              rows={3}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
            />
          ) : (
            <input
              className="w-full bg-slate-900 border border-blue-500/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
            />
          )}
          <div className="flex gap-1.5 mt-1">
            <button onClick={commit} className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded transition-colors">
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={cancel} className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded transition-colors">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-300 leading-relaxed min-h-[1.2rem]">{value || <span className="text-slate-600 italic">Not set</span>}</p>
      )}
    </div>
  );
};

const CharacterCard: React.FC<{ char: any }> = ({ char }) => {
  const { updateCharacter, traitVocabulary } = useStoryStore();
  const [expanded, setExpanded] = useState(false);
  const roleColor = roleColors[char.role] || '#6b7280';

  return (
    <div className="glass-panel rounded-xl border border-slate-800 hover:border-slate-700 transition-all overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <CharacterPortrait
            character={{ id: char.id, name: char.name, role: char.role, portrait_url: char.portrait_url }}
            size="sm"
            showName={false}
          />
          <div>
            <div className="text-sm font-semibold text-slate-100">{char.name}</div>
            <div className="text-[10px] font-mono" style={{ color: roleColor }}>{char.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {char.dominant_trait_alignment && char.dominant_trait_alignment !== 'none' && (
            <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
              ◆ {char.dominant_trait_alignment}
            </span>
          )}
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {/* Expanded edit fields */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800/60 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <EditableField label="Name" value={char.name} onChange={v => updateCharacter(char.id, { name: v })} />
            <div>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide block mb-0.5">Role</span>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                value={char.role}
                onChange={e => updateCharacter(char.id, { role: e.target.value })}
              >
                {['protagonist','antagonist','ally','neutral','antagonist_ally'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <EditableField label="Backstory" value={char.backstory} multiline onChange={v => updateCharacter(char.id, { backstory: v })} />
          <EditableField label="Motivation" value={char.motivation} multiline onChange={v => updateCharacter(char.id, { motivation: v })} />
          <div className="grid grid-cols-2 gap-3">
            <EditableField label="Flaw" value={char.flaw} onChange={v => updateCharacter(char.id, { flaw: v })} />
            <EditableField label="Arc" value={char.arc} onChange={v => updateCharacter(char.id, { arc: v })} />
          </div>
          <EditableField label="Dialogue Voice" value={char.dialogue_voice} multiline onChange={v => updateCharacter(char.id, { dialogue_voice: v })} />
          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide block mb-0.5">Dominant Trait</span>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
              value={char.dominant_trait_alignment || 'none'}
              onChange={e => updateCharacter(char.id, { dominant_trait_alignment: e.target.value })}
            >
              <option value="none">None</option>
              {traitVocabulary.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

const WorldSection: React.FC<{ title: string; icon: any; count: number; children: React.ReactNode }> = ({ title, icon: Icon, count, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">{title}</span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">{count}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-800/60">{children}</div>}
    </div>
  );
};

export const CastWorldTab: React.FC = () => {
  const {
    characters, worldBible, currentStage,
    updateLocation, updateFaction, updateNPC,
    submitWorldCastEdits, submitWorldCastFeedback, isGenerating,
  } = useStoryStore();

  const [subTab, setSubTab] = useState<SubTab>('characters');
  const [globalFeedback, setGlobalFeedback] = useState('');

  const isAvailable = [
    'stage_3_5_world_cast', 'stage_4_chapter_authoring',
    'stage_5_quest_mapping', 'export_complete',
  ].includes(currentStage);

  if (!isAvailable) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Users className="w-12 h-12 mb-3 text-slate-700" />
        <p className="text-sm font-medium">Cast & World not yet generated.</p>
        <p className="text-xs text-slate-600 mt-1">Complete Stage 3 (Transitions) to unlock this tab.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#060911]">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 shrink-0">
        <button
          onClick={() => setSubTab('characters')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-medium transition-all border-b-2 ${
            subTab === 'characters'
              ? 'text-blue-300 border-blue-500 bg-blue-500/10'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <User className="w-4 h-4" /> Characters ({characters.length})
        </button>
        <button
          onClick={() => setSubTab('world')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-medium transition-all border-b-2 ${
            subTab === 'world'
              ? 'text-emerald-300 border-emerald-500 bg-emerald-500/10'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <Globe className="w-4 h-4" /> World Bible
        </button>
        <button
          onClick={() => setSubTab('portraits')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-medium transition-all border-b-2 ${
            subTab === 'portraits'
              ? 'text-indigo-300 border-indigo-500 bg-indigo-500/10'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" /> Portrait Studio
        </button>

        {/* Save/Regenerate actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => submitWorldCastEdits()}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all border border-slate-700 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> Save Edits
          </button>
          <button
            onClick={() => submitWorldCastFeedback(globalFeedback)}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Regenerate
          </button>
        </div>
      </div>

      {/* Global feedback bar */}
      <div className="px-6 py-2 border-b border-slate-800/60 shrink-0 bg-slate-950/40">
        <input
          className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none placeholder:text-slate-600"
          placeholder="Global feedback for regeneration (e.g. 'make antagonist more morally grey, add a port district')"
          value={globalFeedback}
          onChange={e => setGlobalFeedback(e.target.value)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {subTab === 'characters' && (
          <div className="space-y-3">
            {characters.length === 0 ? (
              <div className="text-center text-slate-600 py-12">
                <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No characters generated yet.</p>
              </div>
            ) : (
              characters.map(char => <CharacterCard key={char.id} char={char} />)
            )}
          </div>
        )}

        {subTab === 'world' && worldBible && (
          <div className="space-y-4">
            {/* Locations */}
            <WorldSection title="Locations" icon={MapPin} count={worldBible.locations?.length ?? 0}>
              <div className="space-y-3 mt-2">
                {(worldBible.locations ?? []).map(loc => (
                  <div key={loc.id} className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/60 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">{loc.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <EditableField label="Name" value={loc.name} onChange={v => updateLocation(loc.id, { name: v })} />
                    </div>
                    <EditableField label="Description" value={loc.description} multiline onChange={v => updateLocation(loc.id, { description: v })} />
                  </div>
                ))}
              </div>
            </WorldSection>

            {/* Factions */}
            <WorldSection title="Factions" icon={Shield} count={worldBible.factions?.length ?? 0}>
              <div className="space-y-3 mt-2">
                {(worldBible.factions ?? []).map(fac => (
                  <div key={fac.id} className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/60 space-y-2">
                    <span className="text-[10px] font-mono text-slate-500">{fac.id}</span>
                    <EditableField label="Name" value={fac.name} onChange={v => updateFaction(fac.id, { name: v })} />
                    <EditableField label="Goals" value={fac.goals} multiline onChange={v => updateFaction(fac.id, { goals: v })} />
                  </div>
                ))}
              </div>
            </WorldSection>

            {/* NPCs */}
            <WorldSection title="NPCs" icon={Users} count={worldBible.npcs?.length ?? 0}>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 font-mono text-[10px]">
                      <th className="text-left pb-2 pr-3">Name</th>
                      <th className="text-left pb-2 pr-3">Location</th>
                      <th className="text-left pb-2 pr-3">Role</th>
                      <th className="text-left pb-2">Personality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {(worldBible.npcs ?? []).map(npc => (
                      <tr key={npc.id} className="group">
                        <td className="py-2 pr-3">
                          <EditableField label="" value={npc.name} onChange={v => updateNPC(npc.id, { name: v })} />
                        </td>
                        <td className="py-2 pr-3 text-slate-500 font-mono">{npc.location}</td>
                        <td className="py-2 pr-3">
                          <EditableField label="" value={npc.role} onChange={v => updateNPC(npc.id, { role: v })} />
                        </td>
                        <td className="py-2">
                          <EditableField label="" value={npc.personality} multiline onChange={v => updateNPC(npc.id, { personality: v })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </WorldSection>

            {/* Rules */}
            <WorldSection title="World Rules" icon={Scroll} count={worldBible.rules?.length ?? 0}>
              <div className="space-y-2 mt-2">
                {(worldBible.rules ?? []).map(rule => (
                  <div key={rule.id} className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/60">
                    <span className="text-[10px] font-mono text-slate-500 block mb-1">{rule.category} · {rule.id}</span>
                    <p className="text-xs text-slate-300">{rule.rule_text}</p>
                  </div>
                ))}
              </div>
            </WorldSection>

            {/* Timeline */}
            <WorldSection title="Historical Timeline" icon={Calendar} count={worldBible.timeline?.length ?? 0}>
              <div className="space-y-2 mt-2">
                {(worldBible.timeline ?? []).map(evt => (
                  <div key={evt.id} className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/60 flex gap-3">
                    <span className="text-[10px] font-mono text-slate-500 w-6 shrink-0 mt-0.5">{evt.order}</span>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 mb-0.5">{evt.name}</div>
                      <p className="text-xs text-slate-400">{evt.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </WorldSection>
          </div>
        )}

        {subTab === 'world' && !worldBible && (
          <div className="text-center text-slate-600 py-12">
            <Globe className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">World Bible not yet generated.</p>
          </div>
        )}

        {subTab === 'portraits' && (
          <PortraitStudio />
        )}
      </div>
    </div>
  );
};
