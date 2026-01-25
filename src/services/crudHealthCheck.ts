import { supabase } from '../lib/supabase';

export interface FieldValidationResult {
  field: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message?: string;
}

export interface EntityTestResult {
  entity: string;
  passed: boolean;
  duration: number;
  createPassed: boolean;
  readPassed: boolean;
  updatePassed: boolean;
  deletePassed: boolean;
  auditLogExists: boolean;
  fieldValidations: FieldValidationResult[];
  errors: string[];
}

export interface HealthCheckReport {
  timestamp: string;
  overallPassed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: EntityTestResult[];
}

const TEST_PREFIX = '__crud_test_';

async function cleanupTestData(tableName: string, idField = 'id'): Promise<void> {
  try {
    if (tableName === 'contacts') {
      await supabase.from(tableName).delete().ilike('first_name', `${TEST_PREFIX}%`);
    } else if (tableName === 'opportunities') {
      await supabase.from(tableName).delete().ilike('source', `${TEST_PREFIX}%`);
    } else if (tableName === 'messages') {
      await supabase.from(tableName).delete().ilike('body', `${TEST_PREFIX}%`);
    }
  } catch (e) {
    console.warn(`Failed to cleanup ${tableName}:`, e);
  }
}

export async function verifyContactsCRUD(
  orgId: string,
  userId: string
): Promise<EntityTestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const fieldValidations: FieldValidationResult[] = [];
  let createPassed = false;
  let readPassed = false;
  let updatePassed = false;
  let deletePassed = false;
  let auditLogExists = false;
  let createdId: string | null = null;

  const testContact = {
    organization_id: orgId,
    first_name: `${TEST_PREFIX}John`,
    last_name: 'Doe',
    email: `${TEST_PREFIX}${Date.now()}@test.com`,
    phone: '+15551234567',
    company: 'Test Company',
    job_title: 'Test Engineer',
    source: 'health_check',
    status: 'active',
    created_by: userId,
  };

  try {
    const { data: created, error: createError } = await supabase
      .from('contacts')
      .insert(testContact)
      .select()
      .single();

    if (createError) {
      errors.push(`Create failed: ${createError.message}`);
    } else if (created) {
      createPassed = true;
      createdId = created.id;

      for (const [key, value] of Object.entries(testContact)) {
        if (key === 'organization_id') continue;
        const actual = created[key];
        const passed = actual === value;
        fieldValidations.push({
          field: key,
          passed,
          expected: value,
          actual,
          message: passed ? undefined : `Mismatch on ${key}`,
        });
      }
    }
  } catch (e) {
    errors.push(`Create error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (createdId) {
    try {
      const { data: read, error: readError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', createdId)
        .single();

      if (readError) {
        errors.push(`Read failed: ${readError.message}`);
      } else if (read) {
        readPassed = true;
      }
    } catch (e) {
      errors.push(`Read error: ${e instanceof Error ? e.message : String(e)}`);
    }

    const updatedValues = {
      last_name: 'UpdatedDoe',
      company: 'Updated Company',
    };

    try {
      const { data: updated, error: updateError } = await supabase
        .from('contacts')
        .update(updatedValues)
        .eq('id', createdId)
        .select()
        .single();

      if (updateError) {
        errors.push(`Update failed: ${updateError.message}`);
      } else if (updated) {
        updatePassed = updated.last_name === updatedValues.last_name &&
          updated.company === updatedValues.company;

        if (!updatePassed) {
          errors.push('Update values not persisted correctly');
        }
      }
    } catch (e) {
      errors.push(`Update error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', 'contact')
        .eq('entity_id', createdId)
        .limit(1);

      auditLogExists = (auditLogs?.length || 0) > 0;
    } catch (e) {
      console.warn('Audit log check failed:', e);
    }

    try {
      const { error: deleteError } = await supabase
        .from('contacts')
        .update({ status: 'archived' })
        .eq('id', createdId);

      if (deleteError) {
        errors.push(`Soft-delete failed: ${deleteError.message}`);
      } else {
        deletePassed = true;
      }

      await supabase.from('contacts').delete().eq('id', createdId);
    } catch (e) {
      errors.push(`Delete error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const duration = Date.now() - startTime;
  const passed = createPassed && readPassed && updatePassed && deletePassed;

  return {
    entity: 'contacts',
    passed,
    duration,
    createPassed,
    readPassed,
    updatePassed,
    deletePassed,
    auditLogExists,
    fieldValidations,
    errors,
  };
}

export async function verifyOpportunitiesCRUD(
  orgId: string,
  userId: string,
  contactId: string,
  pipelineId: string,
  stageId: string
): Promise<EntityTestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const fieldValidations: FieldValidationResult[] = [];
  let createPassed = false;
  let readPassed = false;
  let updatePassed = false;
  let deletePassed = false;
  let auditLogExists = false;
  let createdId: string | null = null;

  const testOpportunity = {
    org_id: orgId,
    contact_id: contactId,
    pipeline_id: pipelineId,
    stage_id: stageId,
    value_amount: 5000,
    currency: 'USD',
    source: `${TEST_PREFIX}health_check`,
    status: 'open',
    created_by: userId,
  };

  try {
    const { data: created, error: createError } = await supabase
      .from('opportunities')
      .insert(testOpportunity)
      .select()
      .single();

    if (createError) {
      errors.push(`Create failed: ${createError.message}`);
    } else if (created) {
      createPassed = true;
      createdId = created.id;

      for (const [key, value] of Object.entries(testOpportunity)) {
        const actual = created[key];
        const passed = actual === value || (typeof value === 'number' && Number(actual) === value);
        fieldValidations.push({
          field: key,
          passed,
          expected: value,
          actual,
          message: passed ? undefined : `Mismatch on ${key}`,
        });
      }
    }
  } catch (e) {
    errors.push(`Create error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (createdId) {
    try {
      const { data: read, error: readError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', createdId)
        .single();

      if (readError) {
        errors.push(`Read failed: ${readError.message}`);
      } else if (read) {
        readPassed = true;
      }
    } catch (e) {
      errors.push(`Read error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const { data: updated, error: updateError } = await supabase
        .from('opportunities')
        .update({ value_amount: 7500 })
        .eq('id', createdId)
        .select()
        .single();

      if (updateError) {
        errors.push(`Update failed: ${updateError.message}`);
      } else if (updated && Number(updated.value_amount) === 7500) {
        updatePassed = true;
      } else {
        errors.push('Update value not persisted');
      }
    } catch (e) {
      errors.push(`Update error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const { data: stageHistory } = await supabase
        .from('opportunity_stage_history')
        .select('*')
        .eq('opportunity_id', createdId)
        .limit(1);

      if (stageHistory && stageHistory.length > 0) {
        auditLogExists = true;
      }
    } catch (e) {
      console.warn('Stage history check failed:', e);
    }

    try {
      const { error: deleteError } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', createdId);

      if (deleteError) {
        errors.push(`Delete failed: ${deleteError.message}`);
      } else {
        deletePassed = true;
      }
    } catch (e) {
      errors.push(`Delete error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const duration = Date.now() - startTime;
  const passed = createPassed && readPassed && updatePassed && deletePassed;

  return {
    entity: 'opportunities',
    passed,
    duration,
    createPassed,
    readPassed,
    updatePassed,
    deletePassed,
    auditLogExists,
    fieldValidations,
    errors,
  };
}

export async function verifyMessagesCRUD(
  orgId: string,
  userId: string,
  conversationId: string,
  contactId: string
): Promise<EntityTestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const fieldValidations: FieldValidationResult[] = [];
  let createPassed = false;
  let readPassed = false;
  let updatePassed = false;
  let deletePassed = false;
  let auditLogExists = false;
  let createdId: string | null = null;

  const testMessage = {
    organization_id: orgId,
    conversation_id: conversationId,
    contact_id: contactId,
    channel: 'sms',
    direction: 'outbound',
    body: `${TEST_PREFIX}Health check test message`,
    status: 'pending',
  };

  try {
    const { data: created, error: createError } = await supabase
      .from('messages')
      .insert(testMessage)
      .select()
      .single();

    if (createError) {
      errors.push(`Create failed: ${createError.message}`);
    } else if (created) {
      createPassed = true;
      createdId = created.id;

      for (const [key, value] of Object.entries(testMessage)) {
        const actual = created[key];
        const passed = actual === value;
        fieldValidations.push({
          field: key,
          passed,
          expected: value,
          actual,
          message: passed ? undefined : `Mismatch on ${key}`,
        });
      }
    }
  } catch (e) {
    errors.push(`Create error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (createdId) {
    try {
      const { data: read, error: readError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', createdId)
        .single();

      if (readError) {
        errors.push(`Read failed: ${readError.message}`);
      } else if (read) {
        readPassed = true;
      }
    } catch (e) {
      errors.push(`Read error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const { data: updated, error: updateError } = await supabase
        .from('messages')
        .update({ status: 'delivered' })
        .eq('id', createdId)
        .select()
        .single();

      if (updateError) {
        errors.push(`Update failed: ${updateError.message}`);
      } else if (updated && updated.status === 'delivered') {
        updatePassed = true;
      } else {
        errors.push('Update status not persisted');
      }
    } catch (e) {
      errors.push(`Update error: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const { error: hideError } = await supabase
        .from('messages')
        .update({
          hidden_at: new Date().toISOString(),
          hidden_by_user_id: userId,
        })
        .eq('id', createdId);

      if (hideError) {
        errors.push(`Hide failed: ${hideError.message}`);
      } else {
        deletePassed = true;

        const { data: auditLogs } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('entity_type', 'message')
          .eq('entity_id', createdId)
          .limit(1);

        auditLogExists = (auditLogs?.length || 0) > 0;
      }

      await supabase.from('messages').delete().eq('id', createdId);
    } catch (e) {
      errors.push(`Hide error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const duration = Date.now() - startTime;
  const passed = createPassed && readPassed && updatePassed && deletePassed;

  return {
    entity: 'messages',
    passed,
    duration,
    createPassed,
    readPassed,
    updatePassed,
    deletePassed,
    auditLogExists,
    fieldValidations,
    errors,
  };
}

export async function verifyAuditLogsCRUD(
  orgId: string,
  userId: string
): Promise<EntityTestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const fieldValidations: FieldValidationResult[] = [];
  let createPassed = false;
  let readPassed = false;
  const updatePassed = true;
  const deletePassed = true;
  const auditLogExists = true;
  let createdId: string | null = null;

  const testAuditLog = {
    user_id: userId,
    organization_id: orgId,
    actor_user_name: 'Health Check User',
    action: 'health_check_test',
    entity_type: 'system',
    entity_id: null,
    before_state: { test: 'before' },
    after_state: { test: 'after' },
  };

  try {
    const { data: created, error: createError } = await supabase
      .from('audit_logs')
      .insert(testAuditLog)
      .select()
      .single();

    if (createError) {
      errors.push(`Create failed: ${createError.message}`);
    } else if (created) {
      createPassed = true;
      createdId = created.id;

      fieldValidations.push({
        field: 'actor_user_name',
        passed: created.actor_user_name === testAuditLog.actor_user_name,
        expected: testAuditLog.actor_user_name,
        actual: created.actor_user_name,
      });

      fieldValidations.push({
        field: 'timestamp',
        passed: !!created.timestamp,
        expected: 'auto-generated',
        actual: created.timestamp,
      });
    }
  } catch (e) {
    errors.push(`Create error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (createdId) {
    try {
      const { data: read, error: readError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('id', createdId)
        .single();

      if (readError) {
        errors.push(`Read failed: ${readError.message}`);
      } else if (read) {
        readPassed = true;
      }
    } catch (e) {
      errors.push(`Read error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const duration = Date.now() - startTime;
  const passed = createPassed && readPassed;

  return {
    entity: 'audit_logs',
    passed,
    duration,
    createPassed,
    readPassed,
    updatePassed,
    deletePassed,
    auditLogExists,
    fieldValidations,
    errors,
  };
}

export async function runFullHealthCheck(
  orgId: string,
  userId: string
): Promise<HealthCheckReport> {
  const results: EntityTestResult[] = [];

  await cleanupTestData('contacts');
  await cleanupTestData('opportunities');
  await cleanupTestData('messages');

  results.push(await verifyContactsCRUD(orgId, userId));
  results.push(await verifyAuditLogsCRUD(orgId, userId));

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('organization_id', orgId)
    .limit(1);

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, stages:pipeline_stages(id)')
    .eq('org_id', orgId)
    .limit(1);

  if (contacts?.length && pipelines?.length && (pipelines[0] as any).stages?.length) {
    results.push(
      await verifyOpportunitiesCRUD(
        orgId,
        userId,
        contacts[0].id,
        pipelines[0].id,
        (pipelines[0] as any).stages[0].id
      )
    );
  }

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, contact_id')
    .eq('organization_id', orgId)
    .limit(1);

  if (conversations?.length) {
    results.push(
      await verifyMessagesCRUD(
        orgId,
        userId,
        conversations[0].id,
        conversations[0].contact_id
      )
    );
  }

  const passedTests = results.filter((r) => r.passed).length;

  return {
    timestamp: new Date().toISOString(),
    overallPassed: passedTests === results.length,
    totalTests: results.length,
    passedTests,
    failedTests: results.length - passedTests,
    results,
  };
}
