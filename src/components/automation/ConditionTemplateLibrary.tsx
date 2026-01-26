import { useState, useEffect } from 'react';
import { Search, BookOpen, Copy, Trash2, Plus, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ConditionTemplate, ConditionGroup, EntityType } from '../../types/conditions';
import { getConditionTemplates, createConditionTemplate, deleteConditionTemplate, duplicateConditionTemplate, incrementTemplateUsage, getTemplateCategories } from '../../services/conditionTemplates';

interface ConditionTemplateLibraryProps { onSelectTemplate: (conditions: ConditionGroup) => void; currentConditions?: ConditionGroup; entityType?: EntityType; }

export function ConditionTemplateLibrary({ onSelectTemplate, currentConditions, entityType }: ConditionTemplateLibraryProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ConditionTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTemplates(); }, [user?.org_id, selectedCategory, entityType]);

  const loadTemplates = async () => {
    if (!user?.org_id) return;
    setLoading(true);
    try {
      const [templatesData, categoriesData] = await Promise.all([getConditionTemplates(user.org_id, { category: selectedCategory || undefined, entityType }), getTemplateCategories(user.org_id)]);
      setTemplates(templatesData); setCategories(categoriesData);
    } catch (err) { console.error('Failed to load templates:', err); }
    finally { setLoading(false); }
  };

  const handleSelectTemplate = async (template: ConditionTemplate) => {
    try { await incrementTemplateUsage(template.id); onSelectTemplate(template.conditions as ConditionGroup); }
    catch (err) { console.error('Failed to increment usage:', err); onSelectTemplate(template.conditions as ConditionGroup); }
  };

  const handleDuplicateTemplate = async (template: ConditionTemplate) => {
    if (!user?.org_id) return;
    try { await duplicateConditionTemplate(template.id, `${template.name} (Copy)`, user.id); await loadTemplates(); }
    catch (err) { console.error('Failed to duplicate template:', err); }
  };

  const handleDeleteTemplate = async (template: ConditionTemplate) => {
    if (template.is_system || !confirm('Are you sure you want to delete this template?')) return;
    try { await deleteConditionTemplate(template.id); await loadTemplates(); }
    catch (err) { console.error('Failed to delete template:', err); }
  };

  const handleSaveTemplate = async () => {
    if (!user?.org_id || !currentConditions || !newTemplateName.trim()) return;
    setSaving(true);
    try {
      await createConditionTemplate(user.org_id, { name: newTemplateName.trim(), description: newTemplateDescription.trim() || undefined, category: newTemplateCategory, conditions: currentConditions, entityTypes: entityType ? [entityType] : [] }, user.id);
      setShowSaveModal(false); setNewTemplateName(''); setNewTemplateDescription(''); setNewTemplateCategory('general'); await loadTemplates();
    } catch (err) { console.error('Failed to save template:', err); }
    finally { setSaving(false); }
  };

  const filteredTemplates = templates.filter(template => { if (!searchQuery.trim()) return true; const query = searchQuery.toLowerCase(); return template.name.toLowerCase().includes(query) || template.description?.toLowerCase().includes(query) || template.category.toLowerCase().includes(query); });
  const categoryLabels: Record<string, string> = { general: 'General', leads: 'Leads', sales: 'Sales', marketing: 'Marketing', support: 'Support', payments: 'Payments', appointments: 'Appointments' };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Condition Templates</h3></div>
          {currentConditions && currentConditions.conditions.length > 0 && (<button onClick={() => setShowSaveModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Plus className="w-4 h-4" />Save as Template</button>)}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search templates..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
          <select value={selectedCategory || ''} onChange={e => setSelectedCategory(e.target.value || null)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"><option value="">All Categories</option>{categories.map(cat => (<option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>))}</select>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (<div className="p-8 text-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading templates...</p></div>)
        : filteredTemplates.length === 0 ? (<div className="p-8 text-center"><BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">{searchQuery ? 'No templates match your search' : 'No templates available'}</p></div>)
        : (<div className="divide-y divide-gray-200 dark:divide-gray-700">{filteredTemplates.map(template => (<TemplateCard key={template.id} template={template} categoryLabel={categoryLabels[template.category] || template.category} onSelect={() => handleSelectTemplate(template)} onDuplicate={() => handleDuplicateTemplate(template)} onDelete={() => handleDeleteTemplate(template)} />))}</div>)}
      </div>
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700"><h4 className="text-lg font-semibold text-gray-900 dark:text-white">Save as Template</h4></div>
            <div className="p-4 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name *</label><input type="text" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="e.g., High Value Lead Filter" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label><textarea value={newTemplateDescription} onChange={e => setNewTemplateDescription(e.target.value)} placeholder="What does this template do?" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label><select value={newTemplateCategory} onChange={e => setNewTemplateCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"><option value="general">General</option><option value="leads">Leads</option><option value="sales">Sales</option><option value="marketing">Marketing</option><option value="support">Support</option><option value="payments">Payments</option><option value="appointments">Appointments</option></select></div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2"><button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button><button onClick={handleSaveTemplate} disabled={saving || !newTemplateName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save Template'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, categoryLabel, onSelect, onDuplicate, onDelete }: { template: ConditionTemplate; categoryLabel: string; onSelect: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const conditionCount = countConditions(template.conditions as ConditionGroup);
  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2"><h4 className="font-medium text-gray-900 dark:text-white truncate">{template.name}</h4>{template.is_system && <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">System</span>}</div>
          {template.description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{template.description}</p>}
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"><span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{categoryLabel}</span><span>{conditionCount} condition{conditionCount !== 1 ? 's' : ''}</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />Used {template.usage_count}x</span></div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onSelect} className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors">Use</button>
          <button onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Duplicate"><Copy className="w-4 h-4" /></button>
          {!template.is_system && <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>}
        </div>
      </div>
    </div>
  );
}

function countConditions(group: ConditionGroup): number { let count = 0; for (const item of group.conditions || []) { if ('logicalOperator' in item) count += countConditions(item); else count += 1; } return count; }
