import { Plus, X } from 'lucide-react';
import type { Contact, CustomField, ContactCustomFieldValue, Tag } from '../../types';
import { formatFieldValue } from '../../services/customFields';

interface ContactOverviewTabProps {
  contact: Contact;
  customFields: CustomField[];
  customFieldValues: ContactCustomFieldValue[];
  availableTags?: Tag[];
  canEdit?: boolean;
  onAddTag?: (tagId: string) => void;
  onRemoveTag?: (tagId: string) => void;
}

export function ContactOverviewTab({
  contact,
  customFields,
  customFieldValues,
  availableTags = [],
  canEdit = false,
  onAddTag,
  onRemoveTag,
}: ContactOverviewTabProps) {
  const getFieldValue = (fieldId: string): unknown => {
    const value = customFieldValues.find((v) => v.custom_field_id === fieldId);
    return value?.value;
  };

  const fieldsWithValues = customFields.filter((field) => {
    const value = getFieldValue(field.id);
    return value !== null && value !== undefined && value !== '';
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoField label="Full Name" value={`${contact.first_name} ${contact.last_name}`.trim()} />
          <InfoField label="Email" value={contact.email} />
          <InfoField label="Phone" value={contact.phone} />
          <InfoField label="Company" value={contact.company} />
          <InfoField label="Job Title" value={contact.job_title} />
          <InfoField label="Source" value={contact.source} />
        </div>
      </div>

      {(contact.address_line1 || contact.city || contact.state || contact.country) && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Address
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField label="Address Line 1" value={contact.address_line1} />
            <InfoField label="Address Line 2" value={contact.address_line2} />
            <InfoField label="City" value={contact.city} />
            <InfoField label="State" value={contact.state} />
            <InfoField label="Postal Code" value={contact.postal_code} />
            <InfoField label="Country" value={contact.country} />
          </div>
        </div>
      )}

      {fieldsWithValues.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Custom Fields
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fieldsWithValues.map((field) => (
              <InfoField
                key={field.id}
                label={field.name}
                value={formatFieldValue(field, getFieldValue(field.id))}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Metadata
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoField
            label="Created"
            value={new Date(contact.created_at).toLocaleString()}
          />
          <InfoField
            label="Last Updated"
            value={new Date(contact.updated_at).toLocaleString()}
          />
          <InfoField label="Department" value={contact.department?.name} />
          <InfoField label="Owner" value={contact.owner?.name || 'Unassigned'} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Tags
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {contact.tags?.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium group"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
              }}
            >
              {tag.name}
              {canEdit && onRemoveTag && (
                <button
                  onClick={() => onRemoveTag(tag.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {(!contact.tags || contact.tags.length === 0) && (
            <span className="text-sm text-slate-500">No tags</span>
          )}
        </div>
        {canEdit && onAddTag && availableTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => onAddTag(tag.id)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium opacity-50 hover:opacity-100 transition-opacity"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                <Plus className="w-3 h-3" />
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-slate-200">{value || '-'}</dd>
    </div>
  );
}
