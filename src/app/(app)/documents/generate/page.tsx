import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, accounts, properties } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import FormGenerator from './FormGenerator';
import { FORM_TEMPLATE_INFO } from '@/server/services/formTemplateService';
import type { ParsedNoticeData } from '@/server/services/noticeParser';
import type { FormTemplateType } from '@/server/services/formTemplateService';

export const metadata: Metadata = { title: 'Generate Document' };

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ noticeId?: string; formType?: string; workOrderId?: string }>;
}) {
  const params = await searchParams;
  await requireRole('admin', 'dispatcher');

  const { noticeId, formType, workOrderId } = params;
  if (!formType || !(formType in FORM_TEMPLATE_INFO)) redirect('/documents');

  const validFormType = formType as FormTemplateType;
  const info = FORM_TEMPLATE_INFO[validFormType];

  let parsed: ParsedNoticeData | null = null;
  let propertyName = '';
  let noticeIdToUse = noticeId;

  if (noticeId) {
    const result = await db
      .select({ notice: notices, account: accounts, property: properties })
      .from(notices)
      .leftJoin(accounts, eq(notices.accountId, accounts.id))
      .leftJoin(properties, eq(notices.propertyId, properties.id))
      .where(eq(notices.id, noticeId))
      .limit(1);

    if (result[0]) {
      parsed = result[0].notice.parsedData as unknown as ParsedNoticeData | null;
      propertyName = parsed?.propertyName || result[0].account?.name || '';
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`Generate ${validFormType.toUpperCase()}`}
        description={info.label.split(' — ')[1] ?? info.label}
      />

      {/* Form info */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="pt-4 text-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="font-mono">{validFormType.toUpperCase()}</Badge>
            <span className="font-semibold">{info.label}</span>
          </div>
          <p className="text-muted-foreground">{info.description}</p>
          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <span className="font-medium">Filed with: </span>
              <span className="text-muted-foreground">{info.filedWith}</span>
            </div>
            <div>
              <span className="font-medium">Filed when: </span>
              <span className="text-muted-foreground">{info.filedWhen}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pre-filled data preview */}
      {parsed && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Data Pre-filled from Preliminary Order
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Property" value={parsed.propertyName} />
            <Field label="Address" value={parsed.propertyAddress} />
            <Field label="State ID" value={parsed.equipmentId} highlight />
            <Field label="Elevator Type" value={parsed.elevatorType} />
            <Field label="Inspection Date" value={parsed.inspectionDate ?? ''} />
            <Field label="Compliance Deadline" value={parsed.complianceDeadline ?? ''} highlight />
          </CardContent>
        </Card>
      )}

      {/* Legal reminder */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-xs text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Before generating:</p>
          <p>The system uses the official Cal/OSHA PDF you uploaded. Fields are pre-filled from the Preliminary Order data — verify everything is accurate. For EU-632, the CCCM must physically sign the form before submission.</p>
        </div>
      </div>

      {/* Generator */}
      <FormGenerator
        formType={validFormType}
        noticeId={noticeIdToUse}
        workOrderId={workOrderId}
        parsedData={parsed}
      />
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${highlight ? 'text-blue-700' : ''}`}>{value}</p>
    </div>
  );
}
