import React from 'react';
import { Lock } from 'lucide-react';
import { DialogueChoice, TraitDefinition } from '../../types';

interface ChoiceButtonProps {
  idx: number;
  choice: DialogueChoice;
  traitVocabulary: TraitDefinition[];
  activeFlags: string[];
  onSelect: () => void;
}

export const ChoiceButton: React.FC<ChoiceButtonProps> = ({ idx, choice, traitVocabulary, activeFlags, onSelect }) => {
  const trait = traitVocabulary.find(t => t.name === choice.trait_tag);
  const traitColor = trait?.color_hex || null;

  // Disabled if condition_flag is set and not in activeFlags
  const isDisabled = !!(choice.condition_flag && !activeFlags.includes(choice.condition_flag));

  return (
    <button
      onClick={!isDisabled ? onSelect : undefined}
      disabled={isDisabled}
      className={`group w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all ${
        isDisabled
          ? 'border-slate-800 bg-slate-900/20 opacity-40 cursor-not-allowed'
          : 'border-slate-700/60 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-600 cursor-pointer'
      }`}
      style={traitColor && !isDisabled ? {
        '--glow': `${traitColor}30`,
        boxShadow: `0 0 0 1px ${traitColor}25`,
      } as React.CSSProperties : undefined}
    >
      {/* Keyboard number hint */}
      <span className={`text-[10px] font-mono w-5 h-5 rounded flex items-center justify-center shrink-0 font-bold ${
        isDisabled ? 'bg-slate-800 text-slate-600' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
      }`}>
        {idx + 1}
      </span>

      {/* Label */}
      <span className={`flex-1 text-sm leading-snug ${isDisabled ? 'text-slate-600' : 'text-slate-200 group-hover:text-white'}`}>
        {choice.label}
      </span>

      {/* Trait tag */}
      {choice.trait_tag && traitColor && (
        <span
          className="text-[9px] font-mono px-2 py-0.5 rounded-full border shrink-0 font-semibold tracking-wide"
          style={{
            borderColor: `${traitColor}50`,
            color: traitColor,
            background: `${traitColor}15`,
          }}
        >
          {choice.trait_tag}
        </span>
      )}

      {/* Lock icon if disabled */}
      {isDisabled && (
        <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
      )}
    </button>
  );
};
