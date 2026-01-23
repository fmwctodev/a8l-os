import { useAuth } from '../contexts/AuthContext';
import type { PermissionKey } from '../types';

interface PermissionGateProps {
  children: React.ReactNode;
  permission: PermissionKey;
  fallback?: React.ReactNode;
}

export function PermissionGate({ children, permission, fallback = null }: PermissionGateProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
