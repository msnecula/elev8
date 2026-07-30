'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { uploadFormTemplate } from '@/server/actions/formTemplates';
import { Upload, Loader2, RefreshCw } from 'lucide-react';
import type { FormTemplateType } from '@/server/services/formTemplateService';

interface Props {
  formType: FormTemplateType;
  isUploaded: boolean;
}

export default function FormTemplateUploader({ formType, isUploaded }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [detectedFields, setDetectedFields] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      if (!base64) { toast.error('Failed to read file'); return; }

      startTransition(async () => {
        const result = await uploadFormTemplate(formType, base64, file.name);
        if (result.success) {
          const fieldCount = result.data.fields.length;
          setDetectedFields(result.data.fields.map(f => f.name));
          toast.success(
            fieldCount > 0
              ? `${formType.toUpperCase()} uploaded — ${fieldCount} fillable field${fieldCount !== 1 ? 's' : ''} detected`
              : `${formType.toUpperCase()} uploaded (no fillable fields detected — form may use a non-standard format)`,
          );
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-uploaded if needed
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="sr-only"
        id={`upload-${formType}`}
        disabled={isPending}
      />
      <label htmlFor={`upload-${formType}`}>
        <Button
          asChild
          size="sm"
          variant={isUploaded ? 'outline' : 'default'}
          disabled={isPending}
          className="cursor-pointer"
        >
          <span>
            {isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
            ) : isUploaded ? (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Replace with New Version</>
            ) : (
              <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload Official Form</>
            )}
          </span>
        </Button>
      </label>

      {detectedFields && detectedFields.length > 0 && (
        <details className="text-xs text-muted-foreground cursor-pointer">
          <summary className="hover:text-foreground">
            {detectedFields.length} fields detected
          </summary>
          <div className="mt-1 p-2 bg-muted rounded text-xs font-mono max-h-32 overflow-y-auto">
            {detectedFields.map(f => <div key={f}>{f}</div>)}
          </div>
        </details>
      )}
    </div>
  );
}
