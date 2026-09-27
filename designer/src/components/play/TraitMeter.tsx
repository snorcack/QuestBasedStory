import React from 'react';
import { TraitDefinition } from '../../types';

interface TraitMeterProps {
  traitVocabulary: TraitDefinition[];
  traitScores: Record<string, number>;
  maxScore?: number;
}

function scoreTierLabel(score: number): string {
  if (score === 0) return 'None';
  if (score <= 2) return 'Emerging';
  if (score <= 4) return 'Established';
  return 'Dominant';
}

export const TraitMeter: React.FC<TraitMeterProps> = ({ traitVocabulary, traitScores, maxScore = 10 }) => {
  if (traitVocabulary.length === 0) return null;

  return (
    <div className="px-4 py-3 space-y-3 border-t border-slate-800/60">
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600 block">Trait Progress</span>
      {traitVocabulary.map(trait => {
        const score = traitScores[trait.name] ?? 0;
        const pct = Math.min((score / maxScore) * 100, 100);

        return (
          <div key={trait.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium" style={{ color: trait.color_hex }}>
                {trait.name}
              </span>
              <span className="text-[9px] font-mono text-slate-600">
                {scoreTierLabel(score)} ({score})
              </span>
            </div>
            <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${trait.color_hex}80, ${trait.color_hex})`,
                  boxShadow: pct > 0 ? `0 0 8px ${trait.color_hex}40` : 'none',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
