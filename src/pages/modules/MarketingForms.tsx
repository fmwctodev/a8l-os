import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Trash2,
  Eye,
  Code,
  ExternalLink,
  ArrowLeft,
  FileText,
  Globe,
  Archive,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getForms,
  createForm,
  duplicateForm,
  publishForm,
  unpublishForm,
  archiveForm,
  deleteForm,
  generateFormEmbedCode,
  getFormPublicUrl,
} from '../../services/forms';
import type { Form, FormStatus } from '../../types';

export function MarketingForms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FormStatus | 'all'>('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [showEmbedModal, setShowEmbedModal] = useState<Form | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function openMenu(formId: string) {
    const btn = triggerRefs.current[formId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setActiveMenu(formId);
  }

  function closeMenu() {
    setActiveMenu(null);
    setMenuPos(null);
  }

  useEffect(() => {
    loadForms();
  }, [user?.organization_id, statusFilter, searchQuery]);

  useEffect(() => {
    if (!activeMenu) return;
    function handleClose() {
      closeMenu();
    }
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [activeMenu]);

  async function loadForms() {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const data = await getForms(user.organization_id, {
        status: statusFilter !== 'all' ? [statusFilter] : undefined,
        search: searchQuery || undefined,
      });
      setForms(data);
    } catch (error) {
      console.error('Failed to load forms:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateForm() {
    if (!user?.organization_id) return;

    try {
      const form = await createForm(
        user.organization_id,
        user.id,
        'New Form'
      );
      navigate(`/marketing/forms/${form.id}/edit`);
    } catch (error) {
      console.error('Failed to create form:', error);
    }
  }

  async function handleDuplicate(form: Form) {
    if (!user) return;

    try {
      const duplicate = await duplicateForm(form.id, user.id);
      navigate(`/marketing/forms/${duplicate.id}/edit`);
    } catch (error) {
      console.error('Failed to duplicate form:', error);
    }
  }

  async function handlePublish(form: Form) {
    try {
      await publishForm(form.id);
      loadForms();
    } catch (error) {
      console.error('Failed to publish form:', error);
    }
  }

  async function handleUnpublish(form: Form) {
    try {
      await unpublishForm(form.id);
      loadForms();
    } catch (error) {
      console.error('Failed to unpublish form:', error);
    }
  }

  async function handleArchive(form: Form) {
    try {
      await archiveForm(form.id);
      loadForms();
    } catch (error) {
      console.error('Failed to archive form:', error);
    }
  }

  async function handleDelete(form: Form) {
    if (!confirm('Are you sure you want to delete this form?')) return;

    try {
      await deleteForm(form.id);
      loadForms();
    } catch (error) {
      console.error('Failed to delete form:', error);
    }
  }

  function getStatusBadge(status: FormStatus) {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            <Globe className="w-3 h-3 mr-1" />
            Published
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            <FileText className="w-3 h-3 mr-1" />
            Draft
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            <Archive className="w-3 h-3 mr-1" />
            Archived
          </span>
        );
    }
  }

  const baseUrl = window.location.origin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/marketing"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white">Forms</h1>
            <p className="text-sm text-gray-500">
              Create and manage lead capture forms
            </p>
          </div>
        </div>
        <button
          onClick={handleCreateForm}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Form
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FormStatus | 'all')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 border-b border-gray-100 last:border-b-0 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No forms yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first form to start capturing leads
          </p>
          <button
            onClick={handleCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Form
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Form
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forms.map((form) => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <Link
                      to={`/marketing/forms/${form.id}/edit`}
                      className="flex items-center gap-3"
                    >
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {form.name}
                        </div>
                        {form.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {form.description}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-4">{getStatusBadge(form.status)}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {new Date(form.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {form.status === 'published' && form.public_slug && (
                        <>
                          <a
                            href={getFormPublicUrl(form.public_slug, baseUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="View Form"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => setShowEmbedModal(form)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Get Embed Code"
                          >
                            <Code className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        ref={(el) => {
                          triggerRefs.current[form.id] = el;
                        }}
                        onClick={() =>
                          activeMenu === form.id ? closeMenu() : openMenu(form.id)
                        }
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {activeMenu === form.id && menuPos &&
                        createPortal(
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={closeMenu}
                            />
                            <div
                              className="fixed w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                              style={{ top: menuPos.top, right: menuPos.right }}
                            >
                              <Link
                                to={`/marketing/forms/${form.id}/edit`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="w-4 h-4" />
                                Edit Form
                              </Link>
                              <button
                                onClick={() => {
                                  handleDuplicate(form);
                                  closeMenu();
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Copy className="w-4 h-4" />
                                Duplicate
                              </button>
                              {form.status === 'draft' && (
                                <button
                                  onClick={() => {
                                    handlePublish(form);
                                    closeMenu();
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                                >
                                  <Globe className="w-4 h-4" />
                                  Publish
                                </button>
                              )}
                              {form.status === 'published' && (
                                <button
                                  onClick={() => {
                                    handleUnpublish(form);
                                    closeMenu();
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50"
                                >
                                  <FileText className="w-4 h-4" />
                                  Unpublish
                                </button>
                              )}
                              {form.status !== 'archived' && (
                                <button
                                  onClick={() => {
                                    handleArchive(form);
                                    closeMenu();
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Archive className="w-4 h-4" />
                                  Archive
                                </button>
                              )}
                              <Link
                                to={`/marketing/forms/${form.id}/submissions`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="w-4 h-4" />
                                View Submissions
                              </Link>
                              <hr className="my-1" />
                              <button
                                onClick={() => {
                                  handleDelete(form);
                                  closeMenu();
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </>,
                          document.body
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showEmbedModal && (
        <EmbedCodeModal
          form={showEmbedModal}
          baseUrl={baseUrl}
          onClose={() => setShowEmbedModal(null)}
        />
      )}
    </div>
  );
}

function EmbedCodeModal({
  form,
  baseUrl,
  onClose,
}: {
  form: Form;
  baseUrl: string;
  onClose: () => void;
}) {
  const [embedType, setEmbedType] = useState<'iframe' | 'popup' | 'sdk'>('iframe');
  const [copied, setCopied] = useState(false);

  const embedCode = form.public_slug
    ? generateFormEmbedCode(form.public_slug, { type: embedType, baseUrl })
    : '';

  function handleCopy() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Embed Form: {form.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {(['iframe', 'popup', 'sdk'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setEmbedType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  embedType === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'iframe'
                  ? 'Inline Embed'
                  : type === 'popup'
                  ? 'Popup Button'
                  : 'JavaScript SDK'}
              </button>
            ))}
          </div>

          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{embedCode}</code>
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-1">Direct Link</h4>
            <p className="text-sm text-blue-700">
              {form.public_slug && getFormPublicUrl(form.public_slug, baseUrl)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
