import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { PermissionKey } from '../types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: PermissionKey;
  featureFlag?: string;
}

export function ProtectedRoute({ children, permission, featureFlag }: ProtectedRouteProps) {
  const { user, session, isLoading, hasPermission, isFeatureEnabled } = useAuth();
  const location = useLocation();

  if (isLoading || (session && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!session || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (featureFlag && !isFeatureEnabled(featureFlag)) {
    return <Navigate to="/feature-disabled" replace />;
  }

  return <>{children}</>;
}
