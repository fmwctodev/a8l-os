import { useState, useEffect } from 'react';
import { Search, Plus, Trash2 } from 'lucide-react';
import { Drawer } from '../layouts/Drawer';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../services/activityLog';

interface CreateInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface LineItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export function CreateInvoiceDrawer({ open, onClose, onSuccess }: CreateInvoiceDrawerProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [memo, setMemo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user?.organization_id) {
      fetchProducts();
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      setDueDate(defaultDue.toISOString().split('T')[0]);
    }
  }, [open, user?.organization_id]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setContacts([]);
      setSelectedContact(null);
      setLineItems([]);
      setMemo('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 && user?.organization_id) {
        searchContacts();
      } else {
        setContacts([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.organization_id]);

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, price')
      .eq('organization_id', user?.organization_id)
      .eq('is_active', true)
      .order('name');

    setProducts(data || []);
  }

  async function searchContacts() {
    setSearching(true);
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('organization_id', user?.organization_id)
      .eq('status', 'active')
      .or(
        `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      )
      .limit(10);

    setContacts(data || []);
    setSearching(false);
  }

  function addLineItem() {
    if (products.length === 0) return;
    const firstProduct = products[0];
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        product_id: firstProduct.id,
        product_name: firstProduct.name,
        quantity: 1,
        unit_price: firstProduct.price,
      },
    ]);
  }

  function updateLineItem(id: string, updates: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleProductChange(itemId: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateLineItem(itemId, {
        product_id: productId,
        product_name: product.name,
        unit_price: product.price,
      });
    }
  }

  const total = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  async function handleSubmit() {
    if (!user || !user.organization_id || !selectedContact || lineItems.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          organization_id: user.organization_id,
          contact_id: selectedContact.id,
          invoice_number: invoiceNumber,
          status: 'draft',
          subtotal: total,
          tax_amount: 0,
          total_amount: total,
          due_date: dueDate,
          memo,
          created_by_id: user.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const lineItemsData = lineItems.map((item) => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        description: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsData);

      if (itemsError) throw itemsError;

      await logActivity({
        organizationId: user.organization_id,
        userId: user.id,
        eventType: 'invoice_created',
        entityType: 'invoice',
        entityId: invoice.id,
        contactId: selectedContact.id,
        summary: `Created invoice ${invoiceNumber} for ${selectedContact.first_name} ${selectedContact.last_name}`.trim(),
        payload: { invoice_number: invoiceNumber, total },
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Create Invoice"
      subtitle="Generate a new invoice"
      size="lg"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-white">
            Total: ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedContact || lineItems.length === 0}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Bill To <span className="text-red-400">*</span>
          </label>
          {selectedContact ? (
            <div className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedContact.first_name} {selectedContact.last_name}
                </p>
                <p className="text-xs text-slate-400">{selectedContact.email || 'No email'}</p>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              {(contacts.length > 0 || searching) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="p-3 text-sm text-slate-400">Searching...</div>
                  ) : (
                    contacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setSearchQuery('');
                          setContacts([]);
                        }}
                        className="w-full p-3 text-left hover:bg-slate-700 transition-colors"
                      >
                        <p className="text-sm font-medium text-white">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-xs text-slate-400">{contact.email || 'No email'}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">
              Line Items <span className="text-red-400">*</span>
            </label>
            <button
              onClick={addLineItem}
              disabled={products.length === 0}
              className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </button>
          </div>

          {lineItems.length === 0 ? (
            <div className="p-4 border border-dashed border-slate-700 rounded-lg text-center">
              <p className="text-sm text-slate-500">No items added yet</p>
              <button
                onClick={addLineItem}
                disabled={products.length === 0}
                className="mt-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
              >
                Add your first item
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-lg"
                >
                  <select
                    value={item.product_id}
                    onChange={(e) => handleProductChange(item.id, e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(item.id, { quantity: parseInt(e.target.value) || 1 })
                    }
                    min="1"
                    className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                  <div className="w-24 text-right text-sm text-slate-300">
                    ${(item.quantity * item.unit_price).toFixed(2)}
                  </div>
                  <button
                    onClick={() => removeLineItem(item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Memo</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="Add a note to this invoice..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
          />
        </div>
      </div>
    </Drawer>
  );
}
