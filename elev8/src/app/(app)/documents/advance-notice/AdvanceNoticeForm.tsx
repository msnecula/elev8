'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { generate48HourNotice } from '@/server/actions/documents';
import { Loader2, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

interface Props {
  noticeId?: string;
  workOrderId?: string | null;
  parsedData: ParsedNoticeData | null;
  scheduledStart: string | null;
  natureOfWork: string;
}

export default function AdvanceNoticeForm({
  noticeId, workOrderId, parsedData, scheduledStart, natureOfWork,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [pdfReady, setPdfReady] = useState<{ base64: string; filename: string } | null>(null);

  const defaultDate = scheduledStart
    ? new Date(scheduledStart).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const defaultTime = scheduledStart
    ? new Date(scheduledStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  const { register, handleSubmit } = useForm({
    defaultValues: {
      recipientName: 'District Manager',
      recipientCompany: 'Cal/OSHA Elevator Unit — District Office',
      recipientAddress: '',
      mechanicName: '',
      mechanicLicenseNumber: '',
      contactName: '',
      contactPhone: '',
    },
  });

  function onSubmit(values: any) {
    if (!workOrderId && !noticeId) {
      toast.error('No work order or notice specified');
      return;
    }

    startTransition(async () => {
      // For notices without a work order, we use a simplified approach
      const id = workOrderId ?? 'none';

      const result = await generate48HourNotice({
        workOrderId: id,
        recipientName: values.recipientName,
        recipientCompany: values.recipientCompany,
        recipientAddress: values.recipientAddress,
        mechanicName: values.mechanicName,
        mechanicLicenseNumber: values.mechanicLicenseNumber,
        contactName: values.contactName,
        contactPhone: values.contactPhone,
      });

      if (result.success) {
        setPdfReady({ base64: result.data.pdfBase64, filename: result.data.filename });
        toast.success('48-Hour Notice generated — review before sending');
      } else {
        toast.error(result.error);
      }
    });
  }

  function downloadPdf() {
    if (!pdfReady) return;
    const byteCharacters = atob(pdfReady.base64);
    const blob = new Blob([new Uint8Array([...byteCharacters].map(c => c.charCodeAt(0)))], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfReady.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Recipient */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recipient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Recipient Name / Attention</Label>
              <Input {...register('recipientName')} placeholder="District Manager" />
            </div>
            <div className="space-y-1.5">
              <Label>Recipient Company / Agency</Label>
              <Input {...register('recipientCompany')} placeholder="Cal/OSHA Elevator Unit" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Recipient Address</Label>
            <Textarea
              {...register('recipientAddress')}
              placeholder="Cal/OSHA District Office address&#10;Street, City, State ZIP"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Find your district office at: dir.ca.gov/dosh → District Offices
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Work details — pre-filled from parsed data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Work Details (pre-filled — verify before generating)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">Property</p><p className="font-medium">{parsedData?.propertyName || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">State ID</p><p className="font-bold text-blue-700">{parsedData?.equipmentId || '—'}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Scheduled Date</p>
              <p className="font-medium">{defaultDate || 'Not yet scheduled'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Scheduled Time</p>
              <p>{defaultTime || '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nature of Work</p>
            <p>{natureOfWork || parsedData?.requiredWorkSummary || '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Mechanic */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Assigned Mechanic (CCCM)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Mechanic Full Name</Label>
            <Input {...register('mechanicName', { required: true })} placeholder="John Smith" />
          </div>
          <div className="space-y-1.5">
            <Label>CCCM License Number</Label>
            <Input {...register('mechanicLicenseNumber', { required: true })} placeholder="CCCM-XXXXX" />
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Company Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Contact Name</Label>
            <Input {...register('contactName', { required: true })} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Phone</Label>
            <Input {...register('contactPhone', { required: true })} placeholder="(310) 555-0100" />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-full" size="lg">
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating Notice…</>
          : 'Generate 48-Hour Advance Notice PDF'}
      </Button>

      {pdfReady && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Notice Generated</p>
              <p className="text-sm text-green-700">Review carefully. Send at least 48 hours before scheduled work.</p>
            </div>
          </div>
          <Button onClick={downloadPdf} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="mr-2 h-4 w-4" />Download 48-Hour Notice PDF
          </Button>
          <div className="text-xs text-green-700 space-y-0.5">
            <p>⚠ Send to: Cal/OSHA district office + building owner/property manager + compliance company (if required)</p>
            <p>⚠ Retain proof of delivery (email receipt, fax confirmation, or certified mail receipt)</p>
          </div>
        </div>
      )}
    </form>
  );
}
