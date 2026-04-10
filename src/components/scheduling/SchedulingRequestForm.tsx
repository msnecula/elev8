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
import { requestScheduling } from '@/server/actions/scheduling';
import { Loader2, Calendar } from 'lucide-react';

const schema = z.object({
  preferredDate1: z.string().min(1, 'Please provide at least one preferred date'),
  preferredDate2: z.string().optional(),
  preferredDate3: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

// Minimum date = tomorrow
function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function SchedulingRequestForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await requestScheduling({ jobId, ...values });
      if (result.success) {
        toast.success('Scheduling request submitted!', {
          description: 'Our dispatcher will confirm your date within 1 business day.',
        });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const tomorrow = getTomorrow();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-md">
      {/* Preferred dates */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="date1" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            First Preferred Date *
          </Label>
          <Input
            id="date1"
            type="date"
            min={tomorrow}
            {...register('preferredDate1')}
            className={errors.preferredDate1 ? 'border-destructive' : ''}
          />
          {errors.preferredDate1 && (
            <p className="text-xs text-destructive">{errors.preferredDate1.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date2" className="text-muted-foreground">
            Second Preferred Date <span className="text-xs">(optional)</span>
          </Label>
          <Input id="date2" type="date" min={tomorrow} {...register('preferredDate2')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date3" className="text-muted-foreground">
            Third Preferred Date <span className="text-xs">(optional)</span>
          </Label>
          <Input id="date3" type="date" min={tomorrow} {...register('preferredDate3')} />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Notes for our team <span className="text-xs text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Time preferences, building access requirements, contacts on site, any other details…"
          rows={3}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
          : 'Submit Scheduling Request'}
      </Button>
    </form>
  );
}
