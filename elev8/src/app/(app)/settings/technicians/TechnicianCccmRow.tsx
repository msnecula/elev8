'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { updateTechnicianCccmLicense } from '@/server/actions/technicians';
import { Check, Loader2, Pencil, X } from 'lucide-react';

interface Props {
  technicianId: string;
  fullName: string;
  email: string;
  cccmLicense: string | null;
  isActive: boolean;
}

export default function TechnicianCccmRow({
  technicianId,
  fullName,
  email,
  cccmLicense,
  isActive,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cccmLicense ?? '');
  const [saved, setSaved] = useState(cccmLicense ?? '');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleEdit() {
    setValue(saved);
    setEditing(true);
    setError('');
  }

  function handleCancel() {
    setValue(saved);
    setEditing(false);
    setError('');
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateTechnicianCccmLicense(technicianId, value);
      if (result.success) {
        setSaved(value.trim());
        setEditing(false);
        setError('');
      } else {
        setError(result.error ?? 'Save failed');
      }
    });
  }

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      {/* Technician info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
          {!isActive && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Inactive
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>

      {/* CCCM License field */}
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 123456"
              className="w-36 h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              autoFocus
              disabled={isPending}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-green-600 hover:text-green-700"
              onClick={handleSave}
              disabled={isPending}
              title="Save"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              onClick={handleCancel}
              disabled={isPending}
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            {error && <p className="text-xs text-red-500 ml-1">{error}</p>}
          </>
        ) : (
          <>
            <span className={`text-sm w-36 text-right ${saved ? 'text-foreground font-mono' : 'text-muted-foreground italic'}`}>
              {saved || '—'}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleEdit}
              title="Edit CCCM License"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
