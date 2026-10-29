'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const getLocalePrefix = () => {
    const segments = pathname.split('/');
    return ['en', 'hi', 'mr'].includes(segments[1]) ? `/${segments[1]}` : '/en';
  };

  useEffect(() => {
    if (!isLoading) {
      const prefix = getLocalePrefix();
      if (!isAuthenticated) {
        router.push(`${prefix}/login`);
      } else if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        // Redirect unauthorized roles to their default home
        if (user.role === 'clinician') router.push(`${prefix}/dashboard/clinician`);
        else if (user.role === 'admin') router.push(`${prefix}/dashboard/admin`);
        else router.push(`${prefix}/dashboard/patient`);
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted font-medium text-base">Authenticating clinical session...</p>
      </div>
    );
  }

  if (!isAuthenticated || (allowedRoles && user && !allowedRoles.includes(user.role))) {
    return null;
  }

  return <>{children}</>;
};
