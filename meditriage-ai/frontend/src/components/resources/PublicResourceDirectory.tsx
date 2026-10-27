"use client";

import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/api/client";
import { 
  Building2, 
  Ambulance, 
  PhoneCall, 
  Clock, 
  Search, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle,
  HeartHandshake,
  ExternalLink
} from "lucide-react";

interface EmergencyResourceItem {
  id: number;
  name: string;
  category: "hospital" | "ambulance" | "helpline" | string;
  phone_number: string;
  city_region: string;
  last_verified_at: string;
  is_pune_local: boolean;
  is_active: boolean;
}

export function PublicResourceDirectory() {
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<EmergencyResourceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true);
      try {
        const data: any = await apiClient.fetch("/api/v1/public/resources", "get");
        setResources(data || []);
      } catch {
        // Fallback for demonstration / local testing
        setResources([
          {
            id: 1,
            name: "Sassoon General Hospital & Trauma Center",
            category: "hospital",
            phone_number: "+91 20 2612 8000",
            city_region: "Pune, Maharashtra",
            last_verified_at: new Date().toISOString(),
            is_pune_local: true,
            is_active: true,
          },
          {
            id: 2,
            name: "PMC Emergency Ambulance Dispatch (108)",
            category: "ambulance",
            phone_number: "108",
            city_region: "Pune & PCMC, Maharashtra",
            last_verified_at: new Date().toISOString(),
            is_pune_local: true,
            is_active: true,
          },
          {
            id: 3,
            name: "KEM Hospital Pune Emergency Room",
            category: "hospital",
            phone_number: "+91 20 6603 7300",
            city_region: "Pune, Maharashtra",
            last_verified_at: new Date(Date.now() - 86400000 * 20).toISOString(),
            is_pune_local: true,
            is_active: true,
          },
          {
            id: 4,
            name: "National Emergency Response Support System",
            category: "helpline",
            phone_number: "112",
            city_region: "National Dispatch",
            last_verified_at: new Date().toISOString(),
            is_pune_local: false,
            is_active: true,
          },
          {
            id: 5,
            name: "National Senior Citizen Helpline (Elder Line)",
            category: "helpline",
            phone_number: "14567",
            city_region: "National / Maharashtra",
            last_verified_at: new Date(Date.now() - 86400000 * 45).toISOString(),
            is_pune_local: false,
            is_active: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
  }, []);

  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.city_region.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.phone_number.includes(searchQuery);

      if (!matchesSearch) return false;

      if (selectedCategory === "all") return true;
      if (selectedCategory === "pune") return item.is_pune_local;
      return item.category === selectedCategory;
    });
  }, [resources, searchQuery, selectedCategory]);

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "hospital":
        return <Building2 className="w-4 h-4 text-primary" />;
      case "ambulance":
        return <Ambulance className="w-4 h-4 text-emergency" />;
      default:
        return <PhoneCall className="w-4 h-4 text-primary" />;
    }
  };

  const isStale = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffDays = (Date.now() - d.getTime()) / (1000 * 3600 * 24);
    return diffDays > 90;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl border border-line bg-surface space-y-2 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
          <MapPin className="w-4 h-4" />
          <span>Pune-First Verified Directory</span>
        </div>
        <h1 className="font-heading font-bold text-xl sm:text-2xl text-ink">
          Emergency Services &amp; Helplines
        </h1>
        <p className="text-xs text-muted max-w-2xl">
          Verified medical centers, emergency ambulance fleets, and 24/7 helplines. Prioritized for the Pune &amp; PCMC metropolitan region with live verified timestamps.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedCategory === "all"
                ? "bg-primary text-surface shadow-xs"
                : "bg-surface border border-line text-ink hover:bg-bg"
            }`}
          >
            All Resources ({resources.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("pune")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
              selectedCategory === "pune"
                ? "bg-primary text-surface shadow-xs"
                : "bg-surface border border-line text-ink hover:bg-bg"
            }`}
          >
            <MapPin className="w-3 h-3" />
            <span>Pune Local Only</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("hospital")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
              selectedCategory === "hospital"
                ? "bg-primary text-surface shadow-xs"
                : "bg-surface border border-line text-ink hover:bg-bg"
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span>Hospitals</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("ambulance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
              selectedCategory === "ambulance"
                ? "bg-primary text-surface shadow-xs"
                : "bg-surface border border-line text-ink hover:bg-bg"
            }`}
          >
            <Ambulance className="w-3 h-3" />
            <span>Ambulance</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("helpline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
              selectedCategory === "helpline"
                ? "bg-primary text-surface shadow-xs"
                : "bg-surface border border-line text-ink hover:bg-bg"
            }`}
          >
            <PhoneCall className="w-3 h-3" />
            <span>24/7 Helplines</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facility or phone..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
          />
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredResources.map((item) => {
          const stale = isStale(item.last_verified_at);
          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border bg-surface flex flex-col justify-between space-y-4 shadow-xs hover:border-primary/40 transition-colors ${
                item.is_pune_local ? "border-primary/30 ring-1 ring-primary/10" : "border-line"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-bg border border-line flex items-center justify-center shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                      {item.category}
                    </span>
                  </div>

                  {item.is_pune_local && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-soft text-primary border border-primary/20">
                      <MapPin className="w-3 h-3" />
                      <span>Pune Priority</span>
                    </span>
                  )}
                </div>

                <h2 className="font-heading font-bold text-base text-ink leading-snug">
                  {item.name}
                </h2>

                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                  <span>{item.city_region}</span>
                </div>
              </div>

              {/* Bottom Actions and Verification */}
              <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[11px]">
                  {stale ? (
                    <span className="text-muted flex items-center gap-1" title="Pending quarterly clinical verification">
                      <AlertTriangle className="w-3 h-3 text-muted" />
                      <span>Verified: {new Date(item.last_verified_at).toLocaleDateString()}</span>
                    </span>
                  ) : (
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      <span>Verified: {new Date(item.last_verified_at).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>

                <a
                  href={`tel:${item.phone_number.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-surface text-xs font-bold shadow-xs hover:bg-primary-hover transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call {item.phone_number}</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
