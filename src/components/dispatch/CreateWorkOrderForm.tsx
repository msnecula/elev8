'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/lib/toast';
import { createWorkOrder } from '@/server/actions/dispatch';
import { REGIONS, SKILL_TAGS } from '@/lib/constants';
import { Loader2, ClipboardList } from 'lucide-react';

const schema = z.object({
  scheduledStart: z.string().min(1, 'Start date/time is required'),
  scheduledEnd: z.string().min(1, 'End date/time is required'),
  region: z.string().min(1, 'Region is required'),
  requiredSkillTag: z.string().min(1, 'Skill tag is required'),
  dispatchNotes: z.string().max(2000).optional(),
  fortyEightHourNoticeRequired: z.boolean().default(false),
}).refine(
  d => new Date(d.scheduledEnd) > new Date(d.scheduledStart),
  { message: 'End time must be after start time', path: ['scheduledEnd'] },
);

type FormValues = z.infer<typeof schema>;

interface CreateWorkOrderFormProps {
  jobId: string;
  schedulingRequestId?: string;
  defaultSkillTag?: string;
  fortyEightHourRequired?: boolean;
  confirmedStart?: string | null;
  confirmedEnd?: string | null;
  onCreated?: (workOrderId: string) => void;
}

function toDatetimeLocal(d: Date | string | null | undefined) {
  if (!d) return '';
  const dt = new Date(d);
  const offset = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
}

export default function CreateWorkOrderForm({
  jobId, schedulingRequestId, defaultSkillTag,
  fortyEightHourRequired, confirmedStart, confirmedEnd, onCreated,
}: CreateWorkOrderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      scheduledStart: confirmedStart ? toDatetimeLocal(confirmedStart) : '',
      scheduledEnd: confirmedEnd ? toDatetimeLocal(confirmedEnd) : '',
      region: '',
      requiredSkillTag: defaultSkillTag ?? '',
      fortyEightHourNoticeRequired: fortyEightHourRequired ?? false,
    },
  });

  const fortyEight = watch('fortyEightHourNoticeRequired');

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createWorkOrder({
        jobId,
        schedulingRequestId,
        scheduledStart: new Date(values.scheduledStart).toISOString(),
        scheduledEnd: new Date(values.scheduledEnd).toISOString(),
        region: values.region,
        requiredSkillTag: values.requiredSkillTag,
        dispatchNotes: values.dispatchNotes,
        fortyEightHourNoticeRequired: values.fortyEightHourNoticeRequired,
      });

      if (result.success) {
        toast.success('Work order created');
        onCreated?.(result.data.workOrderId);
        router.push(`/work-orders/${result.data.workOrderId}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="start">Scheduled Start *</Label>
          <Input
            id="start"
            type="datetime-local"
            {...register('scheduledStart')}
            className={errors.scheduledStart ? 'border-destructive' : ''}
          />
          {errors.scheduledStart && <p className="text-xs text-destructive">{errors.scheduledStart.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">Scheduled End *</Label>
          <Input
            id="end"
            type="datetime-local"
            {...register('scheduledEnd')}
            className={errors.scheduledEnd ? 'border-destructive' : ''}
          />
          {errors.scheduledEnd && <p className="text-xs text-destructive">{errors.scheduledEnd.message}</p>}
        </div>
      </div>

      {/* Region + Skill */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Region *</Label>
          <Select onValueChange={v => setValue('region', v)} defaultValue="">
            <SelectTrigger className={errors.region ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select region…" />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.region && <p className="text-xs text-destructive">{errors.region.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Required Skill *</Label>
          <Select
            onValueChange={v => setValue('requiredSkillTag', v)}
            defaultValue={defaultSkillTag ?? ''}
          >
            <SelectTrigger className={errors.requiredSkillTag ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select skill…" />
            </SelectTrigger>
            <SelectContent>
              {SKILL_TAGS.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.requiredSkillTag && <p className="text-xs text-destructive">{errors.requiredSkillTag.message}</p>}
        </div>
      </div>

      {/* 48-hour notice toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium">48-Hour Advance Notice Required</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Toggle on if California regulations require advance notice before work begins
          </p>
        </div>
        <Switch
          checked={fortyEight}
          onCheckedChange={v => setValue('fortyEightHourNoticeRequired', v)}
        />
      </div>

      {fortyEight && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          The 48-hour notice deadline will be automatically calculated when the work order is saved.
          The dispatch will be held if the notice deadline passes without being sent.
        </div>
      )}

      {/* Dispatch notes */}
      <div className="space-y-1.5">
        <Label>Dispatch Notes <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea
          {...register('dispatchNotes')}
          placeholder="Special instructions, access notes, equipment needed…"
          rows={3}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
          : <><ClipboardList className="mr-2 h-4 w-4" />Create Work Order</>}
      </Button>
    </form>
  );
}
