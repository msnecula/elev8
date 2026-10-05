'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { formatCurrency } from '@/lib/utils';
import { createProposal, generateProposalViaAction } from '@/server/actions/proposals';
import { Brain, Loader2, Plus, Trash2 } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(10, 'Body is required'),
  lineItems: z.array(z.object({
    id: z.string(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unit: z.string().min(1),
    unitPrice: z.coerce.number().nonnegative(),
    total: z.number(),
  })).default([]),
  templateId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;
interface Template { id: string; name: string }

export default function NewProposalForm({
  jobId, jobTitle, templates,
}: {
  jobId: string;
  jobTitle: string;
  templates: Template[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: `Proposal – ${jobTitle}`, body: '', lineItems: [] },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lineItems' });
  const lineItems = watch('lineItems');
  const templateId = watch('templateId');

  const total = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);

  async function handleAIDraft() {
    setIsGenerating(true);
    try {
      const result = await generateProposalViaAction(jobId, templateId || undefined);
      if (!result.success) { toast.error('AI generation failed', { description: result.error }); return; }
      setValue('title', result.data.title);
      setValue('body', result.data.body);
      replace(result.data.lineItems as FormValues['lineItems']);
      toast.success('Draft generated — review before creating');
    } finally {
      setIsGenerating(false);
    }
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createProposal({
        jobId,
        templateId: values.templateId || undefined,
        title: values.title,
        body: values.body,
        lineItems: values.lineItems,
        totalAmount: total,
      });
      if (result.success) {
        toast.success('Proposal created');
        router.push(`/proposals/${result.data.proposalId}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      {/* AI + template row */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Generate with AI</span>
            </div>
            <div className="flex items-center gap-2">
              {templates.length > 0 && (
                <Select onValueChange={v => setValue('templateId', v)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs bg-white">
                    <SelectValue placeholder="Template (optional)…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button type="button" size="sm" onClick={handleAIDraft} disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700 text-white">
                {isGenerating ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</> : <><Brain className="h-3.5 w-3.5 mr-1.5" />Draft with AI</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        <Label>Proposal Title</Label>
        <Input {...register('title')} className={errors.title ? 'border-destructive' : ''} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Proposal Letter</Label>
        <Textarea {...register('body')} rows={14} className={`font-mono text-sm resize-y ${errors.body ? 'border-destructive' : ''}`} placeholder="Write or generate proposal body…" />
        {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Line Items</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => append({ id: `li-${Date.now()}`, description: '', quantity: 1, unit: 'each', unitPrice: 0, total: 0 })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Line
          </Button>
        </div>
        {fields.map((field, i) => (
          <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-5"><Input {...register(`lineItems.${i}.description`)} placeholder="Description" className="h-8 text-sm" /></div>
            <div className="col-span-1"><Input {...register(`lineItems.${i}.quantity`)} type="number" min="0" step="0.5" placeholder="Qty" className="h-8 text-sm" /></div>
            <div className="col-span-2"><Input {...register(`lineItems.${i}.unit`)} placeholder="Unit" className="h-8 text-sm" /></div>
            <div className="col-span-2"><Input {...register(`lineItems.${i}.unitPrice`)} type="number" min="0" step="0.01" placeholder="Price" className="h-8 text-sm" /></div>
            <div className="col-span-1 text-right text-xs text-muted-foreground">
              {formatCurrency((Number(lineItems[i]?.quantity)||0)*(Number(lineItems[i]?.unitPrice)||0))}
            </div>
            <div className="col-span-1 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {fields.length > 0 && (
          <div className="flex justify-end pt-1">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{formatCurrency(total)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Creating…</> : 'Create Proposal'}
        </Button>
      </div>
    </form>
  );
}
