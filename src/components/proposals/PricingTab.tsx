import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, ChevronRight } from 'lucide-react';
import {
  addProposalLineItem,
  updateProposalLineItem,
  deleteProposalLineItem,
  recalculateAndUpdateProposalTotal,
} from '../../services/proposals';
import type { Proposal, ProposalLineItem } from '../../types';

interface PricingTabProps {
  proposal: Proposal;
  canEdit: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  onReload: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

interface LineItemForm {
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
  unit_price_max: string;
  discount_percent: string;
}

const EMPTY_FORM: LineItemForm = {
  name: '',
  description: '',
  quantity: '1',
  unit_price: '0',
  unit_price_max: '',
  discount_percent: '0',
};

function formToItem(form: LineItemForm) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    quantity: parseFloat(form.quantity) || 1,
    unit_price: parseFloat(form.unit_price) || 0,
    unit_price_max: form.unit_price_max !== '' ? parseFloat(form.unit_price_max) : null,
    discount_percent: parseFloat(form.discount_percent) || 0,
  };
}

function computeLineTotal(item: ProposalLineItem): { min: number; max: number; isRange: boolean } {
  const isRange = item.unit_price_max != null && item.unit_price_max > item.unit_price;
  const minTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
  const maxTotal = isRange
    ? item.quantity * item.unit_price_max! * (1 - item.discount_percent / 100)
    : minTotal;
  return { min: minTotal, max: maxTotal, isRange };
}

function computeGrandTotal(items: ProposalLineItem[]): { min: number; max: number; isRange: boolean } {
  let min = 0;
  let max = 0;
  let isRange = false;
  for (const item of items) {
    const t = computeLineTotal(item);
    min += t.min;
    max += t.max;
    if (t.isRange) isRange = true;
  }
  return { min, max, isRange };
}

