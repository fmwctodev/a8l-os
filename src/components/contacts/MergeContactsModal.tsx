import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getContactById, mergeContacts, type UpdateContactData } from '../../services/contacts';
import type { Contact } from '../../types';
import { X, Loader2, GitMerge, ArrowRight, Check } from 'lucide-react';

interface MergeContactsModalProps {
  contactIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

type MergeField = keyof Pick<
  Contact,
  'first_name' | 'last_name' | 'email' | 'phone' | 'company' | 'job_title' | 'address_line1' | 'city' | 'state' | 'postal_code' | 'country'
>;

const MERGE_FIELDS: { key: MergeField; label: string }[] = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'job_title', label: 'Job Title' },
  { key: 'address_line1', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postal_code', label: 'Postal Code' },
  { key: 'country', label: 'Country' },
];

export function MergeContactsModal({
  contactIds,
  onClose,
  onSuccess,
}: MergeContactsModalProps) {
  const { user: currentUser } = useAuth();
  const [contacts, setContacts] = useState<[Contact | null, Contact | null]>([null, null]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [selectedValues, setSelectedValues] = useState<Record<MergeField, 0 | 1>>({} as Record<MergeField, 0 | 1>);
  const [isLoading, setIsLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const [contact1, contact2] = await Promise.all([
          getContactById(contactIds[0]),
          getContactById(contactIds[1]),
        ]);
        setContacts([contact1, contact2]);

        const initialValues: Record<MergeField, 0 | 1> = {} as Record<MergeField, 0 | 1>;
        MERGE_FIELDS.forEach(({ key }) => {
          const val1 = contact1?.[key];
          const val2 = contact2?.[key];
          if (val1 && !val2) {
            initialValues[key] = 0;
          } else if (!val1 && val2) {
            initialValues[key] = 1;
          } else {
            initialValues[key] = 0;
          }
        });
        setSelectedValues(initialValues);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contacts');
      } finally {
        setIsLoading(false);
      }
    };

    loadContacts();
  }, [contactIds]);

  const handleMerge = async () => {
    if (!currentUser || !contacts[0] || !contacts[1]) return;

    const primaryContact = contacts[primaryIndex];
    const secondaryContact = contacts[primaryIndex === 0 ? 1 : 0];

    if (!primaryContact || !secondaryContact) return;

    const mergeData: UpdateContactData = {};

    MERGE_FIELDS.forEach(({ key }) => {
      const sourceIndex = selectedValues[key];
      const actualSourceIndex = primaryIndex === 0 ? sourceIndex : (sourceIndex === 0 ? 1 : 0);
      const sourceContact = contacts[actualSourceIndex];
      if (sourceContact) {
        (mergeData as Record<string, unknown>)[key] = sourceContact[key];
      }
    });

    try {
      setIsMerging(true);
      setError(null);

      await mergeContacts(primaryContact.id, secondaryContact.id, mergeData, currentUser);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge contacts');
    } finally {
      setIsMerging(false);
    }
  };

  const getDisplayName = (contact: Contact | null) => {
    if (!contact) return 'Loading...';
    return `${contact.first_name} ${contact.last_name}`.trim();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative w-full max-w-3xl bg-slate-900 rounded-xl border border-slate-800 shadow-xl p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Merge Contacts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-4">
              Select which contact will remain as the primary record. The other contact will be
              archived and linked to the primary.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {contacts.map((contact, index) => (
                <button
                  key={index}
                  onClick={() => setPrimaryIndex(index)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    primaryIndex === index
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400 uppercase">
                      Contact {index + 1}
                    </span>
                    {primaryIndex === index && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500 text-white">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-white font-medium">{getDisplayName(contact)}</p>
                  {contact?.email && <p className="text-sm text-slate-400">{contact.email}</p>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Select values to keep for each field
            </h3>
            <div className="space-y-2">
              {MERGE_FIELDS.map(({ key, label }) => {
                const val1 = contacts[0]?.[key] || '';
                const val2 = contacts[1]?.[key] || '';

                if (!val1 && !val2) return null;

                return (
                  <div
                    key={key}
                    className="grid grid-cols-[120px_1fr_40px_1fr] items-center gap-2 p-2 rounded-lg bg-slate-800/50"
                  >
                    <span className="text-sm text-slate-400">{label}</span>
                    <button
                      onClick={() => setSelectedValues((prev) => ({ ...prev, [key]: 0 }))}
                      className={`px-3 py-2 rounded text-sm text-left transition-colors ${
                        selectedValues[key] === 0
                          ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{val1 || '(empty)'}</span>
                        {selectedValues[key] === 0 && <Check className="w-4 h-4 flex-shrink-0 ml-2" />}
                      </div>
                    </button>
                    <div className="flex justify-center">
                      <ArrowRight className="w-4 h-4 text-slate-600" />
                    </div>
                    <button
                      onClick={() => setSelectedValues((prev) => ({ ...prev, [key]: 1 }))}
                      className={`px-3 py-2 rounded text-sm text-left transition-colors ${
                        selectedValues[key] === 1
                          ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{val2 || '(empty)'}</span>
                        {selectedValues[key] === 1 && <Check className="w-4 h-4 flex-shrink-0 ml-2" />}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <p className="text-sm text-amber-300">
              <strong>Note:</strong> Tags from both contacts will be combined. The secondary
              contact will be archived and will no longer appear in the contact list.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={isMerging}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium hover:from-cyan-600 hover:to-teal-700 transition-colors disabled:opacity-50"
          >
            {isMerging && <Loader2 className="w-4 h-4 animate-spin" />}
            <GitMerge className="w-4 h-4" />
            Merge Contacts
          </button>
        </div>
      </div>
    </div>
  );
}
