import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, accounts } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { getUploadedTemplates } from '@/server/actions/formTemplates';
import { FORM_TEMPLATE_INFO } from '@/server/services/formTemplateService';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, CheckCircle2, ExternalLink, FileText, Settings,
} from 'lucide-react';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

export const metadata: Metadata = { title: 'Compliance Documents' };

export default async function DocumentsPage() {
  await requireRole('admin', 'dispatcher');

  const [parsedNotices, templatesResult] = await Promise.all([
    db.select({ notice: notices, account: { name: accounts.name } })
      .from(notices)
      .leftJoin(accounts, eq(notices.accountId, accounts.id))
      .where(eq(notices.status, 'parsed'))
      .orderBy(desc(notices.createdAt))
      .limit(50),
    getUploadedTemplates(),
  ]);

  const templates = templatesResult.success ? templatesResult.data : {};
  const formTypes = Object.keys(FORM_TEMPLATE_INFO) as Array<keyof typeof FORM_TEMPLATE_INFO>;
  const uploadedCount = formTypes.filter(t => templates[t]?.uploaded).length;
  const missingForms = formTypes.filter(t => !templates[t]?.uploaded);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Compliance Documents"
        description="Generate Cal/OSHA forms pre-filled from your Preliminary Orders"
      />

      {/* Template status banner */}
      {uploadedCount < formTypes.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800 text-sm">
                {uploadedCount === 0
                  ? 'No official Cal/OSHA forms uploaded yet'
                  : `${missingForms.length} form${missingForms.length > 1 ? 's' : ''} not yet uploaded`}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Upload the official PDFs from dir.ca.gov to enable document generation.
                The system fills the actual Cal/OSHA forms — not recreations.
              </p>
              {missingForms.length > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Missing: {missingForms.map(f => FORM_TEMPLATE_INFO[f].label.split(' — ')[0]).join(', ')}
                </p>
              )}
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300">
              <Link href="/settings/forms">
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Upload Forms
              </Link>
            </Button>
          </div>
        </div>
      )}

      {uploadedCount > 0 && uploadedCount === formTypes.length && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-800">
            All {formTypes.length} official Cal/OSHA forms uploaded.
            Documents will use the exact state forms.
          </p>
          <Button asChild size="sm" variant="ghost" className="ml-auto text-green-700">
            <Link href="/settings/forms">Manage Forms</Link>
          </Button>
        </div>
      )}

      {/* Available forms */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Available Forms
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {formTypes.map(formType => {
            const info = FORM_TEMPLATE_INFO[formType];
            const isUploaded = templates[formType]?.uploaded ?? false;
            return (
              <div key={formType} className={`rounded-lg border p-4 space-y-2 ${
                isUploaded ? 'border-border bg-card' : 'border-dashed border-muted-foreground/30 bg-muted/20'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{formType.toUpperCase()}</span>
                  {isUploaded ? (
                    <Badge className="bg-green-100 text-green-700 text-xs border border-green-200">Ready</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Not uploaded</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {info.label.split(' — ')[1]}
                </p>
                <p className="text-xs text-muted-foreground italic">{info.filedWhen}</p>
                {!isUploaded && (
                  <Button asChild size="sm" variant="outline" className="w-full text-xs h-7">
                    <Link href="/settings/forms">Upload Form</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Notices — select to generate documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Select a Preliminary Order to Generate Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {parsedNotices.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No parsed notices found. Upload and parse a Preliminary Order first.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Property', 'State ID', 'Deadline', 'Generate'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedNotices.map(({ notice, account }) => {
                  const parsed = notice.parsedData as unknown as ParsedNoticeData | null;
                  const propertyDisplay = parsed?.propertyName || account?.name || 'Unknown';

                  return (
                    <tr key={notice.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{propertyDisplay}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{parsed?.propertyAddress}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm">{parsed?.equipmentId || '—'}</p>
                        <p className="text-xs text-muted-foreground capitalize">{parsed?.elevatorType}</p>
                      </td>
                      <td className="px-4 py-3">
                        {parsed?.complianceDeadline ? (
                          <span className="text-red-700 font-medium text-sm">
                            {new Date(parsed.complianceDeadline + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(['eu632', 'eu787', 'dosh100'] as const).map(formType => (
                            <Button
                              key={formType}
                              asChild
                              size="sm"
                              variant={templates[formType]?.uploaded ? 'outline' : 'ghost'}
                              className={`h-7 text-xs ${!templates[formType]?.uploaded ? 'opacity-40' : ''}`}
                              disabled={!templates[formType]?.uploaded}
                            >
                              <Link href={`/documents/generate?noticeId=${notice.id}&formType=${formType}`}>
                                {formType.toUpperCase()}
                              </Link>
                            </Button>
                          ))}
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-50">
                            <Link href={`/documents/advance-notice?noticeId=${notice.id}`}>
                              48-Hr Notice
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
