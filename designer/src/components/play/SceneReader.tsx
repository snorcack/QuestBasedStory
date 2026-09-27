import React from 'react';
import { MapPin } from 'lucide-react';
import { Scene, Character } from '../../types';
import { CharacterPortrait } from './CharacterPortrait';

interface SceneReaderProps {
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  characters: Character[];
  onNext: () => void;
}

export const SceneReader: React.FC<SceneReaderProps> = ({ scene, sceneIndex, totalScenes, characters, onNext }) => {
  const presentChars = characters.filter(c => scene.characters_present?.includes(c.id));

  return (
    <div
      className="flex flex-col items-center h-full w-full overflow-y-auto px-8 py-8 cursor-pointer group"
      onClick={onNext}
      style={{ animation: 'sceneFadeIn 0.5s ease forwards' }}
    >
      <div className="max-w-2xl w-full space-y-8">
        {/* Scene header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
            <span>Scene {sceneIndex + 1} of {totalScenes}</span>
            {scene.location_id && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{scene.location_id}</span>
              </>
            )}
          </div>
          <h3 className="text-xl font-semibold text-slate-200" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {scene.title}
          </h3>
          {scene.emotional_beat && (
            <p className="text-xs text-slate-500 italic">{scene.emotional_beat}</p>
          )}
        </div>

        {/* Character portraits */}
        {presentChars.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {presentChars.map(c => (
              <CharacterPortrait key={c.id} character={c} size="sm" />
            ))}
          </div>
        )}

        {/* Prose */}
        <div
          className="text-slate-200 leading-[1.95] text-[17px] select-text"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {scene.prose.split('\n').map((paragraph, i) => (
            paragraph.trim() ? (
              <p key={i} className={i > 0 ? 'mt-5' : ''}>{paragraph}</p>
            ) : <div key={i} className="h-3" />
          ))}
        </div>

        {/* Continue hint */}
        <div className="flex justify-center pt-8 pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-[10px] font-mono text-slate-700 uppercase tracking-widest">Click to continue</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        @keyframes sceneFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
