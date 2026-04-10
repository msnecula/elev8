'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import FileUploader from '@/components/shared/FileUploader';
import { registerNotice, triggerNoticeParsing } from '@/server/actions/notices';
import { Loader2, Brain } from 'lucide-react';

const schema = z.object({
  accountId: z.string().uuid('Please select an account'),
  propertyId: z.string().uuid().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Account { id: string; name: string }
interface Property { id: string; name: string; accountId: string }

export default function NoticeUploadForm({
  accounts, properties,
}: {
  accounts: Account[];
  properties: Property[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadResult, setUploadResult] = useState<{
    filePath: string; fileName: string; fileSize: number; mimeType: string;
  } | null>(null);
  const [noticeId, setNoticeId] = useState<string | null>(null);
  const [stage, setStage] = useState<'upload' | 'registered' | 'parsing' | 'done'>('upload');

  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const selectedAccountId = watch('accountId');
  const filteredProperties = properties.filter(p => p.accountId === selectedAccountId);

  function onSubmit(values: FormValues) {
    if (!uploadResult) { toast.error('Please upload a PDF first'); return; }
    startTransition(async () => {
      const result = await registerNotice({ accountId: values.accountId, propertyId: values.propertyId, ...uploadResult });
      if (!result.success) { toast.error(result.error); return; }
      setNoticeId(result.data.noticeId);
      setStage('registered');
      toast.success('Notice registered — click Parse with AI to extract data');
    });
  }

  function handleParse() {
    if (!noticeId) return;
    setStage('parsing');
    startTransition(async () => {
      const result = await triggerNoticeParsing(noticeId);
      if (!result.success) {
        toast.error('Parsing failed', { description: result.error });
        setStage('registered');
        return;
      }
      setStage('done');
      toast.success('Parsing complete!', { description: result.data.jobId ? 'Job created automatically.' : 'Notice parsed.' });
      router.push(`/notices/${noticeId}`);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {(stage === 'upload' || stage === 'registered') && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Account *</Label>
            <Select onValueChange={(v) => { setValue('accountId', v); setValue('propertyId', undefined); }}>
              <SelectTrigger className={errors.accountId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.accountId && <p className="text-xs text-destructive">{errors.accountId.message}</p>}
          </div>

          {selectedAccountId && filteredProperties.length > 0 && (
            <div className="space-y-1.5">
              <Label>Property <span className="text-muted-foreground">(optional)</span></Label>
              <Select onValueChange={(v) => setValue('propertyId', v)}>
                <SelectTrigger><SelectValue placeholder="Select property…" /></SelectTrigger>
                <SelectContent>
                  {filteredProperties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notice PDF *</Label>
            <FileUploader
              accountId={selectedAccountId || 'unknown'}
              onUploadComplete={setUploadResult}
              onError={(msg) => toast.error('Upload error', { description: msg })}
              disabled={!selectedAccountId}
            />
            {!selectedAccountId && <p className="text-xs text-muted-foreground">Select an account first.</p>}
          </div>

          <Button type="submit" disabled={isPending || !uploadResult || !selectedAccountId} className="w-full">
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering…</> : 'Register Notice'}
          </Button>
        </form>
      )}

      {(stage === 'registered' || stage === 'parsing') && noticeId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-800">Notice registered successfully</h3>
          </div>
          <p className="text-sm text-blue-700">
            Run AI parsing to extract violation items, deadlines, and create a linked job.
          </p>
          <Button onClick={handleParse} disabled={isPending || stage === 'parsing'}
            className="bg-blue-600 hover:bg-blue-700 text-white">
            {stage === 'parsing'
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Parsing with AI…</>
              : <><Brain className="mr-2 h-4 w-4" />Parse with AI</>}
          </Button>
          <p className="text-xs text-blue-600">
            Or <a href={`/notices/${noticeId}`} className="underline">view the notice</a> and parse later.
          </p>
        </div>
      )}
    </div>
  );
}
