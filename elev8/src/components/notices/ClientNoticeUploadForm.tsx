'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import FileUploader from '@/components/shared/FileUploader';
import { registerNotice, triggerNoticeParsing } from '@/server/actions/notices';
import { Loader2, CheckCircle2 } from 'lucide-react';

const schema = z.object({
  propertyId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Property { id: string; name: string; address: string }

export default function ClientNoticeUploadForm({
  accountId, properties,
}: {
  accountId: string;
  properties: Property[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadResult, setUploadResult] = useState<{
    filePath: string; fileName: string; fileSize: number; mimeType: string;
  } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function onSubmit(values: FormValues) {
    if (!uploadResult) { toast.error('Please upload a PDF first'); return; }
    startTransition(async () => {
      const result = await registerNotice({ accountId, propertyId: values.propertyId, ...uploadResult });
      if (!result.success) { toast.error(result.error); return; }
      triggerNoticeParsing(result.data.noticeId).catch(console.error);
      setSubmitted(true);
      toast.success('Notice submitted! Our team will review it shortly.');
    });
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <h3 className="font-semibold text-green-800">Notice submitted successfully</h3>
        <p className="text-sm text-green-700">Our team will review it within 1 business day.</p>
        <Button variant="outline" onClick={() => router.push('/client/jobs')} className="mt-2">View My Jobs</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
      {properties.length > 0 && (
        <div className="space-y-1.5">
          <Label>Property <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Select onValueChange={(v) => setValue('propertyId', v)}>
            <SelectTrigger><SelectValue placeholder="Select property…" /></SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name} — {p.address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Order to Comply PDF *</Label>
        <FileUploader
          accountId={accountId}
          onUploadComplete={setUploadResult}
          onError={(msg) => toast.error('Upload error', { description: msg })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Additional notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea {...register('notes')} placeholder="Any context for our team…" rows={3} />
      </div>
      <Button type="submit" disabled={isPending || !uploadResult} className="w-full">
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : 'Submit Notice'}
      </Button>
    </form>
  );
}
