import { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, PenTool, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useClientPortalProject } from '../../../contexts/ClientPortalContextV2';
import { getPortalChangeRequests } from '../../../services/projectClientPortals';
import type { ProjectChangeRequest, ProjectChangeOrder } from '../../../types';

interface DocumentItem {
  id: string;
  title: string;
  type: 'change_order' | 'attachment';
  status: string;
  date: string;
  url?: string;
  frozenHtml?: string | null;
  changeOrderObj?: ProjectChangeOrder;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  change_order: 'Change Order',
  attachment: 'Attachment',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-blue-100 text-blue-700',
  signed: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-red-100 text-red-600',
  voided: 'bg-gray-100 text-gray-500',
};

export function ClientPortalDocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project } = useClientPortalProject(projectId!);

  const [requests, setRequests] = useState<ProjectChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  useEffect(() => {
    if (!project) return;
    getPortalChangeRequests(projectId!)
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [project]);

  if (!project) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  const documents: DocumentItem[] = [];

  for (const req of requests) {
    if (req.change_orders) {
      for (const order of req.change_orders) {
        if (['sent', 'viewed', 'signed', 'declined'].includes(order.status)) {
          documents.push({
            id: order.id,
            title: order.title,
            type: 'change_order',
            status: order.status,
            date: order.sent_at ?? order.created_at,
            frozenHtml: order.frozen_html_snapshot,
            changeOrderObj: order,
          });
        }
      }
    }

    if (req.attachments?.length) {
      for (const att of req.attachments) {
        documents.push({
          id: `${req.id}-${att.name}`,
          title: att.name,
          type: 'attachment',
          status: 'available',
          date: req.created_at,
          url: att.url,
        });
      }
    }
  }

  documents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Documents</h2>
        <p className="text-sm text-gray-500 mt-0.5">All documents and files associated with your project</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm text-center py-16">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No documents yet</h3>
          <p className="text-sm text-gray-400">Documents shared by the project team will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${
                  doc.type === 'change_order' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <FileText className={`w-5 h-5 ${doc.type === 'change_order' ? 'text-orange-600' : 'text-gray-500'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{doc.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</span>
                    <span className="text-gray-300">&middot;</span>
                    <span className="text-xs text-gray-400">
                      {new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-none">
                  {doc.status !== 'available' && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {doc.status}
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    {doc.frozenHtml && (
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Preview"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    {doc.type === 'change_order' && ['sent', 'viewed'].includes(doc.status) && (
                      <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                        <PenTool className="w-3 h-3" />
                        Needs signature
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewDoc?.frozenHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewDoc(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">{previewDoc.title}</h3>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50">
              <iframe
                srcDoc={previewDoc.frozenHtml}
                className="w-full h-full min-h-[500px]"
                title={previewDoc.title}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
