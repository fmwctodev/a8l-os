import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Target,
  MessageSquare,
  FileText,
  Plus,
  Workflow,
  Bot,
  Calendar,
  CreditCard,
  Settings,
  BarChart3,
  Star,
  Megaphone,
  FolderOpen,
  Users,
  Home,
  Command,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SearchResult {
  id: string;
  type: 'contact' | 'opportunity' | 'conversation' | 'invoice' | 'navigation' | 'action';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigationItems: SearchResult[] = [
  { id: 'nav-dashboard', type: 'navigation', title: 'Dashboard', icon: <Home className="w-4 h-4" />, path: '/' },
  { id: 'nav-conversations', type: 'navigation', title: 'Conversations', icon: <MessageSquare className="w-4 h-4" />, path: '/conversations' },
  { id: 'nav-calendars', type: 'navigation', title: 'Calendars', icon: <Calendar className="w-4 h-4" />, path: '/calendars' },
  { id: 'nav-contacts', type: 'navigation', title: 'Contacts', icon: <Users className="w-4 h-4" />, path: '/contacts' },
  { id: 'nav-opportunities', type: 'navigation', title: 'Opportunities', icon: <Target className="w-4 h-4" />, path: '/opportunities' },
  { id: 'nav-payments', type: 'navigation', title: 'Payments', icon: <CreditCard className="w-4 h-4" />, path: '/payments' },
  { id: 'nav-marketing', type: 'navigation', title: 'Marketing', icon: <Megaphone className="w-4 h-4" />, path: '/marketing' },
  { id: 'nav-reputation', type: 'navigation', title: 'Reputation', icon: <Star className="w-4 h-4" />, path: '/reputation' },
  { id: 'nav-automation', type: 'navigation', title: 'Automation', icon: <Workflow className="w-4 h-4" />, path: '/automation' },
  { id: 'nav-ai-agents', type: 'navigation', title: 'AI Agents', icon: <Bot className="w-4 h-4" />, path: '/ai-agents' },
  { id: 'nav-file-manager', type: 'navigation', title: 'File Manager', icon: <FolderOpen className="w-4 h-4" />, path: '/media' },
  { id: 'nav-reporting', type: 'navigation', title: 'Reporting', icon: <BarChart3 className="w-4 h-4" />, path: '/reporting' },
  { id: 'nav-settings', type: 'navigation', title: 'Settings', icon: <Settings className="w-4 h-4" />, path: '/settings' },
];

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const quickActions: SearchResult[] = [
    {
      id: 'action-new-contact',
      type: 'action',
      title: 'Create Contact',
      subtitle: 'Add a new contact',
      icon: <Plus className="w-4 h-4" />,
      path: '/contacts',
      action: () => {
        navigate('/contacts');
      },
    },
    {
      id: 'action-new-opportunity',
      type: 'action',
      title: 'Create Opportunity',
      subtitle: 'Add a new opportunity',
      icon: <Plus className="w-4 h-4" />,
      path: '/opportunities',
      action: () => {
        navigate('/opportunities');
      },
    },
    {
      id: 'action-new-automation',
      type: 'action',
      title: 'New Automation',
      subtitle: 'Create a workflow',
      icon: <Workflow className="w-4 h-4" />,
      path: '/automation',
      action: () => {
        navigate('/automation');
      },
    },
    {
      id: 'action-new-report',
      type: 'action',
      title: 'Create Report',
      subtitle: 'Build a new report',
      icon: <BarChart3 className="w-4 h-4" />,
      path: '/reporting/new',
      action: () => {
        navigate('/reporting/new');
      },
    },
  ];

  const searchDatabase = useCallback(async (searchQuery: string) => {
    if (!user?.organization_id || searchQuery.length < 2) return [];

    setIsSearching(true);
    const results: SearchResult[] = [];

    try {
      if (hasPermission('contacts.view')) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone')
          .eq('organization_id', user.organization_id)
          .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(5);

        if (contacts) {
          contacts.forEach((contact) => {
            results.push({
              id: `contact-${contact.id}`,
              type: 'contact',
              title: `${contact.first_name} ${contact.last_name}`.trim() || 'Unknown',
              subtitle: contact.email || contact.phone || undefined,
              icon: <User className="w-4 h-4" />,
              path: `/contacts/${contact.id}`,
            });
          });
        }
      }

      if (hasPermission('opportunities.view')) {
        const { data: opportunities } = await supabase
          .from('opportunities')
          .select('id, name, value')
          .eq('organization_id', user.organization_id)
          .ilike('name', `%${searchQuery}%`)
          .limit(5);

        if (opportunities) {
          opportunities.forEach((opp) => {
            results.push({
              id: `opportunity-${opp.id}`,
              type: 'opportunity',
              title: opp.name,
              subtitle: opp.value ? `$${opp.value.toLocaleString()}` : undefined,
              icon: <Target className="w-4 h-4" />,
              path: `/opportunities/${opp.id}`,
            });
          });
        }
      }

      if (hasPermission('payments.view')) {
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, invoice_number, total')
          .eq('organization_id', user.organization_id)
          .ilike('invoice_number', `%${searchQuery}%`)
          .limit(5);

        if (invoices) {
          invoices.forEach((invoice) => {
            results.push({
              id: `invoice-${invoice.id}`,
              type: 'invoice',
              title: `Invoice ${invoice.invoice_number}`,
              subtitle: invoice.total ? `$${invoice.total.toLocaleString()}` : undefined,
              icon: <FileText className="w-4 h-4" />,
              path: `/payments/invoices/${invoice.id}`,
            });
          });
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }

    return results;
  }, [user?.organization_id, hasPermission]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (query.trim()) {
        const filteredNav = navigationItems.filter((item) =>
          item.title.toLowerCase().includes(query.toLowerCase())
        );
        const filteredActions = quickActions.filter((item) =>
          item.title.toLowerCase().includes(query.toLowerCase())
        );
        const dbResults = await searchDatabase(query);
        setResults([...dbResults, ...filteredNav, ...filteredActions]);
      } else {
        setResults([...recentSearches.slice(0, 3), ...quickActions, ...navigationItems.slice(0, 6)]);
      }
      setSelectedIndex(0);
    }, 150);

    return () => clearTimeout(searchTimer);
  }, [query, searchDatabase, recentSearches, quickActions]);

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.action) {
      result.action();
    } else if (result.path) {
      navigate(result.path);
    }

    if (result.type !== 'navigation' && result.type !== 'action') {
      setRecentSearches((prev) => {
        const filtered = prev.filter((r) => r.id !== result.id);
        return [result, ...filtered].slice(0, 5);
      });
    }

    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
    }
  }, [results, selectedIndex, handleSelect]);

  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const groupedResults = results.reduce((acc, result) => {
    const group = result.type === 'navigation' ? 'Navigation' :
                  result.type === 'action' ? 'Quick Actions' :
                  result.type === 'contact' ? 'Contacts' :
                  result.type === 'opportunity' ? 'Opportunities' :
                  result.type === 'invoice' ? 'Invoices' :
                  result.type === 'conversation' ? 'Conversations' : 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
        <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or jump to..."
              className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
            />
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">
                <Command className="w-3 h-3 inline" />K
              </kbd>
            </div>
          </div>

          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {isSearching && (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Searching...
              </div>
            )}

            {!isSearching && results.length === 0 && query && (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                No results found for "{query}"
              </div>
            )}

            {!isSearching && Object.entries(groupedResults).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-800/50">
                  {group}
                </div>
                {items.map((result) => {
                  const index = results.indexOf(result);
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className={`flex-shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}>
                        {result.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-xs text-slate-500 truncate">{result.subtitle}</div>
                        )}
                      </div>
                      {isSelected && (
                        <span className="text-xs text-slate-500">Enter to select</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-slate-700 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