export function PricingTab({ proposal, canEdit, formatCurrency, onReload, showToast }: PricingTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<LineItemForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LineItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const items = proposal.line_items || [];
  const currency = proposal.currency || 'USD';
  const grand = computeGrandTotal(items);

  const startEdit = (item: ProposalLineItem) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      description: item.description || '',
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      unit_price_max: item.unit_price_max != null ? String(item.unit_price_max) : '',
      discount_percent: String(item.discount_percent),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const updates = formToItem(editForm);
    if (!updates.name) { showToast('Item name is required', 'warning'); return; }
    try {
      setSaving(true);
      await updateProposalLineItem(editingId, updates);
      await recalculateAndUpdateProposalTotal(proposal.id);
      setEditingId(null);
      onReload();
    } catch {
      showToast('Failed to update line item', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const values = formToItem(addForm);
    if (!values.name) { showToast('Item name is required', 'warning'); return; }
    try {
      setSaving(true);
      await addProposalLineItem({
        org_id: proposal.org_id,
        proposal_id: proposal.id,
        ...values,
        sort_order: items.length,
      });
      await recalculateAndUpdateProposalTotal(proposal.id);
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
      onReload();
    } catch {
      showToast('Failed to add line item', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this line item?')) return;
    try {
      setDeleting(id);
      await deleteProposalLineItem(id);
      await recalculateAndUpdateProposalTotal(proposal.id);
      onReload();
    } catch {
      showToast('Failed to delete line item', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const renderUnitPrice = (item: ProposalLineItem) => {
    if (item.unit_price_max != null && item.unit_price_max > item.unit_price) {
      return (
        <span className="text-slate-300">
          {formatCurrency(item.unit_price, currency)}
          <span className="text-slate-500 mx-1">–</span>
          {formatCurrency(item.unit_price_max, currency)}
        </span>
      );
    }
    return <span className="text-slate-300">{formatCurrency(item.unit_price, currency)}</span>;
  };

  const renderLineTotal = (item: ProposalLineItem) => {
    const t = computeLineTotal(item);
    if (t.isRange) {
      return (
        <span className="text-white font-medium">
          {formatCurrency(t.min, currency)}
          <span className="text-slate-500 mx-1">–</span>
          {formatCurrency(t.max, currency)}
        </span>
      );
    }
    return <span className="text-white font-medium">{formatCurrency(t.max, currency)}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Item</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider w-16">Qty</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Unit Price</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider w-20">Discount</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Total</th>
              {canEdit && <th className="w-20 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {items.length > 0 ? items.map((item) => (
              editingId === item.id ? (
                <tr key={item.id} className="bg-slate-700/30">
                  <td className="px-4 py-3" colSpan={canEdit ? 6 : 5}>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Item Name *</label>
                          <input
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Phase 1: Discovery"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Description</label>
                          <input
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                            value={editForm.description}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Optional description"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Qty</label>
                          <input
                            type="number" min="0" step="0.01"
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                            value={editForm.quantity}
                            onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Price (min)</label>
                          <input
                            type="number" min="0" step="0.01"
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                            value={editForm.unit_price}
                            onChange={e => setEditForm(f => ({ ...f, unit_price: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Price Max <span className="text-slate-500">(range)</span></label>
                          <input
                            type="number" min="0" step="0.01"
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                            value={editForm.unit_price_max}
                            onChange={e => setEditForm(f => ({ ...f, unit_price_max: e.target.value }))}
                            placeholder="Leave blank for fixed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Discount %</label>
                          <input
                            type="number" min="0" max="100" step="0.01"
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                            value={editForm.discount_percent}
                            onChange={e => setEditForm(f => ({ ...f, discount_percent: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded text-sm transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className="hover:bg-slate-700/20 transition-colors group">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-slate-400 mt-0.5">{item.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">{renderUnitPrice(item)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {item.discount_percent > 0 ? `${item.discount_percent}%` : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{renderLineTotal(item)}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            )) : (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-10 text-center text-slate-400">
                  <p className="text-sm">No line items added yet</p>
                  {canEdit && (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="mt-3 inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add first line item
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-slate-600">
            <tr>
              <td colSpan={canEdit ? 4 : 4} className="px-4 py-3 text-right text-slate-300 font-medium text-sm">
                {grand.isRange ? 'Total (range)' : 'Total'}
              </td>
              <td className="px-4 py-3 text-right">
                {grand.isRange ? (
                  <span className="text-xl font-semibold text-white">
                    {formatCurrency(grand.min, currency)}
                    <ChevronRight className="inline w-4 h-4 text-slate-500 mx-1" />
                    {formatCurrency(grand.max, currency)}
                  </span>
                ) : (
                  <span className="text-xl font-semibold text-white">
                    {formatCurrency(grand.max, currency)}
                  </span>
                )}
              </td>
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {canEdit && !showAddForm && items.length > 0 && (
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-sm transition-colors border border-slate-600"
        >
          <Plus className="w-4 h-4" />
          Add Line Item
        </button>
      )}

      {canEdit && showAddForm && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-3">
          <h4 className="text-sm font-medium text-white">New Line Item</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Item Name *</label>
              <input
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Phase 1: Discovery"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <input
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Qty</label>
              <input
                type="number" min="0" step="0.01"
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                value={addForm.quantity}
                onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Price (min)</label>
              <input
                type="number" min="0" step="0.01"
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                value={addForm.unit_price}
                onChange={e => setAddForm(f => ({ ...f, unit_price: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Price Max <span className="text-slate-500">(range)</span></label>
              <input
                type="number" min="0" step="0.01"
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                value={addForm.unit_price_max}
                onChange={e => setAddForm(f => ({ ...f, unit_price_max: e.target.value }))}
                placeholder="Leave blank for fixed"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Discount %</label>
              <input
                type="number" min="0" max="100" step="0.01"
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                value={addForm.discount_percent}
                onChange={e => setAddForm(f => ({ ...f, discount_percent: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
