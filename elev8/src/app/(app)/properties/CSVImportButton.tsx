'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { importPropertiesFromCSV, type CSVPropertyRow } from '@/server/actions/properties';
import { Upload, Loader2, CheckCircle2, AlertTriangle, Download, FileText } from 'lucide-react';

interface Account { id: string; name: string }

interface Props {
  accounts: Account[];
}

type ImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export default function CSVImportButton({ accounts }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<CSVPropertyRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const header = 'Account Name,Property Name,Address,City,State,Zip,Building Type,Elevator Count';
    const examples = [
      'Westside Properties LLC,Westside Plaza,1200 Wilshire Blvd,Los Angeles,CA,90025,commercial,4',
      'Westside Properties LLC,Ocean View Residences,8800 Lincoln Blvd,Marina del Rey,CA,90292,residential,2',
      'Harbor View Realty,Harbor Tower,400 Ocean Blvd,Long Beach,CA,90802,commercial,6',
    ].join('\n');
    const csv = `${header}\n${examples}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'elev8-properties-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSV(text: string): CSVPropertyRow[] {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('File must have a header row and at least one data row');

    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s'"]+/g, '_'));

    const FIELD_MAP: Record<string, keyof CSVPropertyRow> = {
      'account_name': 'accountName',
      'account': 'accountName',
      'property_name': 'propertyName',
      'property': 'propertyName',
      'name': 'propertyName',
      'address': 'address',
      'street_address': 'address',
      'city': 'city',
      'state': 'state',
      'zip': 'zip',
      'zip_code': 'zip',
      'postal_code': 'zip',
      'building_type': 'buildingType',
      'type': 'buildingType',
      'elevator_count': 'elevatorCount',
      'elevators': 'elevatorCount',
      'elevator_#': 'elevatorCount',
    };

    const mappedHeaders = header.map(h => FIELD_MAP[h] ?? null);
    const rows: CSVPropertyRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      const row: Partial<CSVPropertyRow> = {};
      cells.forEach((cell, j) => {
        const field = mappedHeaders[j];
        if (field) (row as any)[field] = cell;
      });
      if (Object.keys(row).length > 0) {
        rows.push(row as CSVPropertyRow);
      }
    }

    return rows;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setParseError(null);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        setPreview(rows);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Could not parse CSV file');
      }
    };
    reader.readAsText(file);

    if (inputRef.current) inputRef.current.value = '';
  }

  function handleImport() {
    if (!preview) return;
    startTransition(async () => {
      const res = await importPropertiesFromCSV(preview);
      if (res.success) {
        setResult(res.data);
        setPreview(null);
        router.refresh();
        if (res.data.created > 0) {
          toast.success(`${res.data.created} propert${res.data.created !== 1 ? 'ies' : 'y'} imported`);
        }
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setPreview(null);
    setResult(null);
    setParseError(null);
  }

  const accountNames = accounts.map(a => a.name);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Properties from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Template download */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
            <p className="text-sm font-medium text-blue-800">Step 1 — Download the template</p>
            <p className="text-xs text-blue-700">
              Use this exact column format. The <strong>Account Name</strong> column must match
              an existing account exactly (case-insensitive).
            </p>
            <Button size="sm" variant="outline" onClick={downloadTemplate} className="border-blue-300">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download CSV Template
            </Button>
          </div>

          {/* Account names reference */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Available account names (copy exactly into your CSV):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {accountNames.map(name => (
                <span key={name} className="text-xs bg-white border border-border rounded px-2 py-0.5 font-mono">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Upload */}
          {!preview && !result && (
            <div>
              <p className="text-sm font-medium mb-2">Step 2 — Upload your completed CSV</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="sr-only"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button asChild variant="outline" className="cursor-pointer w-full h-16 border-dashed">
                  <span className="flex flex-col items-center gap-1">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">Click to upload CSV file</span>
                  </span>
                </Button>
              </label>
              {parseError && (
                <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />{parseError}
                </p>
              )}
            </div>
          )}

          {/* Preview */}
          {preview && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Preview — {preview.length} propert{preview.length !== 1 ? 'ies' : 'y'} ready to import
                </p>
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)} className="text-xs">
                  Change file
                </Button>
              </div>
              <div className="rounded border border-border overflow-hidden">
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        {['Account', 'Property Name', 'Address', 'City', 'Type', 'Elevators'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 20).map((row, i) => {
                        const accountExists = accountNames.some(
                          n => n.toLowerCase().trim() === row.accountName?.toLowerCase().trim()
                        );
                        return (
                          <tr key={i} className={`border-t border-border ${!accountExists ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-1.5">
                              <span className={accountExists ? '' : 'text-red-600 font-medium'}>
                                {row.accountName}
                                {!accountExists && ' ⚠ not found'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">{row.propertyName}</td>
                            <td className="px-3 py-1.5">{row.address}</td>
                            <td className="px-3 py-1.5">{row.city}</td>
                            <td className="px-3 py-1.5 capitalize">{row.buildingType || 'commercial'}</td>
                            <td className="px-3 py-1.5">{row.elevatorCount || '1'}</td>
                          </tr>
                        );
                      })}
                      {preview.length > 20 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-2 text-muted-foreground text-center">
                            …and {preview.length - 20} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <Button onClick={handleImport} disabled={isPending} className="w-full">
                {isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>
                  : `Import ${preview.length} Propert${preview.length !== 1 ? 'ies' : 'y'}`}
              </Button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className={`rounded-lg border p-4 ${result.created > 0 ? 'border-green-200 bg-green-50' : 'border-border'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-semibold text-green-800">Import Complete</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-2xl font-bold text-green-700">{result.created}</p>
                    <p className="text-xs text-muted-foreground">Properties created</p>
                  </div>
                  {result.skipped > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                      <p className="text-xs text-muted-foreground">Rows skipped</p>
                    </div>
                  )}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''}:
                  </p>
                  <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-xs text-amber-800">• {e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button onClick={handleClose} className="w-full" variant="outline">Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
