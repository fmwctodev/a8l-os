import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createRecurringProfile, type CreateRecurringProfileInput } from '../../services/recurringProfiles';
import { getContacts } from '../../services/contacts';
import { getProducts } from '../../services/products';
import type { Contact, Product } from '../../types';
import {
  X,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  User,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  preselectedContactId?: string;
}

interface LineItem {
  id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export function CreateRecurringProfileModal({ onClose, onCreated, preselectedContactId }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [contactId, setContactId] = useState(preselectedContactId || '');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'annually'>('monthly');
  const [nextInvoiceDate, setNextInvoiceDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState('');
  const [autoSend, setAutoSend] = useState(true);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 },
  ]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoadingData(true);
      const [contactsData, productsData] = await Promise.all([
        getContacts(),
        getProducts({ activeOnly: true }),
      ]);
      setContacts(contactsData);
      setProducts(productsData.filter(p => p.billing_type === 'recurring' || p.active));
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const selectedContact = contacts.find(c => c.id === contactId);

  const filteredContacts = contacts.filter(c => {
    if (!contactSearch) return true;
    const search = contactSearch.toLowerCase();
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    const company = (c.company || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    return name.includes(search) || company.includes(search) || email.includes(search);
  });

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const handleLineItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => {
      if (item.id !== id) return item;
      return { ...item, [field]: value };
    }));
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setLineItems(lineItems.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        product_id: productId,
        description: product.name,
        unit_price: product.price_amount,
      };
    }));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      setError('Please enter a profile name');
      return;
    }

    if (!contactId) {
      setError('Please select a contact');
      return;
    }

    if (!nextInvoiceDate) {
      setError('Please select a next invoice date');
      return;
    }

    const validLineItems = lineItems.filter(item => item.description.trim() && item.quantity > 0);
    if (validLineItems.length === 0) {
      setError('Please add at least one line item');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const input: CreateRecurringProfileInput = {
        contact_id: contactId,
        name: name.trim(),
        frequency,
        next_invoice_date: nextInvoiceDate,
        end_date: endDate || undefined,
        auto_send: autoSend,
        line_items: validLineItems.map(item => ({
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      await createRecurringProfile(input, user);
      onCreated();
    } catch (err) {
      console.error('Failed to create recurring profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoadingData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Create Recurring Profile</h2>
              <p className="text-slate-400 text-sm">Set up automatic invoice generation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Profile Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Monthly Retainer"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Frequency *
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Contact *
            </label>
            <div className="relative">
              {selectedContact ? (
                <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-slate-800 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {selectedContact.company || `${selectedContact.first_name} ${selectedContact.last_name}`}
                      </p>
                      {selectedContact.email && (
                        <p className="text-slate-400 text-xs">{selectedContact.email}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContactId('')}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                  {showContactDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                      {filteredContacts.length === 0 ? (
                        <div className="p-4 text-center text-slate-400">No contacts found</div>
                      ) : (
                        filteredContacts.slice(0, 10).map(contact => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => {
                              setContactId(contact.id);
                              setContactSearch('');
                              setShowContactDropdown(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-700"
                          >
                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                              <User className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div>
                              <p className="text-white">
                                {contact.company || `${contact.first_name} ${contact.last_name}`}
                              </p>
                              {contact.email && (
                                <p className="text-slate-400 text-xs">{contact.email}</p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                First Invoice Date *
              </label>
              <input
                type="date"
                value={nextInvoiceDate}
                onChange={(e) => setNextInvoiceDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={nextInvoiceDate}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSend}
                onChange={(e) => setAutoSend(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
              />
              <span className="text-slate-300">Automatically send invoices when generated</span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-300">Line Items</label>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={item.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <select
                      value={item.product_id || ''}
                      onChange={(e) => handleProductSelect(item.id, e.target.value)}
                      className="w-full mb-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">Select product (optional)</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {formatCurrency(product.price_amount)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0.01"
                      step="0.01"
                      placeholder="Qty"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 mt-9"
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleLineItemChange(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 mt-9"
                    />
                  </div>
                  <div className="w-24 text-right mt-9">
                    <p className="text-white font-medium py-2">{formatCurrency(item.quantity * item.unit_price)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    className="p-2 text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed mt-9"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-slate-800">
              <div className="text-right">
                <p className="text-slate-400 text-sm">Total per {frequency.replace('ly', '')}</p>
                <p className="text-2xl font-semibold text-white">{formatCurrency(subtotal)}</p>
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Create Profile
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
