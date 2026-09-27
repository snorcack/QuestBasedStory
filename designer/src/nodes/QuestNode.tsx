import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ShieldAlert, Gift, Compass, Trophy, Lock } from 'lucide-react';
import { Quest } from '../types';

export const QuestNode = memo(({ data }: { data: Quest }) => {
  const typeConfig: Record<string, { border: string; bg: string; badge: string; icon: any; label: string; glow: string }> = {
    main_blocking: {
      border: 'border-red-500/60',
      bg: 'bg-red-950/30',
      badge: 'bg-red-500/20 text-red-300 border-red-500/30',
      icon: ShieldAlert,
      label: 'MAIN BLOCKING',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    },
    latent_advantage: {
      border: 'border-emerald-500/60',
      bg: 'bg-emerald-950/30',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: Gift,
      label: 'LATENT ADVANTAGE',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    },
    neutral: {
      border: 'border-slate-600',
      bg: 'bg-slate-900/30',
      badge: 'bg-slate-700 text-slate-300 border-slate-600',
      icon: Compass,
      label: 'NEUTRAL OPTIONAL',
      glow: '',
    },
    achievement: {
      border: 'border-amber-500/60',
      bg: 'bg-amber-950/30',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: Trophy,
      label: 'ACHIEVEMENT',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    },
    story_arc: {
      border: 'border-violet-500/60',
      bg: 'bg-violet-950/30',
      badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
      icon: Compass,
      label: 'STORY ARC',
      glow: 'shadow-[0_0_15px_rgba(139,92,246,0.2)]',
    },
    investigation: {
      border: 'border-blue-500/60',
      bg: 'bg-blue-950/30',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: Compass,
      label: 'INVESTIGATION',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
    },
    stealth: {
      border: 'border-slate-500/60',
      bg: 'bg-slate-900/50',
      badge: 'bg-slate-600/20 text-slate-300 border-slate-600/30',
      icon: Lock,
      label: 'STEALTH',
      glow: '',
    },
    crafting: {
      border: 'border-orange-500/60',
      bg: 'bg-orange-950/30',
      badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      icon: Gift,
      label: 'CRAFTING',
      glow: 'shadow-[0_0_15px_rgba(249,115,22,0.2)]',
    },
  };

  const config = typeConfig[data.type] || {
    border: 'border-slate-700',
    bg: 'bg-slate-900',
    badge: 'bg-slate-800 text-slate-300',
    icon: Compass,
    label: data.type,
    glow: '',
  };

  const Icon = config.icon;

  return (
    <div className={`glass-panel ${config.glow} ${config.border} ${config.bg} rounded-xl p-3.5 w-64 text-slate-100 border transition-all`}>
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-slate-400 border border-slate-900" />

      <div className="flex items-center justify-between mb-2">
        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${config.badge}`}>
          {config.label}
        </span>
        <Icon className="w-4 h-4 text-slate-300" />
      </div>

      <h4 className="font-semibold text-xs mb-1 text-slate-100 leading-snug">
        {data.title}
      </h4>

      <p className="text-[11px] text-slate-300 mb-2 leading-relaxed">
        {data.objective}
      </p>

      {data.required_trait && (
        <div className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/50 p-1.5 rounded border border-amber-500/30 font-mono mb-2">
          <Lock className="w-3 h-3 text-amber-400" />
          <span>Req: {data.required_trait.name} ({data.required_trait.strength})</span>
        </div>
      )}

      {data.journal_entry && (
        <p className="text-[10px] italic text-slate-400 bg-slate-950/60 p-1.5 rounded border border-slate-900 line-clamp-2">
          "{data.journal_entry}"
        </p>
      )}

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-slate-400 border border-slate-900" />
    </div>
  );
});
