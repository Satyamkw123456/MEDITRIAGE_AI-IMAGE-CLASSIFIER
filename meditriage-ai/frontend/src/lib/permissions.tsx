/**
 * MediTriage AI — Permission-Aware Routing & Guardrails (Cycle 8)
 * Checks actual user permissions granted by backend RBAC rather than relying on role guesses.
 */

'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';

export function hasPermission(
  userPermissions: string[] | undefined | null,
  requiredPermission: string
): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;

  // Super-admin wildcard or master grant
  if (
    userPermissions.includes('super_admin') ||
    userPermissions.includes('perm.admin.all') ||
    userPermissions.includes('*')
  ) {
    return true;
  }

  // Exact match or canonical prefix match ('perm.user.manage' vs 'user.manage')
  const cleanReq = requiredPermission.replace(/^perm\./, '');
  return userPermissions.some(p => {
    const cleanP = p.replace(/^perm\./, '');
    return cleanP === cleanReq || p === requiredPermission;
  });
}

export function hasAnyPermission(
  userPermissions: string[] | undefined | null,
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some(p => hasPermission(userPermissions, p));
}

export function hasAllPermissions(
  userPermissions: string[] | undefined | null,
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every(p => hasPermission(userPermissions, p));
}

export interface RequirePermissionProps {
  permission: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Declarative component for conditional rendering based on backend permissions.
 */
export const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  requireAll = false,
  fallback = null,
  children,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  const perms = (user as any)?.permissions || [];
  const reqList = Array.isArray(permission) ? permission : [permission];

  const allowed = requireAll
    ? hasAllPermissions(perms, reqList)
    : hasAnyPermission(perms, reqList);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Hook to check if the active user possesses specific permission(s).
 */
export function usePermission(permission: string | string[], requireAll = false) {
  const { user, isLoading } = useAuth();
  const perms = (user as any)?.permissions || [];
  const reqList = Array.isArray(permission) ? permission : [permission];

  const allowed = requireAll
    ? hasAllPermissions(perms, reqList)
    : hasAnyPermission(perms, reqList);

  return {
    allowed,
    isLoading,
    permissions: perms,
  };
}
