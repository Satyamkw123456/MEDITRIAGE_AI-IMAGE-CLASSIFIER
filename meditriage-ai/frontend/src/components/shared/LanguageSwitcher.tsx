"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { ChangeEvent, useTransition } from "react";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  variant?: "select" | "pills";
  className?: string;
}

export function LanguageSwitcher({
  variant = "select",
  className = "",
}: LanguageSwitcherProps) {
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (nextLocale: string) => {
    if (nextLocale === locale) return;
    startTransition(() => {
      // Replace the leading locale segment
      const segments = pathname.split("/");
      segments[1] = nextLocale;
      const newPathname = segments.join("/") || `/${nextLocale}`;
      router.replace(newPathname);
    });
  };

  const languages = [
    { code: "en", label: "English", nativeLabel: "English" },
    { code: "hi", label: "Hindi", nativeLabel: "हिंदी" },
    { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
  ];

  if (variant === "pills") {
    return (
      <div 
        role="group" 
        aria-label="Language selection"
        className={`inline-flex rounded-lg border border-line bg-surface p-1 shadow-xs ${className}`}
      >
        {languages.map((lang) => {
          const isActive = locale === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => switchLocale(lang.code)}
              disabled={isPending}
              aria-pressed={isActive}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                isActive
                  ? "bg-primary text-surface shadow-xs font-semibold"
                  : "text-muted hover:text-ink hover:bg-bg/60"
              }`}
            >
              {lang.nativeLabel}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <Globe className="w-4 h-4 text-muted shrink-0 pointer-events-none" aria-hidden="true" />
      <select
        aria-label="Select system language"
        className="rounded-lg border border-line bg-surface text-ink text-xs font-medium py-1.5 pl-2 pr-6 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer disabled:opacity-50"
        value={locale}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => switchLocale(e.target.value)}
        disabled={isPending}
      >
        <option value="en">English (EN)</option>
        <option value="hi">हिंदी (HI)</option>
        <option value="mr">मराठी (MR)</option>
      </select>
    </div>
  );
}

export default LanguageSwitcher;
