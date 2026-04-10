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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { formatCurrency } from '@/lib/utils';
import { updateProposal, generateProposalViaAction } from '@/server/actions/proposals';
import { Brain, Loader2, Plus, Trash2, Save } from 'lucide-react';

const lineItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  unitPrice: z.coerce.number().nonnegative(),
  total: z.number(),
});

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(10, 'Body is required'),
  lineItems: z.array(lineItemSchema),
});

type FormValues = z.infer<typeof formSchema>;

interface Template { id: string; name: string }
interface LineItem { id: string; description: string; quantity: number; unit: string; unitPrice: number; total: number }

interface ProposalEditorProps {
  proposalId: string;
  jobId: string;
  initialTitle: string;
  initialBody: string;
  initialLineItems: LineItem[];
  initialTotal: number;
  templates: Template[];
  templateId?: string;
}

export default function ProposalEditor({
  proposalId, jobId, initialTitle, initialBody,
  initialLineItems, initialTotal, templates, templateId,
}: ProposalEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(templateId ?? '');

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialTitle,
      body: initialBody,
      lineItems: initialLineItems.length > 0 ? initialLineItems : [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lineItems' });
  const lineItems = watch('lineItems');

  // Recalculate total when line items change
  const total = lineItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0);

  function handleQuantityOrPriceChange(index: number) {
    const item = lineItems[index];
    if (item) {
      const newTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      setValue(`lineItems.${index}.total`, newTotal);
    }
  }

  function addLineItem() {
    append({
      id: `li-${Date.now()}`,
      description: '',
      quantity: 1,
      unit: 'each',
      unitPrice: 0,
      total: 0,
    });
  }

  async function handleAIDraft() {
    setIsGenerating(true);
    try {
      const result = await generateProposalViaAction(jobId, selectedTemplate || undefined);
      if (!result.success) {
        toast.error('AI generation failed', { description: result.error });
        return;
      }
      setValue('title', result.data.title, { shouldDirty: true });
      setValue('body', result.data.body, { shouldDirty: true });
      replace(result.data.lineItems as LineItem[]);
      toast.success('AI draft generated — review and edit before saving');
    } catch (err) {
      toast.error('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updateProposal({
        id: proposalId,
        title: values.title,
        body: values.body,
        lineItems: values.lineItems,
        totalAmount: total,
      });
      if (result.success) {
        toast.success('Proposal saved');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* AI generation panel */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">AI Proposal Draft</span>
              <span className="text-xs text-blue-600">Generate from notice data</span>
            </div>
            <div className="flex items-center gap-2">
              {templates.length > 0 && (
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="w-[180px] h-8 text-xs bg-white">
                    <SelectValue placeholder="Select template…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No template</SelectItem>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleAIDraft}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isGenerating
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</>
                  : <><Brain className="h-3.5 w-3.5 mr-1.5" />Draft with AI</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Proposal Title</Label>
        <Input id="title" {...register('title')} className={errors.title ? 'border-destructive' : ''} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <Label htmlFor="body">Proposal Letter</Label>
        <Textarea
          id="body"
          {...register('body')}
          rows={16}
          className={`font-mono text-sm resize-y ${errors.body ? 'border-destructive' : ''}`}
          placeholder="Proposal body text…"
        />
        {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
      </div>

      {/* Line items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Pricing / Line Items</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={addLineItem}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No line items yet. Use AI Draft or add manually.
            </p>
          ) : (
            <>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <Input
                      {...register(`lineItems.${index}.description`)}
                      placeholder="Description"
                      className="text-sm h-8"
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      {...register(`lineItems.${index}.quantity`)}
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Qty"
                      className="text-sm h-8"
                      onChange={(e) => {
                        register(`lineItems.${index}.quantity`).onChange(e);
                        setTimeout(() => handleQuantityOrPriceChange(index), 0);
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      {...register(`lineItems.${index}.unit`)}
                      placeholder="Unit"
                      className="text-sm h-8"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      {...register(`lineItems.${index}.unitPrice`)}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      className="text-sm h-8"
                      onChange={(e) => {
                        register(`lineItems.${index}.unitPrice`).onChange(e);
                        setTimeout(() => handleQuantityOrPriceChange(index), 0);
                      }}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end pt-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatCurrency((Number(lineItems[index]?.quantity) || 0) * (Number(lineItems[index]?.unitPrice) || 0))}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-2 border-t border-border">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(total)}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || (!isDirty && fields.length === 0)}>
          {isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-1.5" />Save Proposal</>}
        </Button>
      </div>
    </form>
  );
}
