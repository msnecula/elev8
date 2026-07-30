'use client';

import { useState, useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { generateFilledForm } from '@/server/actions/formTemplates';
import { Loader2, Download, Plus, Trash2, CheckCircle2, Info } from 'lucide-react';
import type { FormTemplateType } from '@/server/services/formTemplateService';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

interface Props {
  formType: FormTemplateType;
  noticeId?: string;
  workOrderId?: string;
  parsedData: ParsedNoticeData | null;
}

export default function FormGenerator({ formType, noticeId, workOrderId, parsedData }: Props) {
  const [isPending, startTransition] = useTransition();
  const [pdfReady, setPdfReady] = useState<{ base64: string; filename: string; unfilledFields: string[] } | null>(null);
  const [flatten, setFlatten] = useState(false);

  // Extra fields specific to each form type
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      extraFields: [] as Array<{ fieldName: string; value: string }>,
      // EU-632 specific
      requirements: parsedData?.violationItems?.map((v, i) => ({
        reqNumber: String(i + 1),
        solution: '',
        cccmNumber: '',
        violation: v,
      })) ?? [{ reqNumber: '1', solution: '', cccmNumber: '', violation: '' }],
      cccmName: '',
      cccmLicenseExpiry: '',
      signerName: '',
      signerPhone: '',
      // EU-787 specific
      testDate: '',
      testTime: '',
      mechanicName: '',
      mechanicLicenseNumber: '',
      mechanicLicenseExpiry: '',
      districtOffice: '',
      group: 'IV',
    },
  });

  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({
    control, name: 'extraFields',
  });
  const { fields: reqFields, append: appendReq, remove: removeReq } = useFieldArray({
    control, name: 'requirements',
  });

  function onSubmit(values: any) {
    startTransition(async () => {
      // Build additional fields from form-specific inputs
      const additionalFields: Record<string, string> = {};

      // Add any manually entered extra fields
      for (const ef of values.extraFields ?? []) {
        if (ef.fieldName && ef.value) {
          additionalFields[ef.fieldName] = ef.value;
        }
      }

      // EU-632 specific field mappings
      if (formType === 'eu632') {
        additionalFields['CCCM Name'] = values.cccmName;
        additionalFields['Printed Name'] = values.cccmName;
        additionalFields['cccmName'] = values.cccmName;
        additionalFields['License Expiry'] = values.cccmLicenseExpiry;
        additionalFields['CCCM License Expiry'] = values.cccmLicenseExpiry;
        additionalFields['Signer Name'] = values.signerName;
        additionalFields['Signer Phone'] = values.signerPhone;

        // Map requirement rows to common field name patterns
        for (let i = 0; i < values.requirements.length; i++) {
          const r = values.requirements[i];
          additionalFields[`Req ${i + 1}`] = r.reqNumber;
          additionalFields[`req${i + 1}`] = r.reqNumber;
          additionalFields[`Solution ${i + 1}`] = r.solution;
          additionalFields[`solution${i + 1}`] = r.solution;
          additionalFields[`CCCM ${i + 1}`] = r.cccmNumber;
          additionalFields[`cccm${i + 1}`] = r.cccmNumber;
        }
      }

      // EU-787 specific
      if (formType === 'eu787') {
        additionalFields['Test Date'] = values.testDate;
        additionalFields['testDate'] = values.testDate;
        additionalFields['Test Time'] = values.testTime;
        additionalFields['Mechanic Name'] = values.mechanicName;
        additionalFields['CCCM Name'] = values.mechanicName;
        additionalFields['License Number'] = values.mechanicLicenseNumber;
        additionalFields['License Expiry'] = values.mechanicLicenseExpiry;
        additionalFields['District Office'] = values.districtOffice;
        additionalFields['Group'] = values.group;
      }

      const result = await generateFilledForm({
        formType,
        noticeId,
        workOrderId,
        additionalFields,
        flatten,
      });

      if (result.success) {
        setPdfReady({
          base64: result.data.pdfBase64,
          filename: result.data.filename,
          unfilledFields: result.data.unfilledFields,
        });
        toast.success('Form generated — review and download below');
      } else {
        toast.error(result.error);
      }
    });
  }

  function downloadPdf() {
    if (!pdfReady) return;
    const bytes = atob(pdfReady.base64);
    const blob = new Blob([new Uint8Array([...bytes].map(c => c.charCodeAt(0)))], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfReady.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* EU-632 extra inputs */}
      {formType === 'eu632' && (
        <>
          {/* Violations reference */}
          {parsedData?.violationItems && parsedData.violationItems.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Violations from PO (reference)</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {parsedData.violationItems.map((v, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="bg-amber-100 text-amber-800 rounded px-1.5 text-xs font-bold shrink-0 mt-0.5">#{i+1}</span>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Requirements & Corrective Actions</CardTitle>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => appendReq({ reqNumber: '', solution: '', cccmNumber: '', violation: '' })}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {reqFields.map((field, i) => (
                <div key={field.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Requirement {i + 1}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeReq(i)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Req # (from PO)</Label>
                      <Input {...register(`requirements.${i}.reqNumber`)} placeholder="1" className="h-8 text-sm" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Solution / Corrective Action</Label>
                      <Textarea {...register(`requirements.${i}.solution`)}
                        placeholder="What was done to fix this violation..."
                        rows={2} className="text-sm resize-none" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CCCM License #</Label>
                      <Input {...register(`requirements.${i}.cccmNumber`)} placeholder="CCCM-XXXXX" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Certifying Mechanic (CCCM)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name (printed)</Label>
                <Input {...register('cccmName')} placeholder="John Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>CCCM License Expiry</Label>
                <Input {...register('cccmLicenseExpiry')} placeholder="MM/DD/YYYY" />
              </div>
              <div className="space-y-1.5">
                <Label>Authorized Signer Name</Label>
                <Input {...register('signerName')} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Signer Phone</Label>
                <Input {...register('signerPhone')} placeholder="(310) 555-0100" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* EU-787 extra inputs */}
      {formType === 'eu787' && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Test Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Test Date</Label>
              <Input {...register('testDate')} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>Test Time</Label>
              <Input {...register('testTime')} type="time" />
            </div>
            <div className="space-y-1.5">
              <Label>Mechanic Name (CCCM)</Label>
              <Input {...register('mechanicName')} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>CCCM License Number</Label>
              <Input {...register('mechanicLicenseNumber')} placeholder="CCCM-XXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>CCCM License Expiry</Label>
              <Input {...register('mechanicLicenseExpiry')} placeholder="MM/DD/YYYY" />
            </div>
            <div className="space-y-1.5">
              <Label>Group (II / III / IV)</Label>
              <Input {...register('group')} placeholder="IV" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>District Office</Label>
              <Input {...register('districtOffice')} placeholder="Cal/OSHA Los Angeles District Office" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual field overrides */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Additional Field Overrides</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                If a field wasn't auto-filled correctly, enter the exact PDF field name and the value you want.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline"
              onClick={() => appendExtra({ fieldName: '', value: '' })}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Field
            </Button>
          </div>
        </CardHeader>
        {extraFields.length > 0 && (
          <CardContent className="space-y-2">
            {extraFields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-5 gap-2 items-center">
                <div className="col-span-2">
                  <Input {...register(`extraFields.${i}.fieldName`)} placeholder="PDF field name" className="h-8 text-sm font-mono" />
                </div>
                <div className="col-span-2">
                  <Input {...register(`extraFields.${i}.value`)} placeholder="Value" className="h-8 text-sm" />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeExtra(i)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Flatten option */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Flatten form fields</p>
          <p className="text-xs text-muted-foreground">Makes the PDF non-editable after generation. Turn off if additional fields need to be filled manually.</p>
        </div>
        <Switch checked={flatten} onCheckedChange={setFlatten} />
      </div>

      {/* Generate */}
      <Button type="submit" disabled={isPending} className="w-full" size="lg">
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Filling Official Form…</>
          : `Generate ${formType.toUpperCase()} — Official Cal/OSHA Form`}
      </Button>

      {/* Result */}
      {pdfReady && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Official Form Generated</p>
              <p className="text-sm text-green-700">
                The official Cal/OSHA PDF has been filled with your data.
                Review carefully before sending.
              </p>
            </div>
          </div>

          {pdfReady.unfilledFields.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1 mb-1">
                <Info className="h-3.5 w-3.5" />
                {pdfReady.unfilledFields.length} field{pdfReady.unfilledFields.length !== 1 ? 's' : ''} could not be auto-filled
              </p>
              <p className="text-xs text-amber-700 mb-1">
                These fields exist in the official PDF but weren't matched to your data.
                You can fill them manually in Adobe Acrobat or use the field overrides above:
              </p>
              <div className="font-mono text-xs text-amber-800 space-y-0.5 max-h-24 overflow-y-auto">
                {pdfReady.unfilledFields.slice(0, 15).map(f => (
                  <div key={f}>• {f}</div>
                ))}
                {pdfReady.unfilledFields.length > 15 && (
                  <div className="text-amber-600">...and {pdfReady.unfilledFields.length - 15} more</div>
                )}
              </div>
            </div>
          )}

          <Button onClick={downloadPdf} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="mr-2 h-4 w-4" />
            Download {formType.toUpperCase()} PDF
          </Button>
        </div>
      )}
    </form>
  );
}
