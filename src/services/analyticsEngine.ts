import { supabase } from '../lib/supabase';

export type TimeRange = '7d' | '30d' | '90d' | 'custom';

export interface TimeRangeParams {
  range: TimeRange;
  startDate?: string;
  endDate?: string;
}

export interface UserContext {
  userId: string;
  organizationId: string;
  roleId?: string;
  departmentId?: string;
  isSuperAdmin?: boolean;
}

export interface AnalyticsScope {
  departmentId?: string;
  ownedOnly?: boolean;
}

export interface DeltaResult {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getTimeRangeDates(params: TimeRangeParams): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(params.endDate || now);
  end.setHours(23, 59, 59, 999);

  let start: Date;

  if (params.range === 'custom' && params.startDate) {
    start = new Date(params.startDate);
  } else {
    start = new Date(end);
    switch (params.range) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }
  }

  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export function getPreviousPeriodDates(params: TimeRangeParams): { start: Date; end: Date } {
  const { start: currentStart, end: currentEnd } = getTimeRangeDates(params);
  const periodLength = currentEnd.getTime() - currentStart.getTime();

  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - periodLength);

  return { start: previousStart, end: previousEnd };
}

export function calculateDelta(current: number, previous: number): DeltaResult {
  const delta = current - previous;
  const deltaPercent = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((delta / previous) * 100);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (deltaPercent > 2) trend = 'up';
  else if (deltaPercent < -2) trend = 'down';

  return { current, previous, delta, deltaPercent, trend };
}

export function getCacheKey(prefix: string, params: Record<string, unknown>): string {
  return `${prefix}:${JSON.stringify(params)}`;
}

export function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCachedData<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

export function clearCache(prefix?: string): void {
  if (prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

export async function getUserPermissionScope(userContext: UserContext): Promise<{
  canViewOrgWide: boolean;
  canViewDepartment: boolean;
  departmentId?: string;
}> {
  if (userContext.isSuperAdmin) {
    return { canViewOrgWide: true, canViewDepartment: true };
  }

  if (!userContext.roleId) {
    return { canViewOrgWide: false, canViewDepartment: false, departmentId: userContext.departmentId };
  }

  const { data: role } = await supabase
    .from('roles')
    .select('name')
    .eq('id', userContext.roleId)
    .maybeSingle();

  const roleName = role?.name?.toLowerCase() || '';

  if (roleName === 'admin' || roleName === 'superadmin') {
    return { canViewOrgWide: true, canViewDepartment: true };
  }

  if (roleName === 'manager') {
    return { canViewOrgWide: false, canViewDepartment: true, departmentId: userContext.departmentId };
  }

  return { canViewOrgWide: false, canViewDepartment: false, departmentId: userContext.departmentId };
}

export function buildOwnershipFilter(
  scope: AnalyticsScope,
  userContext: UserContext,
  permissionScope: { canViewOrgWide: boolean; canViewDepartment: boolean; departmentId?: string }
): { ownerFilter?: string; departmentFilter?: string } {
  if (scope.ownedOnly) {
    return { ownerFilter: userContext.userId };
  }

  if (permissionScope.canViewOrgWide) {
    if (scope.departmentId) {
      return { departmentFilter: scope.departmentId };
    }
    return {};
  }

  if (permissionScope.canViewDepartment && permissionScope.departmentId) {
    return { departmentFilter: permissionScope.departmentId };
  }

  return { ownerFilter: userContext.userId };
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function calculatePercentile(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  if (index === -1) return 100;
  return Math.round((index / sorted.length) * 100);
}

export function groupByField<T>(items: T[], field: keyof T): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const key = String(item[field]);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sumField<T>(items: T[], field: keyof T): number {
  return items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
}

export function averageField<T>(items: T[], field: keyof T): number {
  if (items.length === 0) return 0;
  return sumField(items, field) / items.length;
}
