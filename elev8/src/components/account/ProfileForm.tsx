'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { updateMyProfile } from '@/server/actions/account';
import { Loader2, Save } from 'lucide-react';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  phone: z.string().optional(),
});
type Values = z.infer<typeof schema>;

interface ProfileFormProps {
  fullName: string;
  phone: string | null;
}

export default function ProfileForm({ fullName, phone }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName, phone: phone ?? '' },
  });

  function onSubmit(values: Values) {
    startTransition(async () => {
      const result = await updateMyProfile(values);
      if (!result.success) { toast.error(result.error); return; }
      toast.success('Profile saved');
      reset(values);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" {...register('fullName')} className={errors.fullName ? 'border-destructive' : ''} />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" {...register('phone')} placeholder="310-555-0100" />
        </div>
      </div>
      <Button type="submit" disabled={isPending || !isDirty}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save Profile
      </Button>
    </form>
  );
}
