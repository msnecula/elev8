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
import { toast } from '@/lib/toast';
import { confirmScheduling } from '@/server/actions/scheduling';
import { Loader2, CheckCircle2 } from 'lucide-react';

const schema = z.object({
  confirmedStartDate: z.string().min(1, 'Start date is required'),
  confirmedEndDate: z.string().min(1, 'End date is required'),
  buildingAccessNotes: z.string().max(1000).optional(),
  complianceCoordinationNotes: z.string().max(1000).optional(),
}).refine(
  (d) => new Date(d.confirmedEndDate) > new Date(d.confirmedStartDate),
  { message: 'End time must be after start time', path: ['confirmedEndDate'] },
);

type FormValues = z.infer<typeof schema>;

interface ConfirmDateFormProps {
  requestId: string;
  preferredDate1?: string | null;
  preferredDate2?: string | null;
  preferredDate3?: string | null;
  notes?: string | null;
  complianceRequired?: boolean;
  onConfirmed?: () => void;
}

export default function ConfirmDateForm({
  requestId, preferredDate1, preferredDate2, preferredDate3,
  notes, complianceRequired, onConfirmed,
}: ConfirmDateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Pre-fill with first preferred date if available
  const defaultStart = preferredDate1
    ? `${preferredDate1}T08:00`
    : '';
  const defaultEnd = preferredDate1
    ? `${preferredDate1}T17:00`
    : '';

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      confirmedStartDate: defaultStart,
      confirmedEndDate: defaultEnd,
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await confirmScheduling({
        requestId,
        confirmedStartDate: new Date(values.confirmedStartDate).toISOString(),
        confirmedEndDate: new Date(values.confirmedEndDate).toISOString(),
        buildingAccessNotes: values.buildingAccessNotes,
        complianceCoordinationNotes: values.complianceCoordinationNotes,
      });

      if (result.success) {
        toast.success('Date confirmed — client has been notified by email');
        onConfirmed?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Client's preferred dates for reference */}
      {(preferredDate1 || preferredDate2 || preferredDate3) && (
        <div className="p-3 bg-muted/50 rounded-md text-xs space-y-1">
          <p className="font-medium text-muted-foreground uppercase tracking-wide">Client Preferred Dates</p>
          {preferredDate1 && <p>1st: {preferredDate1}</p>}
          {preferredDate2 && <p>2nd: {preferredDate2}</p>}
          {preferredDate3 && <p>3rd: {preferredDate3}</p>}
          {notes && <p className="mt-1 italic text-muted-foreground">"{notes}"</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Confirmed Start *</Label>
          <Input
            id="startDate"
            type="datetime-local"
            {...register('confirmedStartDate')}
            className={errors.confirmedStartDate ? 'border-destructive' : ''}
          />
          {errors.confirmedStartDate && (
            <p className="text-xs text-destructive">{errors.confirmedStartDate.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endDate">Confirmed End *</Label>
          <Input
            id="endDate"
            type="datetime-local"
            {...register('confirmedEndDate')}
            className={errors.confirmedEndDate ? 'border-destructive' : ''}
          />
          {errors.confirmedEndDate && (
            <p className="text-xs text-destructive">{errors.confirmedEndDate.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accessNotes">
          Building Access Notes <span className="text-xs text-muted-foreground">(sent to client)</span>
        </Label>
        <Textarea
          id="accessNotes"
          {...register('buildingAccessNotes')}
          placeholder="Parking, entry codes, who to contact on arrival…"
          rows={2}
        />
      </div>

      {complianceRequired && (
        <div className="space-y-1.5">
          <Label htmlFor="complianceNotes">
            Compliance Coordination Notes
          </Label>
          <Textarea
            id="complianceNotes"
            {...register('complianceCoordinationNotes')}
            placeholder="Notes for compliance company coordination…"
            rows={2}
          />
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full bg-green-600 hover:bg-green-700 text-white">
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming…</>
          : <><CheckCircle2 className="mr-2 h-4 w-4" />Confirm Date & Notify Client</>}
      </Button>
    </form>
  );
}
