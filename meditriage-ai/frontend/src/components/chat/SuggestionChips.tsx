import React from 'react';
import { HelpCircle, Activity, QrCode, Shield, Sparkles, AlertTriangle } from 'lucide-react';

interface SuggestionChipsProps {
  onSelect: (query: string) => void;
}

const SUGGESTIONS = [
  { label: 'What is MediTriage AI?', query: 'What is MediTriage AI and how does it help?', icon: Sparkles },
  { label: 'How does intake work?', query: 'How does the symptom intake assessment work?', icon: Activity },
  { label: 'What do triage colors mean?', query: 'What do the triage urgency levels and colors mean?', icon: HelpCircle },
  { label: 'Emergency QR card', query: 'How does the Emergency QR Card work for paramedics?', icon: QrCode },
  { label: 'My data & privacy', query: 'How is my health data protected under the DPDP Act 2023?', icon: Shield },
  { label: 'I need urgent help', query: 'I have severe acute chest pain and need urgent help', icon: AlertTriangle },
];

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({ onSelect }) => {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
        Suggested questions:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(item.query)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-line bg-surface text-ink hover:bg-bg-tint hover:border-primary/40 hover:text-primary transition shadow-xs text-left"
            >
              <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
