'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { emailChangeSchema, type EmailChangeInput } from '@/lib/validation/users';
import { requestEmailChange } from '@/server/actions/account';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { Loader2, Mail, MailCheck } from 'lucide-react';

export default function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmailChangeInput>({
    resolver: zodResolver(emailChangeSchema),
  });

  function onSubmit(values: EmailChangeInput) {
    startTransition(async () => {
      const result = await requestEmailChange(values);
      if (!result.success) { toast.error(result.error); return; }
      setSentTo(values.newEmail.trim().toLowerCase());
      reset({ newEmail: '' });
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="currentEmail">Current email</Label>
        <Input id="currentEmail" value={currentEmail} disabled readOnly />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newEmail">New email</Label>
        <Input id="newEmail" type="email" autoComplete="email" placeholder="you@company.com"
          {...register('newEmail')} className={errors.newEmail ? 'border-destructive' : ''} />
        {errors.newEmail && <p className="text-xs text-destructive">{errors.newEmail.message}</p>}
      </div>

      {sentTo && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <MailCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            We sent a confirmation link to <strong>{sentTo}</strong>. Your email changes once you click it
            (within 24 hours). Until then, keep signing in with {currentEmail}.
          </span>
        </div>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
        Send Confirmation Link
      </Button>
    </form>
  );
}
