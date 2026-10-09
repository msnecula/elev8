'use client';

import { useState } from 'react';
import { Download, FileText, Loader2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDocumentDownloadUrl } from '@/server/actions/documents';
import type { DocumentType } from '@/drizzle/schema/documents';

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  notice_pdf:         'Cal/OSHA Notice',
  eu632:              'EU-632',
  eu787:              'EU-787',
  eu776a:             'EU-776A',
  eu776b:             'EU-776B',
  dosh100:            'DOSH-100',
  advance_notice_48hr:'48-Hr Advance Notice',
  proposal_pdf:       'Proposal PDF',
  work_order_pdf:     'Work Order PDF',
};

const DOC_TYPE_COLORS: Record<DocumentType, string> = {
  notice_pdf:         'bg-red-50 text-red-700 border-red-200',
  eu632:              'bg-blue-50 text-blue-700 border-blue-200',
  eu787:              'bg-purple-50 text-purple-700 border-purple-200',
  eu776a:             'bg-violet-50 text-violet-700 border-violet-200',
  eu776b:             'bg-violet-50 text-violet-700 border-violet-200',
  dosh100:            'bg-amber-50 text-amber-700 border-amber-200',
  advance_notice_48hr:'bg-orange-50 text-orange-700 border-orange-200',
  proposal_pdf:       'bg-green-50 text-green-700 border-green-200',
  work_order_pdf:     'bg-slate-50 text-slate-700 border-slate-200',
};

interface VaultDoc {
  id: string;
  documentType: DocumentType;
  fileName: string;
  fileSizeBytes: number | null;
  createdAt: Date;
  propertyId: string | null;
  noticeId: string | null;
  jobId: string | null;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadButton({ docId, fileName }: { docId: string; fileName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const result = await getDocumentDownloadUrl(docId);
      if (result.success) {
        // Open signed URL in new tab — browser will download or preview PDF
        window.open(result.data.url, '_blank');
      } else {
        alert(`Could not get download link: ${result.error}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0"
      onClick={handleDownload}
      disabled={loading}
      title={`Download ${fileName}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

export default function DocumentVaultSection({ docs }: { docs: VaultDoc[] }) {
  if (docs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center">
        <Archive className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          No documents saved yet. Generated forms and received Cal/OSHA notice PDFs will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            {['Type', 'File Name', 'Size', 'Saved', 'Download'].map(h => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${DOC_TYPE_COLORS[doc.documentType]}`}
                >
                  {DOC_TYPE_LABELS[doc.documentType]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[260px]">
                    {doc.fileName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {formatBytes(doc.fileSizeBytes) || '—'}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(doc.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
                {' '}
                <span className="opacity-60">
                  {new Date(doc.createdAt).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit',
                  })}
                </span>
              </td>
              <td className="px-4 py-3">
                <DownloadButton docId={doc.id} fileName={doc.fileName} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
