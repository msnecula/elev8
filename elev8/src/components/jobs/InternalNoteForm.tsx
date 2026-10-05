'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { addJobNote } from '@/server/actions/jobs';
import { Loader2, StickyNote } from 'lucide-react';

const schema = z.object({ note: z.string().min(1, 'Note cannot be empty').max(5000) });
type FormValues = z.infer<typeof schema>;

export default function InternalNoteForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await addJobNote({ jobId, note: values.note });
      if (result.success) {
        toast.success('Note added');
        reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <StickyNote className="h-4 w-4 mr-1.5" />
        Add Note
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Textarea {...register('note')} placeholder="Add an internal note…" rows={3}
        className={errors.note ? 'border-destructive' : ''} autoFocus />
      {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : 'Save Note'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
      </div>
    </form>
  );
}
