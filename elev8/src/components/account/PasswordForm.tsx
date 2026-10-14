'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { passwordSchema } from '@/lib/validation/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { KeyRound, Loader2 } from 'lucide-react';
import type { z } from 'zod';

type Values = z.infer<typeof passwordSchema>;

export default function PasswordForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(passwordSchema),
  });

  async function onSubmit({ password }: Values) {
    const { error } = await createClient().auth.updateUser({ password });
    if (error) { toast.error(error.message); return; }
    toast.success('Password changed');
    reset({ password: '', confirmPassword: '' });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')}
            className={errors.password ? 'border-destructive' : ''} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')}
            className={errors.confirmPassword ? 'border-destructive' : ''} />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
        Change Password
      </Button>
    </form>
  );
}
