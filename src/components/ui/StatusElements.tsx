import React from 'react';
import { cn } from '../../lib/utils';

export const SeverityBadge = ({ severity }: { severity: string }) => {
  const s = severity?.trim().toUpperCase();
  const colors = {
    CRITICAL: "bg-red-500/10 text-red-500 border-red-500/20",
    HIGH: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "S HIGH": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    MEDIUM: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    LOW: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  }[s] || "bg-neutral-500/10 text-neutral-500 border-neutral-500/20";

  return (
    <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border", colors)}>
      {severity}
    </span>
  );
};

export const StatusPill = ({ status }: { status: string }) => {
  const colors = {
    'Active': 'text-emerald-400 bg-emerald-400',
    'Investigating': 'text-orange-400 bg-orange-400',
    'Merged': 'text-blue-400 bg-blue-400',
    'Closed': 'text-red-400 bg-red-400',
    'Escalated': 'text-purple-400 bg-purple-400',
    'True Positive': 'text-red-400 bg-red-400',
    'False Positive': 'text-neutral-400 bg-neutral-400',
    'Benign Positive': 'text-emerald-400 bg-emerald-400',
    'Benign': 'text-emerald-400 bg-emerald-400',
    'Testing': 'text-yellow-400 bg-yellow-400',
  }[status] || 'text-neutral-400 bg-neutral-400';

  const [textColor, bgColor] = colors.split(' ');

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-medium",
      textColor
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", bgColor)} />
      {status}
    </span>
  );
};
