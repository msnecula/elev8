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
import { createUser, updateUser } from '@/server/actions/users';
import { USER_ROLES } from '@/lib/validation/users';
import { ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/auth';
import { Loader2, Save, UserPlus } from 'lucide-react';

// Client-side mirror of adminUserSchema (the server re-validates everything).
const formSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required'),
    email: z.string().trim().email('Enter a valid email'),
    role: z.enum(USER_ROLES),
    phone: z.string().optional(),
    accountId: z.string().optional(),
    cccmLicense: z.string().optional(),
    qeiNumber: z.string().optional(),
  })
  .refine(v => v.role !== 'client' || !!v.accountId, {
    message: 'Select the company this client belongs to',
    path: ['accountId'],
  });

type FormValues = z.infer<typeof formSchema>;

const ROLE_HINTS: Record<UserRole, string> = {
  admin: 'Full access, including Settings and user management.',
  reviewer: 'Reviews notices and jobs.',
  dispatcher: 'Dispatches technicians and manages work orders and documents.',
  technician: 'Sees their assigned work. Their CCCM / QEI numbers fill in on Cal/OSHA forms.',
  client: 'Client portal only — their company’s jobs, proposals and notices.',
};

interface UserFormProps {
  accounts: Array<{ id: string; name: string }>;
  /** Present when editing; omitted on the Add User page. */
  user?: { id: string } & Partial<FormValues>;
  defaultRole?: UserRole;
  isSelf?: boolean;
  /** Where to go after adding a user; defaults to the new user's edit page. */
  returnTo?: string;
}

export default function UserForm({ accounts, user, defaultRole = 'dispatcher', isSelf = false, returnTo }: UserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!user;

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      role: user?.role ?? defaultRole,
      phone: user?.phone ?? '',
      accountId: user?.accountId ?? '',
      cccmLicense: user?.cccmLicense ?? '',
      qeiNumber: user?.qeiNumber ?? '',
    },
  });

  const role = watch('role');
  const accountId = watch('accountId');

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      if (isEdit) {
        const result = await updateUser(user.id, values);
        if (!result.success) { toast.error(result.error); return; }
        toast.success('User updated');
        reset(values);
        router.refresh();
        return;
      }

      const result = await createUser(values);
      if (!result.success) { toast.error(result.error); return; }
      if (result.data.inviteSent) {
        toast.success('User added', { description: `An invitation was emailed to ${values.email}.` });
      } else {
        toast.warning('User added, but the invitation email failed', {
          description: 'Open the user and click "Resend invite" to try again.',
        });
      }
      router.push(returnTo ?? `/settings/users/${result.data.userId}`);
    });
  }

  const fieldError = (name: keyof FormValues) =>
    errors[name] && <p className="text-xs text-destructive">{errors[name]?.message}</p>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-xl" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input id="fullName" {...register('fullName')} placeholder="Alex Johnson"
            className={errors.fullName ? 'border-destructive' : ''} />
          {fieldError('fullName')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...register('email')} placeholder="alex@company.com"
            className={errors.email ? 'border-destructive' : ''} />
          {fieldError('email')}
          {isEdit && (
            <p className="text-xs text-muted-foreground">This is also their sign-in email.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Role *</Label>
          <Select
            value={role}
            onValueChange={v => setValue('role', v as UserRole, { shouldDirty: true, shouldValidate: true })}
            disabled={isSelf}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {USER_ROLES.map(r => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {isSelf ? 'You can’t change your own role.' : ROLE_HINTS[role]}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">
            Phone <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input id="phone" type="tel" {...register('phone')} placeholder="310-555-0100" />
        </div>
      </div>

      {role === 'client' && (
        <div className="space-y-1.5">
          <Label>Company Account *</Label>
          <Select
            value={accountId || undefined}
            onValueChange={v => setValue('accountId', v, { shouldDirty: true, shouldValidate: true })}
          >
            <SelectTrigger className={errors.accountId ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select account…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError('accountId')}
        </div>
      )}

      {role === 'technician' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="cccmLicense">CCCM License #</Label>
            <Input id="cccmLicense" {...register('cccmLicense')} placeholder="e.g. 123456" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qeiNumber">QEI Number</Label>
            <Input id="qeiNumber" {...register('qeiNumber')} placeholder="Only if QEI certified" className="font-mono" />
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Optional — the technician can also add these from their own My Account page.
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending || (isEdit && !isDirty)}>
        {isPending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? 'Saving…' : 'Adding user…'}</>
        ) : isEdit ? (
          <><Save className="mr-2 h-4 w-4" />Save Changes</>
        ) : (
          <><UserPlus className="mr-2 h-4 w-4" />Add User &amp; Send Invite</>
        )}
      </Button>
    </form>
  );
}
