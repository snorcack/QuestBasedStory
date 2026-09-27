import React from 'react';
import { ChevronRight } from 'lucide-react';
import { usePlayStore } from '../../store/usePlayStore';
import { Character, DialogueNode, Quest, TraitDefinition } from '../../types';
import { CharacterPortrait } from './CharacterPortrait';
import { ChoiceButton } from './ChoiceButton';

interface DialoguePlayerProps {
  node: DialogueNode;
  characters: Character[];
  traitVocabulary: TraitDefinition[];
  quests: Quest[];
  activeFlags: string[];
}

export const DialoguePlayer: React.FC<DialoguePlayerProps> = ({
  node,
  characters,
  traitVocabulary,
  quests,
  activeFlags,
}) => {
  const { advanceDialogue, makeChoice } = usePlayStore();
  const isNarrator = !node.speaker || node.speaker === 'narrator';
  const speaker = characters.find(c => c.id === node.speaker);
  const hasChoices = node.choices && node.choices.length > 0;

  const isEnd = node.type === 'end';

  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-8 py-8 overflow-y-auto" style={{ animation: 'dialogueFadeIn 0.35s ease forwards' }}>
      <div className="max-w-xl w-full space-y-6">
        {/* Speaker row */}
        {!isNarrator && (
          <div className="flex items-center gap-3">
            {speaker && <CharacterPortrait character={speaker} size="sm" showName={false} />}
            <span className="text-xs font-semibold text-slate-300">{speaker?.name || node.speaker}</span>
            {speaker?.dominant_trait_alignment && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                {speaker.dominant_trait_alignment}
              </span>
            )}
          </div>
        )}

        {/* Dialogue text bubble */}
        <div
          className={`relative rounded-2xl px-6 py-5 ${isNarrator
            ? 'bg-transparent border border-slate-800/50 italic'
            : 'bg-slate-900/80 border border-slate-700/50'
          }`}
        >
          {/* Left accent bar for non-narrator */}
          {!isNarrator && speaker && (
            <div
              className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
              style={{
                background: traitVocabulary.find(t => t.name === speaker.dominant_trait_alignment)?.color_hex || '#334155',
              }}
            />
          )}
          <p
            className={`leading-[1.9] ${isNarrator ? 'text-slate-400 text-sm' : 'text-slate-100 text-base'}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {isNarrator && <span className="text-slate-600 mr-1 select-none">*</span>}
            {node.text}
          </p>
        </div>

        {/* End node */}
        {isEnd && (
          <div className="flex justify-center">
            <button
              onClick={() => advanceDialogue()}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white text-sm transition-all"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Choices */}
        {hasChoices && !isEnd && (
          <div className="space-y-2.5">
            {node.choices.map((choice, idx) => (
              <ChoiceButton
                key={idx}
                idx={idx}
                choice={choice}
                traitVocabulary={traitVocabulary}
                activeFlags={activeFlags}
                onSelect={() => makeChoice(choice, quests)}
              />
            ))}
          </div>
        )}

        {/* Linear advance (no choices, not end) */}
        {!hasChoices && !isEnd && (
          <div className="flex justify-center">
            <button
              onClick={() => advanceDialogue()}
              className="flex items-center gap-2 px-8 py-3 rounded-xl border border-slate-800 hover:border-slate-600 text-slate-500 hover:text-slate-300 text-sm transition-all"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        @keyframes dialogueFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
