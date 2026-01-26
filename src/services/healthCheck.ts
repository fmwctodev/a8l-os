import { supabase } from '../lib/supabase';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: string;
  duration: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  duration?: number;
  details?: Record<string, unknown>;
}

export interface OrphanRecord {
  table: string;
  id: string;
  foreignKey: string;
  missingReference: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function runHealthChecks(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];

  checks.push(await checkDatabaseConnection());
  checks.push(await checkCriticalTables());
  checks.push(await checkRlsPolicies());
  checks.push(await checkFeatureFlags());
  checks.push(await checkPermissionsIntegrity());

  const failedChecks = checks.filter(c => c.status === 'fail').length;
  const warnChecks = checks.filter(c => c.status === 'warn').length;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (failedChecks > 0) {
    status = 'unhealthy';
  } else if (warnChecks > 0) {
    status = 'degraded';
  }

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
  };
}

async function checkDatabaseConnection(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const { error } = await supabase.from('organizations').select('id').limit(1);

    if (error) {
      return {
        name: 'database_connection',
        status: 'fail',
        message: `Database connection failed: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }

    return {
      name: 'database_connection',
      status: 'pass',
      message: 'Database connection successful',
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      name: 'database_connection',
      status: 'fail',
      message: `Database connection error: ${err instanceof Error ? err.message : 'Unknown'}`,
      duration: Date.now() - startTime,
    };
  }
}

async function checkCriticalTables(): Promise<HealthCheck> {
  const startTime = Date.now();
  const criticalTables = [
    'organizations',
    'users',
    'roles',
    'permissions',
    'contacts',
    'conversations',
    'messages',
    'appointments',
    'opportunities',
    'pipelines',
    'pipeline_stages',
    'workflows',
    'ai_agents',
  ];

  const missingTables: string[] = [];

  for (const table of criticalTables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error && error.message.includes('does not exist')) {
        missingTables.push(table);
      }
    } catch {
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    return {
      name: 'critical_tables',
      status: 'fail',
      message: `Missing critical tables: ${missingTables.join(', ')}`,
      duration: Date.now() - startTime,
      details: { missingTables },
    };
  }

  return {
    name: 'critical_tables',
    status: 'pass',
    message: `All ${criticalTables.length} critical tables present`,
    duration: Date.now() - startTime,
  };
}

async function checkRlsPolicies(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.rpc('check_rls_enabled', {});

    if (error) {
      return {
        name: 'rls_policies',
        status: 'warn',
        message: 'Could not verify RLS policies (check function may not exist)',
        duration: Date.now() - startTime,
      };
    }

    const tablesWithoutRls = data?.filter((t: { rls_enabled: boolean }) => !t.rls_enabled) || [];

    if (tablesWithoutRls.length > 0) {
      return {
        name: 'rls_policies',
        status: 'warn',
        message: `${tablesWithoutRls.length} tables without RLS`,
        duration: Date.now() - startTime,
        details: { tablesWithoutRls },
      };
    }

    return {
      name: 'rls_policies',
      status: 'pass',
      message: 'All tables have RLS enabled',
      duration: Date.now() - startTime,
    };
  } catch {
    return {
      name: 'rls_policies',
      status: 'warn',
      message: 'RLS check skipped (function not available)',
      duration: Date.now() - startTime,
    };
  }
}

async function checkFeatureFlags(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, enabled')
      .limit(100);

    if (error) {
      return {
        name: 'feature_flags',
        status: 'warn',
        message: `Could not check feature flags: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }

    const enabledCount = data?.filter(f => f.enabled).length || 0;
    const totalCount = data?.length || 0;

    return {
      name: 'feature_flags',
      status: 'pass',
      message: `${enabledCount}/${totalCount} feature flags enabled`,
      duration: Date.now() - startTime,
      details: { enabledCount, totalCount },
    };
  } catch {
    return {
      name: 'feature_flags',
      status: 'warn',
      message: 'Feature flags check failed',
      duration: Date.now() - startTime,
    };
  }
}

async function checkPermissionsIntegrity(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name');

    if (rolesError) {
      return {
        name: 'permissions_integrity',
        status: 'warn',
        message: `Could not check permissions: ${rolesError.message}`,
        duration: Date.now() - startTime,
      };
    }

    const { data: permissions, error: permsError } = await supabase
      .from('permissions')
      .select('id, key');

    if (permsError) {
      return {
        name: 'permissions_integrity',
        status: 'warn',
        message: `Could not check permissions: ${permsError.message}`,
        duration: Date.now() - startTime,
      };
    }

    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('role_id, permission_id');

    const rolesWithNoPermissions = roles?.filter(
      role => !rolePerms?.some(rp => rp.role_id === role.id)
    ) || [];

    if (rolesWithNoPermissions.length > 0) {
      return {
        name: 'permissions_integrity',
        status: 'warn',
        message: `${rolesWithNoPermissions.length} roles have no permissions assigned`,
        duration: Date.now() - startTime,
        details: {
          rolesWithNoPermissions: rolesWithNoPermissions.map(r => r.name),
          totalRoles: roles?.length || 0,
          totalPermissions: permissions?.length || 0,
        },
      };
    }

    return {
      name: 'permissions_integrity',
      status: 'pass',
      message: `${roles?.length || 0} roles, ${permissions?.length || 0} permissions configured`,
      duration: Date.now() - startTime,
      details: {
        totalRoles: roles?.length || 0,
        totalPermissions: permissions?.length || 0,
      },
    };
  } catch {
    return {
      name: 'permissions_integrity',
      status: 'warn',
      message: 'Permissions integrity check failed',
      duration: Date.now() - startTime,
    };
  }
}

