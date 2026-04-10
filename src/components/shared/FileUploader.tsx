'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatFileSize } from '@/lib/utils';
import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_BUCKET_NOTICES } from '@/lib/constants';

interface FileUploaderProps {
  accountId: string;
  bucket?: string;
  pathPrefix?: string;
  acceptedTypes?: string;
  maxSizeBytes?: number;
  onUploadComplete: (result: {
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

type UploadState = 'idle' | 'validating' | 'uploading' | 'complete' | 'error';

export default function FileUploader({
  accountId,
  bucket = STORAGE_BUCKET_NOTICES,
  pathPrefix = '',
  acceptedTypes = 'application/pdf',
  maxSizeBytes = 20 * 1024 * 1024,
  onUploadComplete,
  onError,
  disabled = false,
}: FileUploaderProps) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function setError(msg: string) {
    setErrorMessage(msg);
    setState('error');
    onError?.(msg);
  }

  function validateFile(file: File): boolean {
    const acceptedList = acceptedTypes.split(',').map((t) => t.trim());
    if (!acceptedList.includes(file.type)) {
      setError(`Invalid file type: ${file.type}. Only ${acceptedList.join(', ')} accepted.`);
      return false;
    }
    if (file.size > maxSizeBytes) {
      setError(`File too large (${formatFileSize(file.size)}). Maximum: ${formatFileSize(maxSizeBytes)}.`);
      return false;
    }
    return true;
  }

  async function uploadFile(file: File) {
    if (!validateFile(file)) return;

    setSelectedFile(file);
    setState('uploading');
    setProgress(10);
    setErrorMessage(null);

    // Build storage path: {accountId}/{uuid}-{sanitizedFilename}
    const uuid = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = pathPrefix
      ? `${pathPrefix}/${accountId}/${uuid}-${safeName}`
      : `${accountId}/${uuid}-${safeName}`;

    setProgress(30);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      return;
    }

    setProgress(100);
    setState('complete');

    onUploadComplete({
      filePath: storagePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleReset() {
    setState('idle');
    setProgress(0);
    setSelectedFile(null);
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {state === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-border hover:border-blue-300 hover:bg-muted/30',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Drop PDF here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF only · Max {formatFileSize(maxSizeBytes)}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={acceptedTypes}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}

      {/* Uploading state */}
      {state === 'uploading' && selectedFile && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
        </div>
      )}

      {/* Complete state */}
      {state === 'complete' && selectedFile && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">{selectedFile.name}</p>
                <p className="text-xs text-green-600">{formatFileSize(selectedFile.size)} · Uploaded successfully</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-green-700 hover:text-green-900 hover:bg-green-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Upload failed</p>
                <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-red-700 hover:text-red-900 hover:bg-red-100"
            >
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
