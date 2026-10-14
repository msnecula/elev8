'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { updateMyLicenses } from '@/server/actions/account';
import { Loader2, Save } from 'lucide-react';

type Values = { cccmLicense: string; qeiNumber: string };

export default function LicensesForm({ cccmLicense, qeiNumber }: { cccmLicense: string | null; qeiNumber: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<Values>({
    defaultValues: { cccmLicense: cccmLicense ?? '', qeiNumber: qeiNumber ?? '' },
  });

  function onSubmit(values: Values) {
    startTransition(async () => {
      const result = await updateMyLicenses(values);
      if (!result.success) { toast.error(result.error); return; }
      toast.success('License numbers saved');
      reset(values);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cccmLicense">CCCM License #</Label>
          <Input id="cccmLicense" {...register('cccmLicense')} placeholder="e.g. 123456" className="font-mono" />
          <p className="text-xs text-muted-foreground">Your California Certified Competent Conveyance Mechanic number.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qeiNumber">QEI Number</Label>
          <Input id="qeiNumber" {...register('qeiNumber')} placeholder="Only if QEI certified" className="font-mono" />
          <p className="text-xs text-muted-foreground">Leave blank if you don&apos;t hold a QEI certification.</p>
        </div>
      </div>
      <Button type="submit" disabled={isPending || !isDirty}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save License Numbers
      </Button>
    </form>
  );
}
