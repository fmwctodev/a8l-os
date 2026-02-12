import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface EmailRecipient {
  email: string;
  name: string;
  contactId?: string;
}

interface ContactEmailAutocompleteProps {
  label: string;
  recipients: EmailRecipient[];
  onChange: (recipients: EmailRecipient[]) => void;
}

interface ContactResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function ContactEmailAutocomplete({
  label,
  recipients,
  onChange,
}: ContactEmailAutocompleteProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchContacts = useCallback(async (searchQuery: string) => {
    if (!user?.organization_id || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const term = `%${searchQuery}%`;
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .eq('organization_id', user.organization_id)
        .eq('status', 'active')
        .not('email', 'is', null)
        .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
        .limit(10);

      const existingEmails = new Set(recipients.map((r) => r.email.toLowerCase()));
      setResults(
        (data || []).filter((c: ContactResult) => !existingEmails.has(c.email.toLowerCase()))
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [user?.organization_id, recipients]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchContacts(value);
    }, 300);
  };

  const addRecipient = (contact: ContactResult) => {
    onChange([
      ...recipients,
      {
        email: contact.email,
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        contactId: contact.id,
      },
    ]);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const addManualEmail = () => {
    const trimmed = query.trim();
    if (trimmed && trimmed.includes('@')) {
      const exists = recipients.some((r) => r.email.toLowerCase() === trimmed.toLowerCase());
      if (!exists) {
        onChange([...recipients, { email: trimmed, name: trimmed }]);
      }
      setQuery('');
      setShowDropdown(false);
    }
  };

  const removeRecipient = (index: number) => {
    onChange(recipients.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        addRecipient(results[0]);
      } else {
        addManualEmail();
      }
    }
    if (e.key === 'Backspace' && !query && recipients.length > 0) {
      removeRecipient(recipients.length - 1);
    }
  };

  return (
    <div className="flex items-start gap-2 px-4 py-1.5" ref={containerRef}>
      <span className="text-sm text-gray-500 mt-1 shrink-0">{label}:</span>
      <div className="flex-1 flex flex-wrap items-center gap-1 min-w-0 relative">
        {recipients.map((r, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
          >
            {r.name || r.email}
            <button onClick={() => removeRecipient(i)} className="text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            placeholder={recipients.length === 0 ? 'Search contacts or type email...' : ''}
            className="w-full text-sm bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 py-0.5"
          />
          {showDropdown && (results.length > 0 || searching) && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-48 overflow-y-auto">
              {searching ? (
                <div className="px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
                  <Search size={14} className="animate-pulse" />
                  Searching...
                </div>
              ) : (
                results.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => addRecipient(contact)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 text-sm"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
                      {contact.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-gray-800 truncate">
                        {contact.first_name} {contact.last_name}
                      </div>
                      <div className="text-gray-400 text-xs truncate">{contact.email}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
