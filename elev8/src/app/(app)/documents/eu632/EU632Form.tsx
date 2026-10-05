'use client';

import { useState, useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { generateEU632 } from '@/server/actions/documents';
import { Loader2, Download, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

interface Props {
  noticeId: string;
  parsedData: ParsedNoticeData | null;
  prefilledRequirements: Array<{
    reqNumber: string;
    solution: string;
    cccmNumber: string;
    violation: string;
  }>;
}

export default function EU632Form({ noticeId, parsedData, prefilledRequirements }: Props) {
  const [isPending, startTransition] = useTransition();
  const [pdfReady, setPdfReady] = useState<{ base64: string; filename: string } | null>(null);

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: {
      requirements: prefilledRequirements.length > 0
        ? prefilledRequirements.map(r => ({
            reqNumber: r.reqNumber,
            solution: '',
            cccmNumber: '',
          }))
        : [{ reqNumber: '1', solution: '', cccmNumber: '' }],
      cccmName: '',
      cccmLicenseExpiry: '',
      signerName: '',
      signerTitle: '',
      signerPhone: '',
      signerOfficeLocation: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'requirements' });

  function onSubmit(values: any) {
    startTransition(async () => {
      const result = await generateEU632({
        noticeId,
        requirements: values.requirements,
        cccmName: values.cccmName,
        cccmLicenseExpiry: values.cccmLicenseExpiry,
        signerName: values.signerName,
        signerTitle: values.signerTitle,
        signerPhone: values.signerPhone,
        signerOfficeLocation: values.signerOfficeLocation,
      });

      if (result.success) {
        setPdfReady({ base64: result.data.pdfBase64, filename: result.data.filename });
        toast.success('EU-632 generated — review and download below');
      } else {
        toast.error(result.error);
      }
    });
  }

  function downloadPdf() {
    if (!pdfReady) return;
    const byteCharacters = atob(pdfReady.base64);
    const byteNumbers = Array.from(byteCharacters).map(c => c.charCodeAt(0));
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfReady.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Violations reference */}
      {parsedData?.violationItems && parsedData.violationItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Violations from Preliminary Order (reference)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {parsedData.violationItems.map((v, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="bg-amber-200 text-amber-900 rounded px-1.5 py-0.5 text-xs font-bold shrink-0">#{i + 1}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Requirements */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Requirements — Corrective Actions Taken</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ reqNumber: '', solution: '', cccmNumber: '' })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Requirement
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, i) => (
            <div key={field.id} className="rounded-lg border border-border p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Requirement {i + 1}
                </span>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Req. # from PO</Label>
                  <Input
                    {...register(`requirements.${i}.reqNumber`)}
                    placeholder="1"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Solution / Corrective Action Taken</Label>
                  <Textarea
                    {...register(`requirements.${i}.solution`)}
                    placeholder="Describe exactly what was done to correct this violation..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CCCM License #</Label>
                  <Input
                    {...register(`requirements.${i}.cccmNumber`)}
                    placeholder="CCCM-XXXXX"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Certifying mechanic */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Certifying Mechanic (CCCM)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name (printed)</Label>
            <Input {...register('cccmName', { required: true })} placeholder="John Smith" />
          </div>
          <div className="space-y-1.5">
            <Label>CCCM License Expiry Date</Label>
            <Input {...register('cccmLicenseExpiry', { required: true })} placeholder="MM/DD/YYYY" />
          </div>
        </CardContent>
      </Card>

      {/* Company signer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Authorized Company Representative</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input {...register('signerName', { required: true })} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input {...register('signerTitle')} placeholder="Operations Manager" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...register('signerPhone', { required: true })} placeholder="(310) 555-0100" />
          </div>
          <div className="space-y-1.5">
            <Label>Office Location</Label>
            <Input {...register('signerOfficeLocation')} placeholder="Los Angeles, CA" />
          </div>
        </CardContent>
      </Card>

      {/* Generate button */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isPending} className="flex-1" size="lg">
          {isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating EU-632…</>
            : 'Generate EU-632 PDF'}
        </Button>
      </div>

      {/* Download section */}
      {pdfReady && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">EU-632 Generated</p>
              <p className="text-sm text-green-700">
                Review the PDF carefully before sending to the Cal/OSHA district office.
                The CCCM must sign the physical form before submission.
              </p>
            </div>
          </div>
          <Button onClick={downloadPdf} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="mr-2 h-4 w-4" />
            Download EU-632 PDF
          </Button>
          <p className="text-xs text-green-700">
            ⚠ Submit to the Cal/OSHA district office that issued the Preliminary Order.
            Retain a signed copy for your records.
          </p>
        </div>
      )}
    </form>
  );
}
