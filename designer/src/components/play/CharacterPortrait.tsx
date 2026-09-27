import React, { useState } from 'react';
import { Loader2, Maximize2 } from 'lucide-react';
import { Character, NPC } from '../../types';

const roleColors: Record<string, string> = {
  protagonist: '#3b82f6',
  antagonist: '#ef4444',
  ally: '#10b981',
  neutral: '#6b7280',
  antagonist_ally: '#f59e0b',
};

type PortraitEntity = Pick<Character, 'id' | 'name' | 'role'> & { portrait_url?: string | null };

interface CharacterPortraitProps {
  character: PortraitEntity;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  isGenerating?: boolean;
  onClick?: () => void;
}

export const CharacterPortrait: React.FC<CharacterPortraitProps> = ({
  character,
  size = 'md',
  showName = true,
  isGenerating = false,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const sizeClass = size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-14 h-14 text-sm';
  const color = roleColors[character.role] || '#6b7280';
  const initials = character.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');

  const hasPortrait = !!character.portrait_url && !imgError;

  return (
    <div className="flex flex-col items-center gap-1.5 group select-none">
      <div
        onClick={onClick}
        className={`${sizeClass} rounded-2xl overflow-hidden relative flex items-center justify-center border transition-all ${
          onClick ? 'cursor-pointer group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-indigo-500/20' : ''
        }`}
        style={{ borderColor: `${color}40`, background: hasPortrait ? 'transparent' : `${color}15` }}
      >
        {/* Portrait image */}
        {character.portrait_url && !imgError && (
          <img
            src={character.portrait_url}
            alt={character.name}
            onLoad={() => setImgLoading(false)}
            onError={() => { setImgError(true); setImgLoading(false); }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
          />
        )}

        {/* Enlarge zoom hint on hover */}
        {hasPortrait && onClick && !isGenerating && (
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-4 h-4 text-white drop-shadow" />
          </div>
        )}

        {/* Generating spinner */}
        {isGenerating ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          </div>
        ) : null}

        {/* Initials fallback */}
        {(!hasPortrait || imgLoading) && !isGenerating && (
          <span className="font-bold select-none" style={{ color, fontFamily: 'monospace' }}>
            {initials || '?'}
          </span>
        )}
      </div>

      {showName && (
        <div className="text-center">
          <span className="text-[10px] font-medium text-slate-400 truncate max-w-[80px] block">{character.name}</span>
          <span className="text-[9px] font-mono capitalize" style={{ color: `${color}90` }}>{character.role}</span>
        </div>
      )}
    </div>
  );
};
