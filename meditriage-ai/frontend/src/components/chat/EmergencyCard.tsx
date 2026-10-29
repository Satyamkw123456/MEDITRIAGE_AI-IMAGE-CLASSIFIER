import React from 'react';
import Link from 'next/link';
import { ShieldAlert, PhoneCall, ArrowRight } from 'lucide-react';
import { useLocale } from 'next-intl';

interface EmergencyCardProps {
  messageText?: string;
  actions?: Array<{ label: string; href: string }>;
}

export const EmergencyCard: React.FC<EmergencyCardProps> = ({ messageText, actions }) => {
  const locale = useLocale();

  return (
    <div 
      role="alert" 
      aria-live="assertive" 
      className="p-4 rounded-xl bg-emergency text-surface border border-emergency shadow-md space-y-3"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-full bg-surface/20 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5 text-surface" />
        </div>
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase opacity-90 block">
            Emergency Triage Protocol Triggered
          </span>
          <h4 className="font-heading font-bold text-sm sm:text-base leading-snug">
            Immediate Clinical Danger Suspected
          </h4>
        </div>
      </div>

      <p className="text-xs leading-relaxed opacity-95">
        {messageText ||
          'If you or someone nearby is experiencing acute chest pain, stroke signs, breathing failure, or sudden collapse, do not delay for text evaluation. Contact emergency dispatch immediately.'}
      </p>

      <div className="pt-1 flex flex-wrap items-center gap-2">
        <a
          href="tel:112"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface text-emergency font-bold text-xs shadow-xs hover:opacity-95 transition"
        >
          <PhoneCall className="w-4 h-4 text-emergency" />
          <span>Call 112 Now</span>
        </a>

        <Link
          href={`/${locale}/resources`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface/15 hover:bg-surface/25 text-surface font-semibold text-xs border border-surface/30 transition"
        >
          <span>Nearby Emergency Centers</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
