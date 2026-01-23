import { useAuth } from '../contexts/AuthContext';
import type { PermissionKey } from '../types';

export function usePermission(permission: PermissionKey): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

export function usePermissions(permissions: PermissionKey[]): Record<PermissionKey, boolean> {
  const { hasPermission } = useAuth();

  return permissions.reduce((acc, permission) => {
    acc[permission] = hasPermission(permission);
    return acc;
  }, {} as Record<PermissionKey, boolean>);
}

export function useAnyPermission(permissions: PermissionKey[]): boolean {
  const { hasPermission } = useAuth();
  return permissions.some(permission => hasPermission(permission));
}

export function useAllPermissions(permissions: PermissionKey[]): boolean {
  const { hasPermission } = useAuth();
  return permissions.every(permission => hasPermission(permission));
}
