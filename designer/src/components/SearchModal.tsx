import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import {
  Search,
  X,
  MessageSquare,
  BookOpen,
  Compass,
  Users,
  MapPin,
  Shield,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';

export type SearchCategory = 'all' | 'dialogue' | 'prose' | 'quests' | 'characters' | 'world';

export interface SearchResultItem {
  id: string;
  category: 'dialogue' | 'prose' | 'quests' | 'characters' | 'world';
  title: string;
  subtitle: string;
  snippet: string;
  chapterId?: string;
  nodeId?: string;
  sceneId?: string;
  entityId?: string;
}

export const SearchModal: React.FC = () => {
  const {
    isSearchOpen,
    closeSearch,
    chapters,
    chapterContracts,
    characters,
    worldBible,
    questGraph,
    setActiveView,
    setSelectedChapterId,
  } = useStoryStore();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  // Build searchable index
  const allIndexedItems = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [];

    // 1. Dialogue Nodes
    chapters.forEach((chapter) => {
      const contract = chapterContracts.find((c) => c.chapter_id === chapter.chapter_id);
      const chTitle = contract?.title || chapter.chapter_id;

      (chapter.dialogue_tree || []).forEach((node) => {
        const choiceLabels = node.choices?.map((c) => c.label).join(' | ') || '';
        items.push({
          id: `dlg_${chapter.chapter_id}_${node.node_id}`,
          category: 'dialogue',
          title: `${node.speaker} (#${node.node_id})`,
          subtitle: `${chTitle} • Dialogue Beat`,
          snippet: `${node.text} ${choiceLabels ? `[Choices: ${choiceLabels}]` : ''}`.trim(),
          chapterId: chapter.chapter_id,
          nodeId: node.node_id,
        });
      });

      // 2. Scene Prose Beats
      (chapter.scenes || []).forEach((scene, sIdx) => {
        items.push({
          id: `prose_${chapter.chapter_id}_${scene.scene_id || sIdx}`,
          category: 'prose',
          title: scene.title || `Beat ${sIdx + 1}`,
          subtitle: `${chTitle} • ${scene.emotional_beat || 'Narrative Prose'}`,
          snippet: scene.prose || '',
          chapterId: chapter.chapter_id,
          sceneId: scene.scene_id,
        });
      });
    });

    // 3. Quests
    (questGraph || []).forEach((quest) => {
      items.push({
        id: `quest_${quest.quest_id}`,
        category: 'quests',
        title: quest.title,
        subtitle: `Quest • Type: ${quest.type}`,
        snippet: `${quest.title} (Chapter: ${quest.chapter_id || 'Global'})`,
        entityId: quest.quest_id,
      });
    });

    // 4. Characters & NPCs
    (characters || []).forEach((char) => {
      items.push({
        id: `char_${char.id}`,
        category: 'characters',
        title: char.name,
        subtitle: `Main Cast • ${char.role || 'Character'}`,
        snippet: `${char.backstory || ''} Motivation: ${char.motivation || ''} Voice: ${char.dialogue_voice || ''} Alignment: ${
          char.dominant_trait_alignment || ''
        }`.trim(),
        entityId: char.id,
      });
    });

    (worldBible?.npcs || []).forEach((npc) => {
      items.push({
        id: `npc_${npc.id}`,
        category: 'characters',
        title: npc.name,
        subtitle: `NPC • ${npc.role || 'Supporting'}`,
        snippet: `${npc.personality || ''} Voice: ${npc.dialogue_voice || ''} Location: ${npc.location || ''}`.trim(),
        entityId: npc.id,
      });
    });

    // 5. World Locations & Factions
    (worldBible?.locations || []).forEach((loc) => {
      items.push({
        id: `loc_${loc.id}`,
        category: 'world',
        title: loc.name,
        subtitle: 'World Location',
        snippet: `${loc.description || ''}`.trim(),
        entityId: loc.id,
      });
    });

    (worldBible?.factions || []).forEach((fac) => {
      items.push({
        id: `fac_${fac.id}`,
        category: 'world',
        title: fac.name,
        subtitle: 'World Faction',
        snippet: `Goals: ${fac.goals || ''} Territory: ${fac.territory?.join(', ') || ''}`.trim(),
        entityId: fac.id,
      });
    });

    return items;
  }, [chapters, chapterContracts, characters, worldBible, questGraph]);

  // Filtered results
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allIndexedItems.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.snippet.toLowerCase().includes(q)
      );
    }).slice(0, 40); // limit to top 40 for speed
  }, [allIndexedItems, query, selectedCategory]);

  const handleSelect = (item: SearchResultItem) => {
    closeSearch();
    if (item.category === 'dialogue') {
      if (item.chapterId) setSelectedChapterId(item.chapterId);
      setActiveView('dialogue');
    } else if (item.category === 'prose') {
      if (item.chapterId) setSelectedChapterId(item.chapterId);
      setActiveView('dialogue');
    } else if (item.category === 'quests') {
      setActiveView('quests');
    } else if (item.category === 'characters' || item.category === 'world') {
      setActiveView('cast-world');
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSearch();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredResults.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % (filteredResults.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex]);
      }
    }
  };

  if (!isSearchOpen) return null;

  const categoryIcons: Record<string, any> = {
    dialogue: MessageSquare,
    prose: BookOpen,
    quests: Compass,
    characters: Users,
    world: MapPin,
  };

  const categoryColors: Record<string, string> = {
    dialogue: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    prose: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    quests: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    characters: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    world: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={closeSearch}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-2xl bg-[#0c1220] border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Input */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search dialogue, prose beats, quests, characters, locations... (Press Esc to close)"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
            ESC
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {(['all', 'dialogue', 'prose', 'quests', 'characters', 'world'] as SearchCategory[]).map(
            (cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedIndex(0);
                  }}
                  className={`text-[11px] font-medium capitalize px-2.5 py-1 rounded-lg transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {cat === 'all' ? 'All Content' : cat}
                </button>
              );
            }
          )}
          <span className="ml-auto text-[10px] font-mono text-slate-500 shrink-0">
            {filteredResults.length} matches
          </span>
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredResults.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
              <p className="font-semibold text-slate-400">No story content found</p>
              <p className="text-[11px] text-slate-600 mt-1">
                Try searching for character names, spoken lines, scenes, or quest keywords.
              </p>
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              const Icon = categoryIcons[item.category] || BookOpen;
              const colorClass = categoryColors[item.category] || 'text-slate-400';

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start gap-3 select-none ${
                    isSelected
                      ? 'bg-indigo-600/15 border border-indigo-500/40 shadow-sm'
                      : 'border border-transparent hover:bg-slate-900/60'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${colorClass}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-slate-200 truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {item.subtitle}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed font-sans">
                      {item.snippet}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-indigo-400 shrink-0 self-center">
                      <span>Jump</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">
                ↑
              </kbd>{' '}
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">
                ↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">
                ↵
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">
                esc
              </kbd>{' '}
              Dismiss
            </span>
          </div>
          <span>QuestForge Global Search</span>
        </div>
      </div>
    </div>
  );
};
