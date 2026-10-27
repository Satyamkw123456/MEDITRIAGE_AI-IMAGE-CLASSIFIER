"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ShieldAlert, 
  Users, 
  Settings, 
  Cpu, 
  SlidersHorizontal, 
  GitPullRequest, 
  Activity, 
  FileCheck2, 
  Terminal, 
  Search,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
  Command,
  FileText,
  LifeBuoy,
  Lock,
  Globe2
} from "lucide-react";
import { LanguageSwitcher } from "../shared/LanguageSwitcher";
import { PersistentImpersonationBanner } from "../admin/PersistentImpersonationBanner";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Core Oversight",
    items: [
      { name: "Command Room", href: "/dashboard/admin", icon: Activity },
      { name: "Approvals Center", href: "/dashboard/admin/approvals", icon: GitPullRequest, badge: "Dual" },
      { name: "Identity & Access", href: "/dashboard/admin/access", icon: Users },
      { name: "Clinicians Queue", href: "/dashboard/admin/clinicians", icon: FileCheck2 },
      { name: "Case & Queue Oversight", href: "/dashboard/admin/cases", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Clinical & AI Control",
    items: [
      { name: "Clinical Governance", href: "/dashboard/admin/governance", icon: FileCheck2 },
      { name: "World Medical Prices", href: "/dashboard/admin/world-prices", icon: Globe2, badge: "Stitch AI" },
      { name: "AI Control Center", href: "/dashboard/admin/ai-control", icon: Cpu },
      { name: "Content & Resources", href: "/dashboard/admin/content", icon: FileText },
    ],
  },
  {
    label: "Operations & Audit",
    items: [
      { name: "System Operations", href: "/dashboard/admin/operations", icon: Terminal },
      { name: "Audit & Compliance", href: "/dashboard/admin/audit", icon: Lock },
      { name: "Flags & Kill Switches", href: "/dashboard/admin/flags", icon: Settings },
      { name: "DPDP Data Rights", href: "/dashboard/admin/dpdp", icon: ShieldAlert },
      { name: "Support Tools", href: "/dashboard/admin/support", icon: LifeBuoy },
    ],
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen]);

  const allCommands = [
    ...NAV_GROUPS.flatMap((g) => g.items),
    { name: "Permission Matrix Editor (Spike)", href: "/dashboard/admin/access?tab=matrix", icon: ShieldAlert },
    { name: "Clinician Verification Queue", href: "/dashboard/admin/access?tab=clinicians", icon: FileCheck2 },
    { name: "Account Lockouts & Brute Force Monitor", href: "/dashboard/admin/access?tab=lockouts", icon: ShieldAlert },
    { name: "Emergency Kill Switches", href: "/dashboard/admin/flags?tab=killswitches", icon: Settings },
    { name: "Role-Based Panel Composition Editor", href: "/dashboard/admin/flags?tab=composition", icon: SlidersHorizontal },
    { name: "Settings & Version Rollback", href: "/dashboard/admin/flags?tab=settings", icon: Settings },
    { name: "Oversight: Unreviewed Cases Queue", href: "/dashboard/admin/cases?filter=unreviewed", icon: SlidersHorizontal },
    { name: "Oversight: Low-Confidence Backlog", href: "/dashboard/admin/cases?filter=low_confidence", icon: SlidersHorizontal },
    { name: "Oversight: Zero-PHI Metadata Search", href: "/dashboard/admin/cases?filter=search", icon: Search },
    { name: "DPDP: Statutory Data Rights Queue", href: "/dashboard/admin/dpdp?tab=requests", icon: ShieldAlert },
    { name: "DPDP: Litigation Legal Holds", href: "/dashboard/admin/dpdp?tab=holds", icon: ShieldAlert },
    { name: "DPDP: Digital Consent Ledger", href: "/dashboard/admin/dpdp?tab=ledger", icon: ShieldAlert },
    { name: "Governance: Clinical Rules & Regression Impact", href: "/dashboard/admin/governance?tab=rules", icon: FileCheck2 },
    { name: "Governance: Multilingual Questionnaires", href: "/dashboard/admin/governance?tab=questionnaires", icon: FileCheck2 },
    { name: "Governance: Quality Layer Parameters (Dual-Control)", href: "/dashboard/admin/governance?tab=quality", icon: Lock },
    { name: "AI Control: Models Allowlist & Global Kill Switch", href: "/dashboard/admin/ai-control?tab=models", icon: Cpu },
    { name: "AI Control: Prompt Registry & Live Sandbox", href: "/dashboard/admin/ai-control?tab=prompts", icon: Cpu },
    { name: "AI Control: Usage Dashboard & Scrubbed Log Drilldowns", href: "/dashboard/admin/ai-control?tab=usage", icon: Cpu },
    { name: "Support: User Impersonation Launcher", href: "/dashboard/admin/support?tab=impersonation", icon: LifeBuoy },
    { name: "Support: Emergency Break-Glass PHI Reveal", href: "/dashboard/admin/support?tab=breakglass", icon: ShieldAlert },
    { name: "Content: i18n Translation Strings Editor", href: "/dashboard/admin/content?tab=i18n", icon: FileText },
    { name: "Content: Consent Version & Re-consent Impact Warning", href: "/dashboard/admin/content?tab=consent", icon: FileText },
    { name: "Content: Emergency Helplines Directory (Stale >90d)", href: "/dashboard/admin/content?tab=directory", icon: FileText },
    { name: "Operations: System Subsystems Health", href: "/dashboard/admin/operations?tab=health", icon: Activity },
    { name: "Operations: Background Cron Jobs Monitor", href: "/dashboard/admin/operations?tab=jobs", icon: Terminal },
    { name: "Operations: RAG Knowledge Corpus & Instant Disable", href: "/dashboard/admin/operations?tab=rag", icon: Terminal },
    { name: "Operations: Rate Limits & IP Blocklist", href: "/dashboard/admin/operations?tab=rate-limits", icon: ShieldAlert },
    { name: "Operations: PHI-Free System Logs", href: "/dashboard/admin/operations?tab=logs", icon: Terminal },
    { name: "Audit: Cryptographic Audit Explorer & SHA-256 Chain", href: "/dashboard/admin/audit?tab=explorer", icon: Lock },
    { name: "Audit: HMAC Signed Export & Live Tamper Detector", href: "/dashboard/admin/audit?tab=export", icon: Lock },
    { name: "Audit: Security Incidents & Breach Logging", href: "/dashboard/admin/audit?tab=incidents", icon: ShieldAlert },
  ];
  const filteredCommands = allCommands.filter((item) =>
    item.name.toLowerCase().includes(commandQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-bg text-ink font-sans">
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-line sticky top-0 z-30">
        <Link href="/dashboard/admin" className="font-heading font-bold text-base text-primary flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          <span>MediTriage Admin</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="p-2 rounded-lg border border-line text-muted hover:text-ink"
            aria-label="Open Command Palette"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-line text-muted hover:text-ink"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-line flex flex-col transition-transform lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="p-4 border-b border-line flex items-center justify-between">
          <Link href="/dashboard/admin" className="font-heading font-bold text-lg text-primary flex items-center gap-2.5">
            <img src="/logo-icon.svg" alt="MediTriage Admin" className="h-7 w-auto object-contain" />
            <span>Admin Control</span>
          </Link>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-soft text-primary font-semibold">
            PROD-SEC
          </span>
        </div>

        {/* Quick Command Trigger */}
        <div className="p-3 border-b border-line bg-bg/50">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-line bg-surface text-xs text-muted hover:text-ink hover:border-primary/40 transition-colors shadow-xs"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Jump to command...</span>
            </span>
            <kbd className="font-mono text-[10px] bg-bg px-1.5 py-0.5 rounded border border-line text-muted">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 text-[11px] font-semibold text-muted uppercase tracking-wider">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-surface font-semibold shadow-xs"
                        : "text-ink hover:bg-bg hover:text-primary"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.name}</span>
                    </span>
                    {item.badge && (
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-surface text-primary" : "bg-urgent/10 text-urgent border border-urgent/20"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Admin Footer Status */}
        <div className="p-3 border-t border-line bg-bg/40 space-y-2 text-xs">
          <div className="flex items-center justify-between text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-selfcare inline-block"></span>
              Ledger Integrity
            </span>
            <span className="font-mono text-[11px] text-selfcare font-semibold">100% OK</span>
          </div>
          <div className="pt-2 border-t border-line/60 flex items-center justify-between">
            <LanguageSwitcher />
            <div className="text-[11px] font-mono text-muted">v2.4.0</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PersistentImpersonationBanner />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Command Palette Shell (Ctrl+K) */}
      {commandPaletteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cmd-palette-title"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-card border border-line bg-surface p-4 shadow-popover relative">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line mb-3">
              <Command className="w-4 h-4 text-primary" />
              <input
                id="cmd-palette-title"
                type="text"
                autoFocus
                placeholder="Type admin command, screen name, or entity..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                className="w-full text-sm bg-transparent border-none text-ink placeholder:text-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className="text-xs px-1.5 py-0.5 rounded bg-bg border border-line text-muted hover:text-ink"
              >
                Esc
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
              {filteredCommands.length === 0 ? (
                <div className="py-6 text-center text-muted">No commands matching &quot;{commandQuery}&quot;</div>
              ) : (
                filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <Link
                      key={cmd.name}
                      href={cmd.href}
                      onClick={() => setCommandPaletteOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg text-ink transition-colors"
                    >
                      <span className="flex items-center gap-2.5 font-medium">
                        <Icon className="w-4 h-4 text-muted" />
                        <span>{cmd.name}</span>
                      </span>
                      <span className="font-mono text-[11px] text-muted">{cmd.href}</span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
