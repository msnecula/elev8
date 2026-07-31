'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { createAccount, updateAccount } from '@/server/actions/accountActions';
import { Plus, Pencil, Loader2, Building2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Account name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Account {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface Props {
  mode: 'add' | 'edit';
  account?: Account;
}

export default function AccountActions({ mode, account }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account?.name ?? '',
      email: account?.email ?? '',
      phone: account?.phone ?? '',
      address: account?.address ?? '',
      city: account?.city ?? '',
      state: account?.state ?? 'CA',
      zip: account?.zip ?? '',
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = mode === 'add'
        ? await createAccount(values)
        : await updateAccount(account!.id, values);

      if (result.success) {
        toast.success(mode === 'add' ? 'Account created' : 'Account updated');
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(result.error ?? 'Something went wrong');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === 'add' ? (
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Account
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            {mode === 'add' ? 'Add New Account' : `Edit — ${account?.name}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Account / Company Name *</Label>
            <Input
              {...register('name')}
              placeholder="Westside Properties LLC"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                {...register('email')}
                type="email"
                placeholder="ops@company.com"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register('phone')} placeholder="(310) 555-0100" />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label>Street Address</Label>
            <Input {...register('address')} placeholder="9999 Wilshire Blvd Ste 400" />
          </div>

          {/* City / State / Zip */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-3 space-y-1.5">
              <Label>City</Label>
              <Input {...register('city')} placeholder="Los Angeles" />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input {...register('state')} placeholder="CA" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Zip</Label>
              <Input {...register('zip')} placeholder="90025" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{mode === 'add' ? 'Creating…' : 'Saving…'}</>
                : mode === 'add' ? 'Create Account' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
