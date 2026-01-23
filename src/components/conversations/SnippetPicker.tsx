import { useState, useEffect, useMemo } from 'react';
import { Search, Phone, Mail, X, FileText, Users, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAvailableSnippets, resolveSnippetVariables } from '../../services/snippets';
import type { Snippet, SnippetScope, MessageChannel, Contact } from '../../types';

interface SnippetPickerProps {
  channel: MessageChannel;
  contact?: Contact | null;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function SnippetPicker({ channel, contact, onSelect, onClose }: SnippetPickerProps) {
  const { user } = useAuth();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<SnippetScope>('personal');

  useEffect(() => {
    async function loadSnippets() {
      if (!user) return;
      try {
        setLoading(true);
        const data = await getAvailableSnippets(
          user.organization_id,
          user.id,
          user.department_id,
          channel
        );
        setSnippets(data);
      } catch (error) {
        console.error('Failed to load snippets:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSnippets();
  }, [user, channel]);

  const filteredSnippets = useMemo(() => {
    let filtered = snippets.filter((s) => s.scope === activeTab);

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.content.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [snippets, activeTab, search]);

  const handleSelect = (snippet: Snippet) => {
    const resolved = resolveSnippetVariables(snippet.content, {
      contact,
      customFields: contact?.custom_field_values?.reduce((acc, cfv) => {
        if (cfv.custom_field?.field_key) {
          acc[cfv.custom_field.field_key] = cfv.value;
        }
        return acc;
      }, {} as Record<string, unknown>),
    });
    onSelect(resolved);
    onClose();
  };

  const tabs: { value: SnippetScope; label: string; icon: typeof FileText }[] = [
    { value: 'personal', label: 'My Snippets', icon: FileText },
    { value: 'team', label: 'Team', icon: Users },
    { value: 'system', label: 'System', icon: Building2 },
  ];

  const tabCounts = useMemo(() => {
    return {
      personal: snippets.filter((s) => s.scope === 'personal').length,
      team: snippets.filter((s) => s.scope === 'team').length,
      system: snippets.filter((s) => s.scope === 'system').length,
    };
  }, [snippets]);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-[400px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <h3 className="text-sm font-medium text-white">Snippets</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
        >
          <X size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="p-3 border-b border-slate-700">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search snippets..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            autoFocus
          />
        </div>
      </div>

      <div className="flex border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tabCounts[tab.value] > 0 && (
              <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                {tabCounts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="p-8 text-center">
            <FileText size={32} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">
              {search ? 'No snippets match your search' : `No ${activeTab} snippets available`}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {filteredSnippets.map((snippet) => (
              <button
                key={snippet.id}
                onClick={() => handleSelect(snippet)}
                className="w-full text-left p-3 rounded-lg hover:bg-slate-700 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                      {snippet.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {snippet.content}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {snippet.channel_support.includes('sms') && (
                      <Phone size={12} className="text-slate-500" />
                    )}
                    {snippet.channel_support.includes('email') && (
                      <Mail size={12} className="text-slate-500" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-700 text-center">
        <span className="text-xs text-slate-500">
          Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-400">Esc</kbd> to close
        </span>
      </div>
    </div>
  );
}
