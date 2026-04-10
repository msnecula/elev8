'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { inviteClient } from '@/server/actions/notifications';
import { Loader2, UserPlus } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Invalid email'),
  fullName: z.string().min(2, 'Full name required'),
  accountId: z.string().uuid('Please select an account'),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;
interface Account { id: string; name: string }

export default function InviteClientForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await inviteClient(values);
      if (result.success) {
        toast.success('Invitation sent!', {
          description: `${values.email} has been invited and will receive a login link.`,
        });
        reset();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            {...register('fullName')}
            placeholder="Alex Johnson"
            className={errors.fullName ? 'border-destructive' : ''}
          />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="alex@company.com"
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Account *</Label>
        <Select onValueChange={v => setValue('accountId', v)}>
          <SelectTrigger className={errors.accountId ? 'border-destructive' : ''}>
            <SelectValue placeholder="Select account…" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.accountId && <p className="text-xs text-destructive">{errors.accountId.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">
          Phone <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          {...register('phone')}
          placeholder="310-555-0100"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending invitation…</>
          : <><UserPlus className="mr-2 h-4 w-4" />Send Invitation</>}
      </Button>
    </form>
  );
}
