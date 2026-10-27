"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Key, 
  RotateCcw, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Shield,
  CheckCircle2,
  Clock,
  UserPlus,
  Eye,
  Edit3,
  X
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { ConfirmTypeToProceed } from "@/components/shared/ConfirmTypeToProceed";
import { useAuth } from "@/context/AuthContext";

export interface UserRow {
  id: number;
  name: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_suspended: boolean;
  token_version: number;
  clinician_verification_status: string;
  requires_reconsent: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
}

export function UserDirectoryTable() {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("id");
  const [sortDesc, setSortDesc] = useState(false);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Action Dialogs
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);
  const [reasonAction, setReasonAction] = useState<string | null>(null);
  const [reasonTitle, setReasonTitle] = useState("");
  const [reasonDesc, setReasonDesc] = useState("");
  const [reasonPayload, setReasonPayload] = useState<any>({});
  const [isDestructiveConfirmOpen, setIsDestructiveConfirmOpen] = useState(false);
  const [destructiveExpectedWord, setDestructiveExpectedWord] = useState("");
  const [destructiveActionFn, setDestructiveActionFn] = useState<() => Promise<void>>(() => async () => {});

  // Role Assign Modal State
  const [assignRoleModalOpen, setAssignRoleModalOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [targetNewRole, setTargetNewRole] = useState("clinician");

  // Temp Grant Modal State
  const [tempGrantModalOpen, setTempGrantModalOpen] = useState(false);
  const [tempPermCode, setTempPermCode] = useState("perm.cases.override_triage");
  const [tempDuration, setTempDuration] = useState(60);

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("clinician");
  const [inviteReason, setInviteReason] = useState("");

  // User Detail View Modal State
  const [userDetailModalOpen, setUserDetailModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<any | null>(null);
  const [detailUserLoading, setDetailUserLoading] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Load available roles
  useEffect(() => {
    apiClient.fetch("/api/v1/admin/roles", "get")
      .then((d: any) => {
        if (d.roles) setAvailableRoles(d.roles.map((r: any) => r.code));
      })
      .catch(() => {});
  }, []);

  // Load Users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/users", "get", {
        params: {
          limit,
          offset,
          sort_by: sortBy,
          sort_desc: sortDesc,
          search: search.trim() || undefined,
          role: roleFilter || undefined,
          is_suspended: statusFilter === "suspended" ? true : statusFilter === "active" ? false : undefined,
        },
      });
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load users directory.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, limit, offset, sortBy, sortDesc]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleSelectUser = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) setSelectedIds([]);
    else setSelectedIds(users.map((u) => u.id));
  };

  // Safe Action Dispatcher with Reason
  const triggerActionWithReason = (
    actionKey: string,
    title: string,
    desc: string,
    targetUser?: UserRow,
    extraPayload?: any
  ) => {
    setReasonAction(actionKey);
    setReasonTitle(title);
    setReasonDesc(desc);
    setActiveUser(targetUser || null);
    setReasonPayload(extraPayload || {});
  };

  const handleReasonConfirmed = async ({ reason }: { category: string; reason: string }) => {
    const action = reasonAction;
    setReasonAction(null);
    if (!action) return;

    // Check if destructive and requires ConfirmTypeToProceed
    if (action === "SUSPEND_USER" && activeUser) {
      setDestructiveExpectedWord("SUSPEND");
      setDestructiveActionFn(() => async () => {
        await executeSuspendUser(activeUser.id, reason);
      });
      setIsDestructiveConfirmOpen(true);
      return;
    }

    if (action === "BULK_SUSPEND") {
      setDestructiveExpectedWord("SUSPEND ALL");
      setDestructiveActionFn(() => async () => {
        await executeBulkAction("suspend", { reason });
      });
      setIsDestructiveConfirmOpen(true);
      return;
    }

    // Direct executions with reason
    try {
      if (action === "REACTIVATE_USER" && activeUser) {
        await executeReactivateUser(activeUser.id, reason);
      } else if (action === "REVOKE_SESSIONS" && activeUser) {
        await executeRevokeSessions(activeUser.id, reason);
      } else if (action === "RESET_PASSWORD" && activeUser) {
        await executeResetPassword(activeUser.id, reasonPayload.newPassword, reason);
      } else if (action === "ASSIGN_ROLE" && activeUser) {
        await executeAssignRole(activeUser.id, reasonPayload.newRole, reason);
      } else if (action === "TEMP_GRANT" && activeUser) {
        await executeTempGrant(activeUser.id, reasonPayload.permissionCode, reasonPayload.duration, reason);
      } else if (action === "UNLOCK_USER" && activeUser) {
        await executeUnlockUser(activeUser.id, reason);
      } else if (action === "RESET_MFA" && activeUser) {
        await executeResetMFA(activeUser.id, reason);
      } else if (action === "BULK_REACTIVATE") {
        await executeBulkAction("reactivate", { reason });
      } else if (action === "BULK_REVOKE_SESSIONS") {
        await executeBulkAction("revoke_sessions", { reason });
      }
    } catch (err: any) {
      setError(err.message || "Action failed.");
    }
  };

  // Execution functions
  const openUserDetail = async (userId: number) => {
    setDetailUserLoading(true);
    setUserDetailModalOpen(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/users/{user_id}", "get", {
        pathParams: { user_id: userId },
      });
      setDetailUser(data);
      setEditFullName(data.full_name || data.name || "");
      setEditPhoneNumber(data.phone_number || "");
      setEditReason("");
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load user details.");
    } finally {
      setDetailUserLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailUser) return;
    if (!editReason.trim() || editReason.trim().length < 5) {
      setError("Please provide a justification reason (min 5 chars) for updating user profile.");
      return;
    }
    setIsSavingUser(true);
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}", "patch", {
        pathParams: { user_id: detailUser.id },
        body: {
          full_name: editFullName.trim(),
          phone_number: editPhoneNumber.trim(),
          reason: editReason.trim(),
        },
      });
      setSuccessMsg(`User #${detailUser.id} profile updated successfully.`);
      setUserDetailModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to update user.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const executeResetMFA = async (userId: number, reason: string) => {
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/reset-mfa", "post", {
        pathParams: { user_id: userId },
        body: { reason },
      });
      setSuccessMsg(`MFA disabled and TOTP credentials revoked for User #${userId}.`);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to reset MFA.");
    }
  };

  const executeSuspendUser = async (userId: number, reason: string) => {
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/suspend", "post", {
        pathParams: { user_id: userId },
        body: { reason },
      });
      setSuccessMsg(`User #${userId} suspended successfully.`);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to suspend user.");
    }
  };

  const executeReactivateUser = async (userId: number, reason: string) => {
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/reactivate", "post", {
        pathParams: { user_id: userId },
        body: { reason },
      });
      setSuccessMsg(`User #${userId} reactivated successfully.`);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to reactivate user.");
    }
  };

  const executeRevokeSessions = async (userId: number, reason: string) => {
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/revoke-sessions", "post", {
        pathParams: { user_id: userId },
        body: { reason },
      });
      setSuccessMsg(`Active sessions revoked for user #${userId}. Token version incremented.`);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to revoke sessions.");
    }
  };

  const executeResetPassword = async (userId: number, newPassword: string, reason: string) => {
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/reset-password", "post", {
        pathParams: { user_id: userId },
        body: { new_password: newPassword, reason },
      });
      setSuccessMsg(`Password reset successfully for user #${userId}.`);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to reset password.");
    }
  };

  const executeAssignRole = async (userId: number, newRole: string, reason: string) => {
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/assign-role", "post", {
        pathParams: { user_id: userId },
        body: { new_role: newRole, reason },
      });
      setSuccessMsg(`Role for user #${userId} changed to '${newRole}'.`);
      setAssignRoleModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to assign role.");
    }
  };

  const executeTempGrant = async (userId: number, permissionCode: string, durationMinutes: number, reason: string) => {
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/grants", "post", {
        pathParams: { user_id: userId },
        body: {
          permission_code: permissionCode,
          duration_minutes: durationMinutes,
          reason,
        },
      });
      setSuccessMsg(`Temporary permission '${permissionCode}' granted for ${durationMinutes}m.`);
      setTempGrantModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to grant temporary permission.");
    }
  };

  const executeUnlockUser = async (userId: number, reason: string) => {
    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/unlock", "post", {
        pathParams: { user_id: userId },
        body: { reason },
      });
      setSuccessMsg(`User #${userId} lockout cleared.`);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to unlock user account.");
    }
  };

  const executeBulkAction = async (actionType: string, params: any) => {
    if (selectedIds.length === 0) return;
    try {
      await apiClient.fetch("/api/v1/admin/users/bulk", "post", {
        body: {
          action_type: actionType,
          user_ids: selectedIds,
          params,
          reason: params.reason || "Bulk administrative intervention",
        },
      });
      setSuccessMsg(`Bulk action '${actionType}' completed for ${selectedIds.length} users.`);
      setSelectedIds([]);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to execute bulk action.");
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.fetch("/api/v1/admin/users", "post", {
        body: {
          email: inviteEmail.trim(),
          full_name: inviteName.trim(),
          role: inviteRole,
          reason: inviteReason.trim(),
        },
      });
      setInviteModalOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteReason("");
      setSuccessMsg(`User invitation dispatched successfully.`);
      loadUsers();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to create user invite.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg border border-emergency/30 bg-emergency/5 text-xs text-emergency flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="underline font-semibold">Dismiss</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-lg border border-selfcare/30 bg-selfcare/5 text-xs text-selfcare flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="underline font-semibold">Dismiss</button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-line bg-bg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface text-ink"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setOffset(0);
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-bg text-ink focus:outline-none"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="clinician">Clinician</option>
            <option value="patient">Patient</option>
            <option value="caregiver">Caregiver</option>
            <option value="super_admin">Super Admin</option>
            <option value="ops_admin">Ops Admin</option>
            <option value="clinical_admin">Clinical Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-bg text-ink focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <span className="text-xs font-mono font-bold text-primary mr-1">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() =>
                  triggerActionWithReason(
                    "BULK_SUSPEND",
                    "Bulk User Suspension",
                    `Are you sure you want to suspend ${selectedIds.length} users simultaneously?`
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-emergency/10 border border-emergency/20 text-emergency text-xs font-semibold hover:bg-emergency/20 transition-colors"
              >
                Suspend
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerActionWithReason(
                    "BULK_REACTIVATE",
                    "Bulk User Reactivation",
                    `Reactivate ${selectedIds.length} selected users.`
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-selfcare/10 border border-selfcare/20 text-selfcare text-xs font-semibold hover:bg-selfcare/20 transition-colors"
              >
                Reactivate
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerActionWithReason(
                    "BULK_REVOKE_SESSIONS",
                    "Bulk Session Revocation",
                    `Revoke sessions for ${selectedIds.length} users, forcing immediate logout.`
                  )
                }
                className="px-2.5 py-1.5 rounded-lg border border-line bg-bg text-xs font-medium text-ink hover:bg-surface transition-colors"
              >
                Revoke Sessions
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary-dark transition-all shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite User</span>
          </button>
        </div>
      </div>

      {/* Users DataTable */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedIds.length === users.length}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-primary"
                  />
                </th>
                <th className="p-3">User & Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Verification</th>
                <th className="p-3">Status</th>
                <th className="p-3">Token Ver</th>
                <th className="p-3">Lockout State</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    Loading users directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isLocked = u.failed_login_attempts >= 5 || Boolean(u.locked_until);
                  const isCurrentAdmin = currentAdmin?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-bg/40 transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.id)}
                          onChange={() => toggleSelectUser(u.id)}
                          className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-ink flex items-center gap-1.5">
                          <span>{u.name || u.full_name || "Unnamed"}</span>
                          {isCurrentAdmin && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary-soft text-primary font-bold">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted font-mono">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-mono px-2 py-0.5 rounded-md bg-bg border border-line text-ink font-semibold">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3">
                        {u.role === "clinician" ? (
                          u.clinician_verification_status === "approved" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-selfcare font-semibold">
                              <ShieldCheck className="w-3.5 h-3.5" /> Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-urgent font-semibold">
                              <Clock className="w-3.5 h-3.5" /> {u.clinician_verification_status || "Pending"}
                            </span>
                          )
                        ) : (
                          <span className="text-muted text-[11px]">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        {u.is_suspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emergency/10 text-emergency border border-emergency/20">
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-selfcare/10 text-selfcare border border-selfcare/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-muted text-xs">
                        v{u.token_version}
                      </td>
                      <td className="p-3">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 text-emergency text-[11px] font-semibold">
                            <Lock className="w-3 h-3" /> Locked ({u.failed_login_attempts} fails)
                          </span>
                        ) : (
                          <span className="text-muted text-[11px]">Clear (0)</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View & Edit User Detail */}
                          <button
                            type="button"
                            onClick={() => openUserDetail(u.id)}
                            className="p-1 rounded text-muted hover:text-ink hover:bg-bg"
                            title="View & Edit User Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset MFA */}
                          <button
                            type="button"
                            onClick={() =>
                              triggerActionWithReason(
                                "RESET_MFA",
                                `Reset MFA for User #${u.id}`,
                                `Revoke MFA/TOTP credentials and disable multi-factor requirement for ${u.email}`,
                                u
                              )
                            }
                            className="p-1 rounded text-urgent hover:text-emergency hover:bg-urgent/10"
                            title="Reset MFA"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>

                          {/* Assign Role */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveUser(u);
                              setTargetNewRole(u.role);
                              setAssignRoleModalOpen(true);
                            }}
                            className="p-1 rounded text-muted hover:text-ink hover:bg-bg"
                            title="Assign Role"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* Temporary Grant */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveUser(u);
                              setTempGrantModalOpen(true);
                            }}
                            className="p-1 rounded text-muted hover:text-ink hover:bg-bg"
                            title="Temporary Permission Grant"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Unlock if locked */}
                          {isLocked && (
                            <button
                              type="button"
                              onClick={() =>
                                triggerActionWithReason(
                                  "UNLOCK_USER",
                                  `Unlock User #${u.id}`,
                                  `Clear failed login count and unlock account for ${u.email}`,
                                  u
                                )
                              }
                              className="p-1 rounded text-selfcare hover:bg-selfcare/10"
                              title="Unlock Account"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Revoke Sessions */}
                          <button
                            type="button"
                            onClick={() =>
                              triggerActionWithReason(
                                "REVOKE_SESSIONS",
                                `Revoke Sessions for User #${u.id}`,
                                `Forces immediate token invalidation for ${u.email}. User must re-authenticate.`,
                                u
                              )
                            }
                            className="p-1 rounded text-muted hover:text-ink hover:bg-bg"
                            title="Revoke Sessions"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend / Reactivate */}
                          {u.is_suspended ? (
                            <button
                              type="button"
                              onClick={() =>
                                triggerActionWithReason(
                                  "REACTIVATE_USER",
                                  `Reactivate User #${u.id}`,
                                  `Restores system access for suspended user ${u.email}`,
                                  u
                                )
                              }
                              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-selfcare/10 text-selfcare hover:bg-selfcare/20"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isCurrentAdmin} // Prevent self-suspension
                              onClick={() =>
                                triggerActionWithReason(
                                  "SUSPEND_USER",
                                  `Suspend User #${u.id}`,
                                  `Immediate suspension of ${u.email}. The user will be barred from logging in or using active sessions.`,
                                  u
                                )
                              }
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                isCurrentAdmin
                                  ? "bg-bg text-muted cursor-not-allowed"
                                  : "bg-emergency/10 text-emergency hover:bg-emergency/20"
                              }`}
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-line bg-bg/40 flex items-center justify-between text-xs text-muted">
          <span>
            Showing <strong className="text-ink">{users.length}</strong> of{" "}
            <strong className="text-ink">{total}</strong> users
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              className="p-1 rounded border border-line bg-surface text-ink disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs">
              Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit) || 1}
            </span>
            <button
              type="button"
              disabled={offset + limit >= total}
              onClick={() => setOffset((prev) => prev + limit)}
              className="p-1 rounded border border-line bg-surface text-ink disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Universal Reason Dialog */}
      <ReasonDialog
        isOpen={Boolean(reasonAction)}
        title={reasonTitle}
        actionDescription={reasonDesc}
        minReasonLength={5}
        onConfirm={handleReasonConfirmed}
        onCancel={() => setReasonAction(null)}
      />

      {/* Confirm Type-To-Proceed Modal for Destructive Operations */}
      <ConfirmTypeToProceed
        isOpen={isDestructiveConfirmOpen}
        title="Confirm Destructive Action"
        warningMessage="This action immediately disables user privileges or terminates sessions across all devices. An audit record will be irrevocably committed."
        expectedWord={destructiveExpectedWord}
        confirmButtonText="I understand the consequences, proceed"
        onConfirm={async () => {
          setIsDestructiveConfirmOpen(false);
          await destructiveActionFn();
        }}
        onCancel={() => setIsDestructiveConfirmOpen(false)}
      />

      {/* Modal: Assign Role */}
      {assignRoleModalOpen && activeUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-popover space-y-4">
            <h3 className="font-heading font-semibold text-base text-ink">
              Assign Role: {activeUser.email}
            </h3>
            <div className="space-y-2 text-xs">
              <label className="block text-ink font-medium">Select New Role:</label>
              <select
                value={targetNewRole}
                onChange={(e) => setTargetNewRole(e.target.value)}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line text-xs">
              <button
                type="button"
                onClick={() => setAssignRoleModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-line bg-bg text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignRoleModalOpen(false);
                  triggerActionWithReason(
                    "ASSIGN_ROLE",
                    `Change Role: User #${activeUser.id}`,
                    `Reassign user ${activeUser.email} to role '${targetNewRole}'.`,
                    activeUser,
                    { newRole: targetNewRole }
                  );
                }}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark"
              >
                Continue with Justification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Temporary Permission Grant */}
      {tempGrantModalOpen && activeUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-popover space-y-4">
            <h3 className="font-heading font-semibold text-base text-ink">
              Temporary Grant: {activeUser.email}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-ink font-medium mb-1">Permission Code:</label>
                <input
                  type="text"
                  value={tempPermCode}
                  onChange={(e) => setTempPermCode(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-ink"
                  placeholder="perm.cases.override_triage"
                />
              </div>
              <div>
                <label className="block text-ink font-medium mb-1">Duration (Minutes):</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={tempDuration}
                  onChange={(e) => setTempDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line text-xs">
              <button
                type="button"
                onClick={() => setTempGrantModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-line bg-bg text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempGrantModalOpen(false);
                  triggerActionWithReason(
                    "TEMP_GRANT",
                    `Temporary Grant for #${activeUser.id}`,
                    `Granting '${tempPermCode}' for ${tempDuration} minutes to ${activeUser.email}.`,
                    activeUser,
                    { permissionCode: tempPermCode, duration: tempDuration }
                  );
                }}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark"
              >
                Continue with Justification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Invite User */}
      {inviteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-popover space-y-4">
            <h3 className="font-heading font-semibold text-base text-ink">
              Invite New User
            </h3>
            <form onSubmit={handleInviteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink font-medium mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Dr. Ananya Sharma"
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink font-medium mb-1">Email Address:</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ananya@hospital.org"
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink font-medium mb-1">Assigned Role:</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-ink font-medium mb-1">Invitation Justification:</label>
                <textarea
                  required
                  rows={2}
                  value={inviteReason}
                  onChange={(e) => setInviteReason(e.target.value)}
                  placeholder="Clinical department staffing need..."
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line bg-bg text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Detail View & Edit Modal */}
      {userDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-line rounded-card max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-base text-ink">
                  User Detail #{detailUser?.id || "..."}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setUserDetailModalOpen(false); setDetailUser(null); }}
                className="p-1 rounded-lg border border-line hover:bg-bg text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailUserLoading ? (
              <div className="p-8 text-center text-xs text-muted">
                Loading user profile metadata from /admin/users/{detailUser?.id}...
              </div>
            ) : detailUser ? (
              <div className="space-y-4 text-xs">
                {/* User Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-bg rounded-lg border border-line">
                  <div>
                    <span className="text-muted block text-[11px]">Email Address</span>
                    <span className="font-mono font-bold text-ink">{detailUser.email}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">System Role</span>
                    <span className="font-mono font-bold text-ink uppercase">{detailUser.role}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Account Status</span>
                    <span className={detailUser.is_suspended ? "text-emergency font-bold" : "text-selfcare font-bold"}>
                      {detailUser.is_suspended ? "Suspended" : "Active"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">MFA Security</span>
                    <span className={detailUser.mfa_enabled === "true" || detailUser.mfa_secret ? "text-selfcare font-semibold" : "text-muted"}>
                      {detailUser.mfa_enabled === "true" || detailUser.mfa_secret ? "MFA Enabled" : "MFA Disabled"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Token Version</span>
                    <span className="font-mono text-muted">v{detailUser.token_version}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Lockout State</span>
                    <span className={detailUser.locked_until ? "text-emergency font-semibold" : "text-selfcare"}>
                      {detailUser.locked_until ? `Locked until ${new Date(detailUser.locked_until).toLocaleTimeString()}` : "Unlocked"}
                    </span>
                  </div>
                </div>

                {/* Edit Profile Form */}
                <form onSubmit={handleUpdateUser} className="space-y-3 pt-2 border-t border-line">
                  <h4 className="font-heading font-semibold text-xs text-ink">Update User Profile (PATCH)</h4>
                  <div>
                    <label className="block text-ink font-medium mb-1">Full Name:</label>
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-ink font-medium mb-1">Phone Number:</label>
                    <input
                      type="text"
                      value={editPhoneNumber}
                      onChange={(e) => setEditPhoneNumber(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-ink font-medium mb-1">Audit Justification Reason:</label>
                    <textarea
                      required
                      rows={2}
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="Reason for administrative profile modification..."
                      className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-line">
                    <button
                      type="button"
                      onClick={() => {
                        setUserDetailModalOpen(false);
                        triggerActionWithReason(
                          "RESET_MFA",
                          `Reset MFA for User #${detailUser.id}`,
                          `Revoke MFA/TOTP credentials and disable multi-factor requirement for ${detailUser.email}`,
                          detailUser
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg border border-urgent/30 text-urgent hover:bg-urgent/10 font-semibold"
                    >
                      Reset MFA
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setUserDetailModalOpen(false); setDetailUser(null); }}
                        className="px-3 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-ink"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingUser}
                        className="px-4 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark disabled:opacity-50"
                      >
                        {isSavingUser ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-emergency">Failed to load user information.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
