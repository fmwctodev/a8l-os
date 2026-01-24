import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createInvoice } from '../../services/invoices';
import { getProducts } from '../../services/products';
import { getContacts, createContact } from '../../services/contacts';
import { getOpportunities } from '../../services/opportunities';
import type { Contact, Product, Opportunity, CreateInvoiceLineItem, DiscountType } from '../../types';
import { X, Loader2, FileText, Plus, Trash2, Search, User as UserIcon, ArrowLeft } from 'lucide-react';

interface CreateInvoiceModalProps {
  onClose: () => void;
  onCreated: () => void;
  defaultContactId?: string;
  defaultOpportunityId?: string;
}

interface LineItem extends CreateInvoiceLineItem {
  id: string;
}

export function CreateInvoiceModal({
  onClose,
  onCreated,
  defaultContactId,
  defaultOpportunityId,
}: CreateInvoiceModalProps) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedContactId, setSelectedContactId] = useState(defaultContactId || '');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(defaultOpportunityId || '');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 },
  ]);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('flat');
  const [dueDate, setDueDate] = useState('');
  const [memo, setMemo] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [autoSend, setAutoSend] = useState(false);

  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  const [newContactData, setNewContactData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedContactId) {
      const contactOpps = opportunities.filter((o) => o.contact_id === selectedContactId);
      if (contactOpps.length > 0 && !selectedOpportunityId) {
        setSelectedOpportunityId(contactOpps[0].id);
      }
    }
  }, [selectedContactId, opportunities]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [contactData, productData, oppData] = await Promise.all([
        getContacts(user.org_id),
        getProducts({ active: true }),
        getOpportunities({ status: ['open'] }),
      ]);
      setContacts(contactData);
      setProducts(productData);
      setOpportunities(oppData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, updates: Partial<CreateInvoiceLineItem>) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const addProductToLineItems = (product: Product) => {
    setLineItems([
      ...lineItems.filter((item) => item.description || item.unit_price > 0),
      {
        id: crypto.randomUUID(),
        product_id: product.id,
        description: product.name,
        quantity: 1,
        unit_price: product.price_amount,
      },
    ]);
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const calculateDiscount = () => {
    const discount = parseFloat(discountAmount) || 0;
    if (discountType === 'percentage') {
      return (calculateSubtotal() * discount) / 100;
    }
    return discount;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const search = contactSearch.toLowerCase();
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    const company = (c.company || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    return name.includes(search) || company.includes(search) || email.includes(search);
  });

  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const contactOpportunities = opportunities.filter((o) => o.contact_id === selectedContactId);

  const selectContact = (contact: Contact) => {
    setSelectedContactId(contact.id);
    setContactSearch('');
    setShowContactDropdown(false);
    setShowNewContactForm(false);
  };

  const openNewContactForm = () => {
    setShowNewContactForm(true);
    setShowContactDropdown(false);
    setNewContactData({
      first_name: contactSearch,
      last_name: '',
      email: '',
      phone: '',
    });
  };

  const cancelNewContactForm = () => {
    setShowNewContactForm(false);
    setNewContactData({ first_name: '', last_name: '', email: '', phone: '' });
  };

  const handleCreateContact = async () => {
    if (!user || !newContactData.first_name.trim()) return;

    setCreatingContact(true);
    try {
      const newContact = await createContact(
        user.org_id,
        {
          department_id: user.department_id,
          owner_id: user.id,
          first_name: newContactData.first_name.trim(),
          last_name: newContactData.last_name.trim() || undefined,
          email: newContactData.email.trim() || null,
          phone: newContactData.phone.trim() || null,
        },
        user
      );
      setContacts([newContact, ...contacts]);
      selectContact(newContact);
    } catch (err) {
      console.error('Failed to create contact:', err);
    } finally {
      setCreatingContact(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedContactId || lineItems.every((item) => !item.description)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await createInvoice(
        {
          contact_id: selectedContactId,
          opportunity_id: selectedOpportunityId || undefined,
          line_items: lineItems
            .filter((item) => item.description)
            .map(({ id, ...item }) => item),
          discount_amount: parseFloat(discountAmount) || undefined,
          discount_type: discountAmount ? discountType : undefined,
          due_date: dueDate || undefined,
          memo: memo || undefined,
          internal_notes: internalNotes || undefined,
          auto_send: autoSend,
        },
        user
      );
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-slate-900 rounded-xl border border-slate-800 p-8">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-xl border border-slate-800 shadow-xl mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            New Invoice
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Contact *
              </label>
              {selectedContact ? (
                <div className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <div className="text-white text-sm">
                        {selectedContact.company || `${selectedContact.first_name} ${selectedContact.last_name}`}
                      </div>
                      {selectedContact.email && (
                        <div className="text-xs text-slate-400">{selectedContact.email}</div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContactId('');
                      setSelectedOpportunityId('');
                    }}
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                  >
                    Change
                  </button>
                </div>
              ) : showNewContactForm ? (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={cancelNewContactForm}
                      className="p-1 hover:bg-slate-700 rounded"
                    >
                      <ArrowLeft className="w-4 h-4 text-slate-400" />
                    </button>
                    <span className="text-sm font-medium text-white">New Contact</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">First Name *</label>
                      <input
                        type="text"
                        value={newContactData.first_name}
                        onChange={(e) => setNewContactData((prev) => ({ ...prev, first_name: e.target.value }))}
                        placeholder="First name"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={newContactData.last_name}
                        onChange={(e) => setNewContactData((prev) => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Last name"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={newContactData.email}
                      onChange={(e) => setNewContactData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newContactData.phone}
                      onChange={(e) => setNewContactData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={cancelNewContactForm}
                      className="flex-1 px-3 py-2 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateContact}
                      disabled={creatingContact || !newContactData.first_name.trim()}
                      className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                    >
                      {creatingContact ? 'Creating...' : 'Create & Select'}
                    </button>
                  </div>
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
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {showContactDropdown && (
                    <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto rounded-lg bg-slate-800 border border-slate-700 shadow-xl">
                      {filteredContacts.length === 0 && !contactSearch ? (
                        <div className="px-4 py-3 text-sm text-slate-400">Type to search contacts</div>
                      ) : filteredContacts.length === 0 ? (
                        <>
                          <div className="px-4 py-3 text-sm text-slate-400">No contacts found</div>
                          <button
                            type="button"
                            onClick={openNewContactForm}
                            className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 border-t border-slate-700 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-cyan-600/20 flex items-center justify-center">
                              <Plus className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div>
                              <div className="text-cyan-400 font-medium text-sm">Create new contact</div>
                              {contactSearch && (
                                <div className="text-xs text-slate-400">Add "{contactSearch}" as a new contact</div>
                              )}
                            </div>
                          </button>
                        </>
                      ) : (
                        <>
                          {filteredContacts.slice(0, 10).map((contact) => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => selectContact(contact)}
                              className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-3 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                <UserIcon className="w-4 h-4 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-white text-sm">
                                  {contact.company || `${contact.first_name} ${contact.last_name}`}
                                </p>
                                {contact.email && (
                                  <p className="text-slate-400 text-xs">{contact.email}</p>
                                )}
                              </div>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={openNewContactForm}
                            className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 border-t border-slate-700 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-cyan-600/20 flex items-center justify-center">
                              <Plus className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div>
                              <div className="text-cyan-400 font-medium text-sm">Create new contact</div>
                              {contactSearch && (
                                <div className="text-xs text-slate-400">Add "{contactSearch}" as a new contact</div>
                              )}
                            </div>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Link to Opportunity
              </label>
              <select
                value={selectedOpportunityId}
                onChange={(e) => setSelectedOpportunityId(e.target.value)}
                disabled={!selectedContactId || contactOpportunities.length === 0}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              >
                <option value="">None</option>
                {contactOpportunities.map((opp) => (
                  <option key={opp.id} value={opp.id}>
                    {formatCurrency(opp.value_amount)} - {opp.stage?.name || 'Unknown stage'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Line Items *</label>
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    const product = products.find((p) => p.id === e.target.value);
                    if (product) {
                      addProductToLineItems(product);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Add from products...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {formatCurrency(product.price_amount)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Custom
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {lineItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                    placeholder="Description"
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                    placeholder="Qty"
                    min="0"
                    step="1"
                    className="w-20 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      value={item.unit_price || ''}
                      onChange={(e) => updateLineItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <span className="w-24 text-right text-sm text-white">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    className="p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Discount
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {discountType === 'flat' ? '$' : '%'}
                  </span>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step={discountType === 'percentage' ? '1' : '0.01'}
                    className="w-full pl-7 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="flat">Flat</option>
                  <option value="percentage">%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <div className="text-right">
              <div className="flex justify-between gap-8 text-sm">
                <span className="text-slate-400">Subtotal:</span>
                <span className="text-white">{formatCurrency(calculateSubtotal())}</span>
              </div>
              {parseFloat(discountAmount) > 0 && (
                <div className="flex justify-between gap-8 text-sm mt-1">
                  <span className="text-slate-400">Discount:</span>
                  <span className="text-red-400">-{formatCurrency(calculateDiscount())}</span>
                </div>
              )}
              <div className="flex justify-between gap-8 text-lg font-semibold mt-2">
                <span className="text-slate-300">Total:</span>
                <span className="text-white">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Memo (customer-facing)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Notes shown on the invoice..."
              rows={2}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Internal Notes
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Notes for your team only..."
              rows={2}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoSend"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            <label htmlFor="autoSend" className="text-sm text-slate-300">
              Send immediately after creating
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedContactId || lineItems.every((item) => !item.description)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Invoice'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}