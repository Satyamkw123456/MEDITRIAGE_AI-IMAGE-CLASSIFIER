"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Key, 
  GitPullRequest, 
  Search, 
  Filter, 
  Plus, 
  CheckSquare, 
  Square, 
  RotateCcw, 
  Save, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
  Lock,
  UserCheck
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { useAuth } from "@/context/AuthContext";

export interface PermissionItem {
  code: string;
  description: string;
  category: string;
  is_sensitive: boolean;
  requires_stepup: boolean;
  requires_dual_control: boolean;
}

export interface RoleItem {
  code: string;
  description: string;
  is_builtin: boolean;
  permission_count: number;
  user_count: number;
}

interface PermissionMatrixEditorProps {
  onRoleCreated?: (roleCode: string) => void;
}

export function PermissionMatrixEditor({ onRoleCreated }: PermissionMatrixEditorProps) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [assignedPerms, setAssignedPerms] = useState<Set<string>>(new Set());
  const [savedPerms, setSavedPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [filterSensitive, setFilterSensitive] = useState(false);
  const [filterStepUp, setFilterStepUp] = useState(false);
  const [filterDualControl, setFilterDualControl] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Modals
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleReason, setNewRoleReason] = useState("");
  const [createRoleError, setCreateRoleError] = useState<string | null>(null);

  // Load initial roles and permissions
  const fetchRolesAndPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, permsData]: [any, any] = await Promise.all([
        apiClient.fetch("/api/v1/admin/roles", "get"),
        apiClient.fetch("/api/v1/admin/permissions", "get"),
      ]);

      setRoles(rolesData.roles || []);
      setAllPermissions(permsData.permissions || []);
      if (rolesData.roles?.length > 0 && !selectedRole) {
        setSelectedRole(rolesData.roles[0].code);
      }
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load roles and permissions data.");
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    fetchRolesAndPermissions();
  }, [fetchRolesAndPermissions]);

  // Fetch permissions for selected role
  useEffect(() => {
    if (!selectedRole) return;
    const fetchRolePerms = async () => {
      try {
        const data: any = await apiClient.fetch("/api/v1/admin/roles/{role_code}/permissions", "get", {
          pathParams: { role_code: selectedRole },
        });
        const pSet = new Set<string>(data.permissions || []);
        setAssignedPerms(pSet);
        setSavedPerms(new Set(pSet));
      } catch (err) {
        console.error("Failed to load role permissions:", err);
      }
    };
    fetchRolePerms();
  }, [selectedRole]);

  // Group permissions by category
  const categories = useMemo(() => {
    const cats: Record<string, PermissionItem[]> = {};
    for (const p of allPermissions) {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p);
    }
    return cats;
  }, [allPermissions]);

  // Filtered permissions
  const filteredPermissions = useMemo(() => {
    return allPermissions.filter((p) => {
      if (selectedCategory !== "ALL" && p.category !== selectedCategory) return false;
      if (filterSensitive && !p.is_sensitive) return false;
      if (filterStepUp && !p.requires_stepup) return false;
      if (filterDualControl && !p.requires_dual_control) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allPermissions, selectedCategory, filterSensitive, filterStepUp, filterDualControl, searchQuery]);

  // Self-lockout check
  const isEditingOwnRole = user?.role === selectedRole;
  const criticalPerms = ["perm.admin.users.manage", "perm.admin.flags.manage"];
  const isSelfLockoutRisk = isEditingOwnRole && (user?.role as string) !== "super_admin" && criticalPerms.some((p) => !assignedPerms.has(p));

  // Changes count
  const hasChanges = useMemo(() => {
    if (assignedPerms.size !== savedPerms.size) return true;
    const currentList = Array.from(assignedPerms);
    for (const p of currentList) {
      if (!savedPerms.has(p)) return true;
    }
    return false;
  }, [assignedPerms, savedPerms]);

  const togglePermission = (code: string) => {
    if (selectedRole === "super_admin") return; // super_admin has immutable global grant
    setAssignedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleBulkCategory = (categoryName: string, select: boolean) => {
    if (selectedRole === "super_admin") return;
    const catPerms = categories[categoryName] || [];
    setAssignedPerms((prev) => {
      const next = new Set(prev);
      for (const p of catPerms) {
        if (select) next.add(p.code);
        else next.delete(p.code);
      }
      return next;
    });
  };

  const handleBulkFiltered = (select: boolean) => {
    if (selectedRole === "super_admin") return;
    setAssignedPerms((prev) => {
      const next = new Set(prev);
      for (const p of filteredPermissions) {
        if (select) next.add(p.code);
        else next.delete(p.code);
      }
      return next;
    });
  };

  const handleReset = () => {
    setAssignedPerms(new Set(savedPerms));
  };

  const handleSaveConfirmed = async ({ reason }: { category: string; reason: string }) => {
    if (isSelfLockoutRisk) {
      setError("Self-Lockout Safeguard: You cannot revoke critical user/flag management permissions from your own active role!");
      setReasonDialogOpen(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiClient.fetch("/api/v1/admin/roles/{role_code}/permissions", "put", {
        pathParams: { role_code: selectedRole },
        body: {
          permissions: Array.from(assignedPerms),
          reason,
        },
      });

      setSavedPerms(new Set(assignedPerms));
      setSuccessMsg(`Permissions for role '${selectedRole}' updated successfully.`);
      fetchRolesAndPermissions();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to update role permissions.");
    } finally {
      setSaving(false);
      setReasonDialogOpen(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleCode.trim()) {
      setCreateRoleError("Role code is required.");
      return;
    }
    if (newRoleReason.trim().length < 3) {
      setCreateRoleError("Reason must be at least 3 characters.");
      return;
    }

    setSaving(true);
    setCreateRoleError(null);
    try {
      const created: any = await apiClient.fetch("/api/v1/admin/roles", "post", {
        body: {
          code: newRoleCode.trim().toLowerCase().replace(" ", "_"),
          description: newRoleDesc.trim() || undefined,
          permissions: Array.from(assignedPerms),
          reason: newRoleReason.trim(),
        },
      });

      setCreateRoleModalOpen(false);
      setNewRoleCode("");
      setNewRoleDesc("");
      setNewRoleReason("");
      setSuccessMsg(`Custom role '${created.role_code}' created successfully.`);
      await fetchRolesAndPermissions();
      setSelectedRole(created.role_code);
      if (onRoleCreated) onRoleCreated(created.role_code);
    } catch (err: any) {
      setCreateRoleError(err.data?.detail || err.message || "Failed to create role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Role Selection Bar */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-soft text-primary font-mono text-xs font-semibold mb-1">
              <Shield className="w-3.5 h-3.5" />
              Role & Permission Matrix
            </div>
            <h2 className="text-xl font-heading font-bold text-ink">
              Fine-Grained Access Control (40+ Permissions)
            </h2>
            <p className="text-xs text-muted">
              Configure precise permission boundaries, step-up requirements, and dual-control rules per role.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreateRoleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary-dark transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Role</span>
          </button>
        </div>

        {/* Role Pills Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
          {roles.map((r) => {
            const isSelected = selectedRole === r.code;
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => setSelectedRole(r.code)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? "border-primary bg-primary text-surface shadow-xs"
                    : "border-line bg-bg text-ink hover:border-primary/40 hover:bg-surface"
                }`}
              >
                <span>{r.code}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? "bg-surface/20 text-surface" : "bg-surface text-muted border border-line"
                  }`}
                >
                  {r.is_builtin ? "Builtin" : "Custom"}
                </span>
                <span className={`text-[10px] font-mono ${isSelected ? "text-surface/80" : "text-muted"}`}>
                  ({r.permission_count || 0})
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Role Meta */}
        <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-line text-muted">
          <div className="flex items-center gap-3">
            <span>
              Target Role: <strong className="font-mono text-ink font-bold">{selectedRole}</strong>
            </span>
            <span>
              Assigned: <strong className="text-primary font-mono font-bold">{assignedPerms.size}</strong> / {allPermissions.length} permissions
            </span>
          </div>
          {selectedRole === "super_admin" && (
            <span className="flex items-center gap-1 text-urgent font-medium">
              <Lock className="w-3.5 h-3.5" />
              Super Admin possesses immutable wildcard permissions
            </span>
          )}
        </div>
      </div>

      {/* Self-Lockout Warning Banner */}
      {isSelfLockoutRisk && (
        <div className="p-4 rounded-xl border border-emergency bg-emergency/10 text-xs text-emergency flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold text-sm block">Self-Lockout Safeguard Triggered!</strong>
            <p>
              You are modifying your own active role (<span className="font-mono font-bold">{user?.role}</span>).
              You have removed critical management permission(s): <strong className="font-mono">{criticalPerms.filter(p => !assignedPerms.has(p)).join(", ")}</strong>.
              Saving this configuration is blocked to prevent admin lockout.
            </p>
          </div>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg border border-emergency/30 bg-emergency/5 text-xs text-emergency flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-semibold underline">Dismiss</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-lg border border-selfcare/30 bg-selfcare/5 text-xs text-selfcare flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs font-semibold underline">Dismiss</button>
        </div>
      )}

      {/* Search, Filter & Bulk Actions Bar */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search 40+ permissions by code, namespace, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-line bg-bg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface transition-all text-ink"
            />
          </div>

          {/* Quick Bulk Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkFiltered(true)}
              disabled={selectedRole === "super_admin"}
              className="px-2.5 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink flex items-center gap-1 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
              <span>Select Filtered ({filteredPermissions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkFiltered(false)}
              disabled={selectedRole === "super_admin"}
              className="px-2.5 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink flex items-center gap-1 transition-colors"
            >
              <Square className="w-3.5 h-3.5 text-muted" />
              <span>Clear Filtered</span>
            </button>
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-muted" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line text-xs">
          <span className="text-muted font-medium text-[11px] mr-1">Categories:</span>
          {["ALL", ...Object.keys(categories)].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-primary text-surface font-semibold"
                  : "bg-bg text-ink border border-line hover:border-primary/40"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}

          <span className="text-muted font-medium text-[11px] ml-3 mr-1">Flags:</span>
          <button
            type="button"
            onClick={() => setFilterSensitive(!filterSensitive)}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
              filterSensitive ? "bg-amber-600 text-white font-semibold" : "bg-bg text-ink border border-line"
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Sensitive</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStepUp(!filterStepUp)}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
              filterStepUp ? "bg-purple-600 text-white font-semibold" : "bg-bg text-ink border border-line"
            }`}
          >
            <Key className="w-3 h-3" />
            <span>Step-Up</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterDualControl(!filterDualControl)}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
              filterDualControl ? "bg-blue-600 text-white font-semibold" : "bg-bg text-ink border border-line"
            }`}
          >
            <GitPullRequest className="w-3 h-3" />
            <span>Dual-Control</span>
          </button>
        </div>
      </div>

      {/* Permission Categories Groups */}
      <div className="space-y-4">
        {Object.entries(categories).map(([catName, catPerms]) => {
          // If searching or category-filtering, hide empty groups
          const groupFiltered = catPerms.filter((p) => filteredPermissions.some((fp) => fp.code === p.code));
          if (groupFiltered.length === 0) return null;

          const assignedInCat = groupFiltered.filter((p) => assignedPerms.has(p.code)).length;
          const isCollapsed = collapsedCategories[catName];

          return (
            <div key={catName} className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
              {/* Category Header */}
              <div className="p-3.5 bg-bg/60 border-b border-line flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedCategories((prev) => ({ ...prev, [catName]: !prev[catName] }))
                  }
                  className="flex items-center gap-2 text-left font-heading font-semibold text-sm text-ink hover:text-primary transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                  <span>{catName}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface border border-line text-muted font-normal">
                    {assignedInCat} / {groupFiltered.length} active
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkCategory(catName, true)}
                    disabled={selectedRole === "super_admin"}
                    className="text-[11px] px-2 py-0.5 rounded border border-line bg-surface text-ink hover:bg-bg hover:text-primary transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkCategory(catName, false)}
                    disabled={selectedRole === "super_admin"}
                    className="text-[11px] px-2 py-0.5 rounded border border-line bg-surface text-muted hover:bg-bg hover:text-ink transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Category Permissions List */}
              {!isCollapsed && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {groupFiltered.map((p) => {
                    const isChecked = selectedRole === "super_admin" || assignedPerms.has(p.code);
                    const isCritical = criticalPerms.includes(p.code);

                    return (
                      <div
                        key={p.code}
                        onClick={() => togglePermission(p.code)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                          isChecked
                            ? "border-primary/40 bg-primary-soft/10 text-ink shadow-2xs"
                            : "border-line/70 bg-surface text-muted hover:border-line hover:text-ink"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={selectedRole === "super_admin"}
                          onChange={() => togglePermission(p.code)}
                          className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary pointer-events-none"
                        />
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-ink break-all">
                              {p.code}
                            </span>
                            {isCritical && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emergency/10 text-emergency font-semibold">
                                Critical
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted leading-tight">
                            {p.description}
                          </p>

                          {/* Security attribute badges */}
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            {p.is_sensitive && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                Sensitive
                              </span>
                            )}
                            {p.requires_stepup && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                <Key className="w-2.5 h-2.5" />
                                Step-Up MFA
                              </span>
                            )}
                            {p.requires_dual_control && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                <GitPullRequest className="w-2.5 h-2.5" />
                                Dual-Control
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Save Footer when changes present */}
      {hasChanges && selectedRole !== "super_admin" && (
        <div className="sticky bottom-4 z-20 rounded-card border-2 border-primary bg-surface p-4 shadow-popover flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-ink">
                Unsaved Permission Changes for <span className="font-mono text-primary font-bold">{selectedRole}</span>
              </p>
              <p className="text-[11px] text-muted">
                {assignedPerms.size} total permissions selected ({assignedPerms.size - savedPerms.size >= 0 ? `+${assignedPerms.size - savedPerms.size}` : assignedPerms.size - savedPerms.size} net change)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-line bg-bg text-xs font-medium text-ink hover:bg-surface transition-colors"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={() => setReasonDialogOpen(true)}
              disabled={isSelfLockoutRisk || saving}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                isSelfLockoutRisk
                  ? "bg-muted text-surface cursor-not-allowed"
                  : "bg-primary text-surface hover:bg-primary-dark"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Role Permissions"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Reason Dialog for Save Role Permissions */}
      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`Confirm Permission Changes: Role '${selectedRole}'`}
        actionDescription={`Updating permissions for role '${selectedRole}'. Total active permissions: ${assignedPerms.size}.`}
        categories={[
          "Administrative Protocol Alignment",
          "Principle of Least Privilege Hardening",
          "Clinical Governance Role Realignment",
          "Emergency Break-Glass Assignment",
        ]}
        minReasonLength={5}
        isLoading={saving}
        onConfirm={handleSaveConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />

      {/* Modal: Create Custom Role */}
      {createRoleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-role-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-popover relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 id="create-role-title" className="font-heading font-semibold text-lg text-ink">
                Create Custom Role
              </h3>
              <button
                type="button"
                onClick={() => setCreateRoleModalOpen(false)}
                className="text-muted hover:text-ink p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            {createRoleError && (
              <div className="p-2.5 rounded-lg border border-emergency/30 bg-emergency/10 text-xs text-emergency">
                {createRoleError}
              </div>
            )}

            <form onSubmit={handleCreateRole} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-ink font-medium mb-1">
                  Role Code <span className="text-emergency">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. triage_nurse, er_coordinator, audit_clerk"
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Brief description of responsibilities and scope"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">
                  Creation Justification (Reason) <span className="text-emergency">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Operational or compliance rationale for introducing this custom role"
                  value={newRoleReason}
                  onChange={(e) => setNewRoleReason(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-lg border border-line bg-bg text-[11px] text-muted space-y-1">
                <p>Initial permissions will inherit from currently selected items ({assignedPerms.size} selected).</p>
                <p>You can fine-tune them anytime after role creation.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setCreateRoleModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark transition-all shadow-xs"
                >
                  {saving ? "Creating..." : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
