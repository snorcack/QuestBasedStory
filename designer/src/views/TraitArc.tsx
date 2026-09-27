import React from 'react';
import { useStoryStore } from '../store/useStoryStore';
import { Sparkles, GitMerge, ShieldCheck, Zap } from 'lucide-react';

export const TraitArc: React.FC = () => {
  const { traitVocabulary, chapters } = useStoryStore();

  const traitA = traitVocabulary[0] || { name: 'Cunning', color_hex: '#E0A82E', description: 'Technical intrusion & deception' };
  const traitB = traitVocabulary[1] || { name: 'Empathy', color_hex: '#2EA8E0', description: 'Alliance building & human insight' };

  // Calculate choices per trait across chapters
  const traitStats = {
    [traitA.name]: 0,
    [traitB.name]: 0,
  };

  chapters.forEach((ch) => {
    ch.dialogue_tree?.forEach((node) => {
      node.choices?.forEach((choice) => {
        if (choice.trait_tag === traitA.name) traitStats[traitA.name]++;
        if (choice.trait_tag === traitB.name) traitStats[traitB.name]++;
      });
    });
  });

  return (
    <div className="w-full h-full bg-[#060911] p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Narrative Trait Architecture
          </h2>
          <p className="text-xs text-slate-400">
            Strict 2-trait limit per story. Gated via dialogue choices with a 3-tier threshold system.
          </p>
        </div>

        {/* The 2 Traits Cards */}
        <div className="grid grid-cols-2 gap-6">
          {[traitA, traitB].map((trait) => (
            <div
              key={trait.name}
              className="glass-panel p-6 rounded-2xl border transition-all hover:scale-[1.01]"
              style={{ borderColor: `${trait.color_hex}40` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-bold text-lg font-mono"
                  style={{ color: trait.color_hex }}
                >
                  {trait.name}
                </span>
                <span className="text-xs font-mono bg-slate-900 px-2.5 py-1 rounded-full text-slate-300 border border-slate-800">
                  {traitStats[trait.name] || 0} Dialogue Choices
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                {trait.description}
              </p>

              {/* Tiers Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Emerging (1-3)</span>
                  <span>Established (4-7)</span>
                  <span>Dominant (8+)</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, ((traitStats[trait.name] || 0) / 10) * 100)}%`,
                      backgroundColor: trait.color_hex,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Convergent Climax Model Visualization */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <GitMerge className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-sm text-slate-100">
              Convergent Climax Architecture (Chapter 6)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            All trait branches specialize player tactics and dialogue during the climax, but converge to the same canonical story resolution.
          </p>

          <div className="grid grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-slate-200">
              <div className="text-amber-400 font-bold mb-1">Trait A Path ({traitA.name})</div>
              <p className="text-[11px] text-slate-400 font-sans">
                Cross utilizes high-grade logic intrusion and exploits backdoors to breach the Spire Archive core.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 text-slate-200">
              <div className="text-cyan-400 font-bold mb-1">Trait B Path ({traitB.name})</div>
              <p className="text-[11px] text-slate-400 font-sans">
                Cross leverages undergrid alliances and human informants to overwhelm Spire security defenses.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-200">
              <div className="text-slate-300 font-bold mb-1">Default Path</div>
              <p className="text-[11px] text-slate-400 font-sans">
                Balanced tactical approach without specialization, confronting Sterling with core forensic records.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs font-mono text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>All Paths Converge ──► Single Canonical Resolution</span>
          </div>
        </div>
      </div>
    </div>
  );
};
