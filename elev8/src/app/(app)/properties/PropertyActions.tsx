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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { createProperty, updateProperty, deleteProperty } from '@/server/actions/properties';
import { Plus, Pencil, Loader2, Trash2 } from 'lucide-react';

const schema = z.object({
  accountId: z.string().uuid('Account is required'),
  name: z.string().min(1, 'Property name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2).max(2).default('CA'),
  zip: z.string().optional(),
  buildingType: z.enum(['commercial', 'residential', 'mixed_use', 'industrial', 'government']),
  elevatorCount: z.coerce.number().int().min(0).default(1),
});

type FormValues = z.infer<typeof schema>;

interface Account { id: string; name: string }
interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string | null;
  zip: string | null;
  buildingType: string | null;
  elevatorCount: number | null;
  accountId: string;
}

interface Props {
  mode: 'add' | 'edit';
  accounts: Account[];
  property?: Property;
  defaultAccountId?: string;
}

const BUILDING_TYPES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'residential', label: 'Residential' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'government', label: 'Government' },
];

export default function PropertyActions({ mode, accounts, property, defaultAccountId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountId: property?.accountId ?? defaultAccountId ?? '',
      name: property?.name ?? '',
      address: property?.address ?? '',
      city: property?.city ?? '',
      state: property?.state ?? 'CA',
      zip: property?.zip ?? '',
      buildingType: (property?.buildingType as any) ?? 'commercial',
      elevatorCount: property?.elevatorCount ?? 1,
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = mode === 'add'
        ? await createProperty(values)
        : await updateProperty(property!.id, values);

      if (result.success) {
        toast.success(mode === 'add' ? 'Property added' : 'Property updated');
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!property) return;
    startDelete(async () => {
      const result = await deleteProperty(property.id);
      if (result.success) {
        toast.success('Property deleted');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === 'add' ? (
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Property
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add Property' : `Edit — ${property?.name}`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Account */}
          <div className="space-y-1.5">
            <Label>Account *</Label>
            <Select
              defaultValue={property?.accountId ?? defaultAccountId ?? ''}
              onValueChange={v => setValue('accountId', v)}
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
            {errors.accountId && <p className="text-xs text-destructive">{errors.accountId.message}</p>}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Property Name *</Label>
            <Input {...register('name')} placeholder="Westside Plaza" className={errors.name ? 'border-destructive' : ''} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label>Street Address *</Label>
            <Input {...register('address')} placeholder="1200 Wilshire Blvd" className={errors.address ? 'border-destructive' : ''} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>

          {/* City / State / Zip */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-3 space-y-1.5">
              <Label>City *</Label>
              <Input {...register('city')} placeholder="Los Angeles" className={errors.city ? 'border-destructive' : ''} />
            </div>
            <div className="col-span-1 space-y-1.5">
              <Label>State</Label>
              <Input {...register('state')} placeholder="CA" maxLength={2} />
            </div>
            <div className="col-span-1 space-y-1.5">
              <Label>Zip</Label>
              <Input {...register('zip')} placeholder="90025" />
            </div>
          </div>

          {/* Building type + elevator count */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Building Type</Label>
              <Select
                defaultValue={property?.buildingType ?? 'commercial'}
                onValueChange={v => setValue('buildingType', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUILDING_TYPES.map(bt => (
                    <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Elevator Count</Label>
              <Input
                {...register('elevatorCount')}
                type="number"
                min="0"
                max="999"
                placeholder="1"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {mode === 'edit' && (
              <>
                {!confirmDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive">Confirm delete?</span>
                    <Button type="button" size="sm" variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                      {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Yes, delete'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                )}
              </>
            )}
            <div className={`flex gap-2 ${mode === 'add' ? 'ml-auto' : ''}`}>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{mode === 'add' ? 'Adding…' : 'Saving…'}</>
                  : mode === 'add' ? 'Add Property' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
