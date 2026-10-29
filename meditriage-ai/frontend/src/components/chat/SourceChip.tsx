import React from 'react';
import { BookOpen, Sparkles, ShieldAlert } from 'lucide-react';

interface SourceChipProps {
  source?: 'kb' | 'ai' | 'emergency';
}

export const SourceChip: React.FC<SourceChipProps> = ({ source }) => {
  if (source === 'emergency') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emergency text-surface shadow-xs">
        <ShieldAlert className="w-3 h-3" />
        <span>Safety Protocol</span>
      </span>
    );
  }

  if (source === 'ai') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-soft text-primary border border-line">
        <Sparkles className="w-3 h-3" />
        <span>AI-Generated • Clinical Model</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg text-muted border border-line">
      <BookOpen className="w-3 h-3 text-primary" />
      <span>From MediTriage Guide</span>
    </span>
  );
};
