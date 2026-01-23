import { useState, useEffect } from 'react';
import { X, Search, Plus, User as UserIcon } from 'lucide-react';
import type {
  Opportunity,
  Pipeline,
  PipelineStage,
  Contact,
  User,
  PipelineCustomField
} from '../../types';
import { getContacts } from '../../services/contacts';
import { getUsers } from '../../services/users';
import * as pipelinesService from '../../services/pipelines';
import * as opportunitiesService from '../../services/opportunities';

interface OpportunityModalProps {
  opportunity?: Opportunity | null;
  pipeline?: Pipeline | null;
  preselectedStageId?: string | null;
  preselectedContact?: Contact | null;
  orgId: string;
  currentUser: User;
  onClose: () => void;
  onSave: (opportunity: Opportunity) => void;
}

export function OpportunityModal({
  opportunity,
  pipeline: initialPipeline,
  preselectedStageId,
  preselectedContact,
  orgId,
  currentUser,
  onClose,
  onSave
}: OpportunityModalProps) {
  const isEditing = !!opportunity;

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(initialPipeline || null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [customFields, setCustomFields] = useState<PipelineCustomField[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    contact_id: opportunity?.contact_id || preselectedContact?.id || '',
    contact: opportunity?.contact || preselectedContact || null as Contact | null,
    pipeline_id: opportunity?.pipeline_id || initialPipeline?.id || '',
    stage_id: opportunity?.stage_id || preselectedStageId || '',
    assigned_user_id: opportunity?.assigned_user_id || '',
    value_amount: opportunity?.value_amount?.toString() || '0',
    currency: opportunity?.currency || 'USD',
    source: opportunity?.source || '',
    close_date: opportunity?.close_date || ''
  });

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPipeline) {
      loadPipelineDetails(selectedPipeline.id);
    }
  }, [selectedPipeline?.id]);

  useEffect(() => {
    if (contactSearch.length >= 2) {
      searchContacts();
    } else {
      setContacts([]);
    }
  }, [contactSearch]);

  async function loadData() {
    try {
      const [pipelinesData, usersData] = await Promise.all([
        pipelinesService.getPipelines(),
        getUsers()
      ]);
      setPipelines(pipelinesData);
      setUsers(usersData);

      if (!selectedPipeline && pipelinesData.length > 0) {
        const defaultPipeline = pipelinesData[0];
        setSelectedPipeline(defaultPipeline);
        setFormData(prev => ({
          ...prev,
          pipeline_id: defaultPipeline.id
        }));
      }

      if (opportunity) {
        const existingValues = await opportunitiesService.getCustomFieldValues(opportunity.id);
        const valuesMap: Record<string, unknown> = {};
        existingValues.forEach(v => {
          const field = v.custom_field;
          if (field) {
            if (v.value_text !== null) valuesMap[field.field_key] = v.value_text;
            else if (v.value_number !== null) valuesMap[field.field_key] = v.value_number;
            else if (v.value_date !== null) valuesMap[field.field_key] = v.value_date;
            else if (v.value_boolean !== null) valuesMap[field.field_key] = v.value_boolean;
            else if (v.value_json !== null) valuesMap[field.field_key] = v.value_json;
          }
        });
        setCustomFieldValues(valuesMap);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPipelineDetails(pipelineId: string) {
    try {
      const [stagesData, fieldsData] = await Promise.all([
        pipelinesService.getStagesByPipeline(pipelineId),
        pipelinesService.getCustomFields(pipelineId)
      ]);
      setStages(stagesData);
      setCustomFields(fieldsData);

      if (!formData.stage_id && stagesData.length > 0) {
        setFormData(prev => ({
          ...prev,
          stage_id: preselectedStageId || stagesData[0].id
        }));
      }
    } catch (error) {
      console.error('Failed to load pipeline details:', error);
    }
  }

  async function searchContacts() {
    try {
      const result = await getContacts({ search: contactSearch }, 1, 10);
      setContacts(result.data);
    } catch (error) {
      console.error('Failed to search contacts:', error);
    }
  }

  function handlePipelineChange(pipelineId: string) {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    if (pipeline) {
      setSelectedPipeline(pipeline);
      setFormData(prev => ({
        ...prev,
        pipeline_id: pipelineId,
        stage_id: ''
      }));
      setCustomFieldValues({});
    }
  }

  function selectContact(contact: Contact) {
    setFormData(prev => ({
      ...prev,
      contact_id: contact.id,
      contact
    }));
    setContactSearch('');
    setShowContactDropdown(false);
  }

  function handleCustomFieldChange(fieldKey: string, value: unknown) {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.contact_id || !formData.pipeline_id || !formData.stage_id) return;

    setSaving(true);
    try {
      let result: Opportunity;

      if (isEditing && opportunity) {
        result = await opportunitiesService.updateOpportunity(
          opportunity.id,
          {
            stage_id: formData.stage_id,
            assigned_user_id: formData.assigned_user_id || null,
            value_amount: parseFloat(formData.value_amount) || 0,
            currency: formData.currency,
            source: formData.source || null,
            close_date: formData.close_date || null
          },
          currentUser.id,
          customFieldValues
        );
      } else {
        result = await opportunitiesService.createOpportunity(
          {
            org_id: orgId,
            contact_id: formData.contact_id,
            pipeline_id: formData.pipeline_id,
            stage_id: formData.stage_id,
            assigned_user_id: formData.assigned_user_id || null,
            department_id: currentUser.department_id,
            value_amount: parseFloat(formData.value_amount) || 0,
            currency: formData.currency,
            source: formData.source || null,
            close_date: formData.close_date || null,
            created_by: currentUser.id
          },
          customFieldValues
        );
      }

      onSave(result);
    } catch (error) {
      console.error('Failed to save opportunity:', error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Opportunity' : 'New Opportunity'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Contact *</label>
            {formData.contact ? (
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <div className="text-white">
                      {formData.contact.first_name} {formData.contact.last_name}
                    </div>
                    <div className="text-sm text-slate-400">
                      {formData.contact.email || formData.contact.phone}
                    </div>
                  </div>
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, contact_id: '', contact: null }))}
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactDropdown(true);
                  }}
                  onFocus={() => setShowContactDropdown(true)}
                  placeholder="Search contacts..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
                {showContactDropdown && contacts.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {contacts.map(contact => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => selectContact(contact)}
                        className="w-full px-4 py-2 text-left hover:bg-slate-600 flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-slate-300" />
                        </div>
                        <div>
                          <div className="text-white">{contact.first_name} {contact.last_name}</div>
                          <div className="text-sm text-slate-400">{contact.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Pipeline *</label>
              <select
                value={formData.pipeline_id}
                onChange={(e) => handlePipelineChange(e.target.value)}
                disabled={isEditing}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white disabled:opacity-50"
              >
                <option value="">Select pipeline</option>
                {pipelines.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Stage *</label>
              <select
                value={formData.stage_id}
                onChange={(e) => setFormData(prev => ({ ...prev, stage_id: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              >
                <option value="">Select stage</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Value</label>
              <div className="flex">
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  className="px-3 py-2 bg-slate-700 border border-slate-600 border-r-0 rounded-l text-white"
                >
                  <option value="USD">$</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <input
                  type="number"
                  value={formData.value_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, value_amount: e.target.value }))}
                  min="0"
                  step="0.01"
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-r text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Assigned To</label>
              <select
                value={formData.assigned_user_id}
                onChange={(e) => setFormData(prev => ({ ...prev, assigned_user_id: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Source</label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                placeholder="e.g., Website, Referral"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Expected Close Date</label>
              <input
                type="date"
                value={formData.close_date}
                onChange={(e) => setFormData(prev => ({ ...prev, close_date: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              />
            </div>
          </div>

          {customFields.length > 0 && (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Custom Fields</h3>
              <div className="space-y-3">
                {customFields.map(field => (
                  <div key={field.id}>
                    <label className="block text-sm text-slate-400 mb-1">
                      {field.label} {field.required && '*'}
                    </label>
                    {field.field_type === 'text' && (
                      <input
                        type="text"
                        value={(customFieldValues[field.field_key] as string) || ''}
                        onChange={(e) => handleCustomFieldChange(field.field_key, e.target.value)}
                        required={field.required}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    )}
                    {field.field_type === 'number' && (
                      <input
                        type="number"
                        value={(customFieldValues[field.field_key] as number) || ''}
                        onChange={(e) => handleCustomFieldChange(field.field_key, parseFloat(e.target.value))}
                        required={field.required}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    )}
                    {field.field_type === 'date' && (
                      <input
                        type="date"
                        value={(customFieldValues[field.field_key] as string) || ''}
                        onChange={(e) => handleCustomFieldChange(field.field_key, e.target.value)}
                        required={field.required}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    )}
                    {field.field_type === 'dropdown' && (
                      <select
                        value={(customFieldValues[field.field_key] as string) || ''}
                        onChange={(e) => handleCustomFieldChange(field.field_key, e.target.value)}
                        required={field.required}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      >
                        <option value="">Select...</option>
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    {field.field_type === 'boolean' && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!customFieldValues[field.field_key]}
                          onChange={(e) => handleCustomFieldChange(field.field_key, e.target.checked)}
                          className="rounded bg-slate-700 border-slate-600"
                        />
                        <span className="text-slate-300">Yes</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.contact_id || !formData.pipeline_id || !formData.stage_id}
              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