export async function detectOrphanRecords(
  orgId: string
): Promise<OrphanRecord[]> {
  const orphans: OrphanRecord[] = [];

  const { data: contactsWithBadOwner } = await supabase
    .from('contacts')
    .select('id, owner_id')
    .eq('org_id', orgId)
    .not('owner_id', 'is', null);

  if (contactsWithBadOwner) {
    const ownerIds = [...new Set(contactsWithBadOwner.map(c => c.owner_id))];
    const { data: validUsers } = await supabase
      .from('users')
      .select('id')
      .in('id', ownerIds);

    const validUserIds = new Set(validUsers?.map(u => u.id) || []);

    for (const contact of contactsWithBadOwner) {
      if (contact.owner_id && !validUserIds.has(contact.owner_id)) {
        orphans.push({
          table: 'contacts',
          id: contact.id,
          foreignKey: 'owner_id',
          missingReference: contact.owner_id,
        });
      }
    }
  }

  const { data: oppsWithBadPipeline } = await supabase
    .from('opportunities')
    .select('id, pipeline_id')
    .eq('org_id', orgId);

  if (oppsWithBadPipeline) {
    const pipelineIds = [...new Set(oppsWithBadPipeline.map(o => o.pipeline_id))];
    const { data: validPipelines } = await supabase
      .from('pipelines')
      .select('id')
      .in('id', pipelineIds);

    const validPipelineIds = new Set(validPipelines?.map(p => p.id) || []);

    for (const opp of oppsWithBadPipeline) {
      if (!validPipelineIds.has(opp.pipeline_id)) {
        orphans.push({
          table: 'opportunities',
          id: opp.id,
          foreignKey: 'pipeline_id',
          missingReference: opp.pipeline_id,
        });
      }
    }
  }

  const { data: appsWithBadCalendar } = await supabase
    .from('appointments')
    .select('id, calendar_id')
    .eq('org_id', orgId);

  if (appsWithBadCalendar) {
    const calendarIds = [...new Set(appsWithBadCalendar.map(a => a.calendar_id))];
    const { data: validCalendars } = await supabase
      .from('calendars')
      .select('id')
      .in('id', calendarIds);

    const validCalendarIds = new Set(validCalendars?.map(c => c.id) || []);

    for (const app of appsWithBadCalendar) {
      if (!validCalendarIds.has(app.calendar_id)) {
        orphans.push({
          table: 'appointments',
          id: app.id,
          foreignKey: 'calendar_id',
          missingReference: app.calendar_id,
        });
      }
    }
  }

  return orphans;
}

export async function validateCustomFieldConfiguration(
  orgId: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { data: fields, error } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null);

  if (error) {
    return {
      valid: false,
      errors: [`Failed to fetch custom fields: ${error.message}`],
      warnings: [],
    };
  }

  const fieldKeys = new Set<string>();
  for (const field of fields || []) {
    if (fieldKeys.has(field.field_key)) {
      errors.push(`Duplicate field_key: ${field.field_key}`);
    }
    fieldKeys.add(field.field_key);

    if (['select', 'multi_select', 'radio'].includes(field.field_type)) {
      if (!field.options && !field.option_items) {
        warnings.push(`Field "${field.name}" (${field.field_type}) has no options defined`);
      }
    }

    if (field.is_required && field.default_value === null) {
      warnings.push(`Required field "${field.name}" has no default value`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function validateWorkflowConfiguration(
  orgId: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { data: workflows, error } = await supabase
    .from('workflows')
    .select('id, name, trigger_type, nodes, edges, status')
    .eq('org_id', orgId);

  if (error) {
    return {
      valid: false,
      errors: [`Failed to fetch workflows: ${error.message}`],
      warnings: [],
    };
  }

  for (const workflow of workflows || []) {
    if (workflow.status === 'published') {
      const nodes = workflow.nodes as Record<string, unknown>[] | null;
      const edges = workflow.edges as Array<{ source: string; target: string }> | null;

      if (!nodes || Object.keys(nodes).length === 0) {
        errors.push(`Published workflow "${workflow.name}" has no nodes`);
      }

      if (!workflow.trigger_type) {
        errors.push(`Published workflow "${workflow.name}" has no trigger type`);
      }

      if (nodes && edges) {
        const nodeIds = new Set(Object.keys(nodes));
        for (const edge of edges) {
          if (!nodeIds.has(edge.source)) {
            errors.push(`Workflow "${workflow.name}" has edge from non-existent node: ${edge.source}`);
          }
          if (!nodeIds.has(edge.target)) {
            errors.push(`Workflow "${workflow.name}" has edge to non-existent node: ${edge.target}`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function getSystemStats(orgId: string): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  const tables = [
    { key: 'contacts', table: 'contacts' },
    { key: 'opportunities', table: 'opportunities' },
    { key: 'appointments', table: 'appointments' },
    { key: 'conversations', table: 'conversations' },
    { key: 'messages', table: 'messages' },
    { key: 'invoices', table: 'invoices' },
    { key: 'workflows', table: 'workflows' },
    { key: 'forms', table: 'forms' },
    { key: 'surveys', table: 'surveys' },
    { key: 'ai_agents', table: 'ai_agents' },
  ];

  for (const { key, table } of tables) {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      stats[key] = count || 0;
    } catch {
      stats[key] = -1;
    }
  }

  return stats;
}
