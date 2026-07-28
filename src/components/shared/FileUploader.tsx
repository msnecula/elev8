'use client';

import { useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileText, Image, CheckCircle2, X, AlertCircle,
} from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
};

const ACCEPT_STRING = Object.entries(ACCEPTED_TYPES)
  .map(([mime, exts]) => [mime, ...exts].join(','))
  .join(',');

const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface UploadResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface FileUploaderProps {
  accountId: string;
  onUploadComplete: (result: UploadResult) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export default function FileUploader({
  accountId,
  onUploadComplete,
  onError,
  disabled = false,
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function getFileIcon(mimeType?: string) {
    if (!mimeType) return <Upload className="h-8 w-8 text-muted-foreground" />;
    if (mimeType === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
    return <Image className="h-8 w-8 text-blue-500" />;
  }

  function validateFile(f: File): string | null {
    const isValidType = Object.keys(ACCEPTED_TYPES).includes(f.type) ||
      f.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png|webp|heic|heif)$/);

    if (!isValidType) {
      return 'Please upload a PDF, JPG, PNG, or iPhone photo (HEIC)';
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `File is too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    }
    return null;
  }

  const handleFile = useCallback(async (f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }

    setFile(f);
    setError(null);
    setUploaded(false);
    setProgress(0);
    setUploading(true);

    try {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? 'pdf';
      const fileName = `${accountId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Simulate progress (Supabase doesn't give real progress)
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 85));
      }, 200);

      const { data, error: uploadError } = await supabase.storage
        .from('notices')
        .upload(fileName, f, { contentType: f.type, upsert: false });

      clearInterval(progressInterval);

      if (uploadError) throw new Error(uploadError.message);

      setProgress(100);
      setUploaded(true);
      setUploading(false);

      onUploadComplete({
        filePath: data.path,
        fileName: f.name,
        fileSize: f.size,
        mimeType: f.type || 'application/pdf',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setUploading(false);
      setProgress(0);
      onError?.(message);
    }
  }, [accountId, supabase, onUploadComplete, onError]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function handleReset() {
    setFile(null);
    setProgress(0);
    setUploaded(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (uploaded && file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800 truncate">{file.name}</p>
          <p className="text-xs text-green-700">{formatFileSize(file.size)} — uploaded successfully</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-green-600 hover:text-green-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (uploading && file) {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          {getFileIcon(file.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleInputChange}
        className="sr-only"
        disabled={disabled}
        id="file-upload-input"
      />
      <label
        htmlFor="file-upload-input"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed
          px-6 py-10 text-center cursor-pointer transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed border-border' : ''}
          ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-border hover:border-blue-300 hover:bg-muted/30'}
        `}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <FileText className="h-7 w-7 text-muted-foreground" />
          <Image className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {isDragging ? 'Drop file here' : 'Upload or drag & drop'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, JPG, PNG, iPhone photos (HEIC) up to {MAX_SIZE_MB}MB
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Supports text-based and scanned documents
        </p>
      </label>

      {error && (
        <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
