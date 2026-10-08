'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { generateFilledForm } from '@/server/actions/formTemplates';
import { triggerNoticeParsing } from '@/server/actions/notices';
import { Loader2, Download, Plus, Trash2, CheckCircle2, Info, RefreshCw, AlertTriangle } from 'lucide-react';
import type { FormTemplateType } from '@/server/services/formTemplateService';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

interface Props {
  formType: FormTemplateType;
  noticeId?: string;
  workOrderId?: string;
  parsedData: ParsedNoticeData | null;
}

export default function FormGenerator({ formType, noticeId, workOrderId, parsedData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isReparsing, startReparse] = useTransition();
  const [pdfReady, setPdfReady] = useState<{
    base64: string;
    filename: string;
    unfilledFields: string[];
    allPdfFields: Array<{ name: string; type: string; value: string }>;
    autoFilledFields: Record<string, string>;
    templateVersionWarning: string | null;
  } | null>(null);
  const [showFieldDebug, setShowFieldDebug] = useState(false);
  const [flatten, setFlatten] = useState(true);

  // Extra fields specific to each form type
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      extraFields: [] as Array<{ fieldName: string; value: string }>,
      // EU-632 specific — SSR-safe default; solutions are populated client-side
      // via useEffect + replaceReq to avoid server/client hydration mismatches.
      requirements: parsedData?.violationItems?.map((v, i) => ({
        reqNumber: String(i + 1),
        solution: '',
        cccmNumber: '',
        violation: v,
      })) ?? [{ reqNumber: '1', solution: '', cccmNumber: '', violation: '' }],
      cccmName: '',
      cccmLicenseExpiry: '',
      signerName: '',
      signerPhone: '',
      // EU-787 specific
      stateNo: parsedData?.equipmentId ?? '',
      testDate: '',
      testTime: '',
      mechanicName: '',
      mechanicLicenseNumber: '',
      mechanicLicenseExpiry: '',
      districtOffice: '',
      group: 'IV',
      // DOSH-100 specific — pre-populated from parsedData; user can edit before generating
      dosh100BuildingName: parsedData?.propertyName ?? '',
      dosh100Address: parsedData?.propertyAddress ?? '',
      dosh100ClientCompany: parsedData?.clientCompany ?? '',
      // EU-776A / EU-776B specific — pre-populated from parsedData; user can edit before generating
      eu776Address: parsedData?.propertyAddress ?? '',
    },
  });

  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({
    control, name: 'extraFields',
  });
  const { fields: reqFields, append: appendReq, remove: removeReq, replace: replaceReq } = useFieldArray({
    control, name: 'requirements',
  });

  // After hydration: expand rows to max(violations, actionPlan) and pre-fill solutions.
  // Done in useEffect (not defaultValues) to avoid SSR/client HTML mismatch.
  useEffect(() => {
    if (formType !== 'eu632' || !parsedData) return;
    const violations = parsedData.violationItems ?? [];
    const actionPlan = parsedData.actionPlan ?? [];
    const maxRows = Math.max(violations.length, actionPlan.length);
    if (maxRows === 0) return;
    replaceReq(
      Array.from({ length: maxRows }, (_, i) => ({
        reqNumber: String(i + 1),
        solution: actionPlan[i]
          ? [actionPlan[i].title, actionPlan[i].description].filter(Boolean).join(': ')
          : '',
        cccmNumber: '',
        violation: violations[i] ?? '',
      })),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleReparse() {
    if (!noticeId) return;
    startReparse(async () => {
      toast.loading('Re-parsing notice with AI…');
      const result = await triggerNoticeParsing(noticeId);
      if (result.success) {
        toast.success('Notice re-parsed — refreshing page to load updated data');
        router.refresh();
      } else {
        toast.error('Re-parse failed: ' + result.error);
      }
    });
  }

  function onSubmit(values: any) {
    startTransition(async () => {
      // Build additional fields from form-specific inputs
      const additionalFields: Record<string, string> = {};

      // Add any manually entered extra fields
      for (const ef of values.extraFields ?? []) {
        if (ef.fieldName && ef.value) {
          additionalFields[ef.fieldName] = ef.value;
        }
      }

      // EU-632 specific field mappings — exact names from the official Cal/OSHA PDF
      if (formType === 'eu632') {
        // State No. — try every known variant so at least one hits the PDF field
        const stateNoValue = values.stateNo ?? '';
        if (stateNoValue) {
          for (const key of [
            'State  No', 'State No:', 'State No', 'State No.', 'StateNo', 'State Number',
            'Unit No', 'Unit No.', 'Device No', 'Device No.',
            'Conveyance Number', 'TextField4', 'TextField5',
          ]) {
            additionalFields[key] = stateNoValue;
          }
        }

        // Printed name fields (exact PDF field names)
        if (values.cccmName)          additionalFields['(Printed Name)_1']      = values.cccmName;
        if (values.signerName)        additionalFields['(Printed Name)_2']      = values.signerName;
        if (values.cccmLicenseExpiry) additionalFields['License Expire Date']   = values.cccmLicenseExpiry;

        // (Printed Name & Title) = "Name, CCCM #<license>" using the first row's CCCM#
        // (server auto-fills this too, but we override to ensure the license is included)
        const primaryCccm = values.requirements[0]?.cccmNumber ?? '';
        if (values.cccmName) {
          additionalFields['(Printed Name & Title)'] = primaryCccm
            ? `${values.cccmName}, CCCM #${primaryCccm}`
            : values.cccmName;
        }

        // Requirement / solution rows — PDF uses underscore format: Req_1, Solution_1, CCCM_1
        for (let i = 0; i < values.requirements.length; i++) {
          const r = values.requirements[i];
          // A row has content if the user typed a solution OR the row was pre-populated from parsed data
          const hasContent = !!(r.solution || r.violation);

          if (hasContent) {
            // ✅ FIX: Req_N is ALWAYS the row number (1, 2, 3…) based on position,
            //         never the violation text, and never dependent on the editable reqNumber field
            additionalFields[`Req_${i + 1}`] = String(i + 1);
          }
          if (r.solution) additionalFields[`Solution_${i + 1}`] = r.solution;

          // ✅ FIX: CCCM_N only fills when a solution is present for this row
          if (hasContent && r.solution) {
            if (r.cccmNumber) additionalFields[`CCCM_${i + 1}`] = r.cccmNumber;
            // If no user cccmNumber, server auto-fill (mechanic license from env) applies
          } else {
            // No solution: explicitly clear so server auto-fill is overridden for this row
            additionalFields[`CCCM_${i + 1}`] = '';
          }
        }

        // Clear CCCM rows beyond the requirements list (overrides server auto-fill of all 11)
        for (let i = values.requirements.length; i < 11; i++) {
          additionalFields[`CCCM_${i + 1}`] = '';
        }
      }

      // EU-787 specific — keys match the EXACT field names in the official PDF
      if (formType === 'eu787') {
        // State No. — try every known variant so at least one hits the PDF field
        const stateNoValue = values.stateNo ?? '';
        if (stateNoValue) {
          for (const key of [
            'State No.', 'State No', 'StateNo', 'State Number',
            'Unit No', 'Unit No.', 'Car No', 'Car No.',
            'Device No', 'Device No.', 'Cal State No',
          ]) {
            additionalFields[key] = stateNoValue;
          }
        }

        additionalFields['TEST DATE']               = values.testDate;
        additionalFields['TIME']                    = values.testTime;
        additionalFields['Mechanic Performing Test'] = values.mechanicName;
        additionalFields['Prepared by']             = values.mechanicName;
        additionalFields['License No']              = values.mechanicLicenseNumber;
        additionalFields['CCCM No']                 = values.mechanicLicenseNumber;
        additionalFields['expiry date']             = values.mechanicLicenseExpiry;
        additionalFields['District Office']         = values.districtOffice;

        // Group 3 = Annual (Group III), Group 4 = 5-Year (Group IV)
        // These are checkboxes in the PDF — set the relevant one to 'true'
        if (values.group === 'III' || values.group === '3') {
          additionalFields['Group 3'] = 'true';
        } else {
          // Default to Group IV (5-year test) which is most common
          additionalFields['Group 4'] = 'true';
        }
      }

      // DOSH-100 specific — exact field names from the Cal/OSHA DOSH-100 Rev. 2/2026 AcroForm
      if (formType === 'dosh100') {
        const stateNoValue = values.stateNo ?? '';
        if (stateNoValue) additionalFields['Conveyance State Nos'] = stateNoValue;
        if (values.dosh100BuildingName) additionalFields['Building Name'] = values.dosh100BuildingName;
        if (values.dosh100Address)      additionalFields['Location Address of Conveyance (s)'] = values.dosh100Address;
        if (values.dosh100ClientCompany) additionalFields['Name'] = values.dosh100ClientCompany;
        // Date auto-filled by buildFieldMappings; contact info comes from env vars
      }

      // EU-776A / EU-776B — exact field names from PDF inspection (A uses underscores, B uses spaces)
      if (formType === 'eu776a' || formType === 'eu776b') {
        const stateNoValue = values.stateNo ?? '';
        if (stateNoValue) {
          // Field names differ between 776A and 776B
          additionalFields[formType === 'eu776a' ? 'State_ID_#' : 'State ID'] = stateNoValue;
        }
        if (values.eu776Address) {
          // Extract street-only portion (before first comma) for the building address field
          const street = values.eu776Address.split(',')[0]?.trim() ?? values.eu776Address;
          additionalFields[formType === 'eu776a' ? 'Building_Street_Address' : 'Building Street Address'] = street;
        }
        if (values.testDate) {
          additionalFields[formType === 'eu776a' ? 'Date_of_Testing' : 'Date of Testing'] = values.testDate;
        }
        if (values.mechanicName) {
          additionalFields['CCCM Performing Test'] = values.mechanicName;
          additionalFields['Printed Name']         = values.mechanicName;
        }
        if (values.mechanicLicenseNumber) {
          // 776A: 'CCCM Certificate #'  |  776B: 'CCCM Certificate' (no #)
          additionalFields[formType === 'eu776a' ? 'CCCM Certificate #' : 'CCCM Certificate'] = values.mechanicLicenseNumber;
        }
        if (values.mechanicLicenseExpiry) {
          additionalFields['Cert Expiration Date'] = values.mechanicLicenseExpiry;
        }
        // CQCC and driving-machine type checkboxes are auto-filled by buildFieldMappings (env vars + elevatorType)
      }

      const result = await generateFilledForm({
        formType,
        noticeId,
        workOrderId,
        additionalFields,
        flatten,
      });

      if (result.success) {
        setPdfReady({
          base64: result.data.pdfBase64,
          filename: result.data.filename,
          unfilledFields: result.data.unfilledFields,
          allPdfFields: result.data.allPdfFields,
          autoFilledFields: result.data.autoFilledFields,
          templateVersionWarning: result.data.templateVersionWarning,
        });
        toast.success('Form generated — review and download below');
      } else {
        toast.error(result.error);
      }
    });
  }

  function downloadPdf() {
    if (!pdfReady) return;
    const bytes = atob(pdfReady.base64);
    const blob = new Blob([new Uint8Array([...bytes].map(c => c.charCodeAt(0)))], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfReady.filename;
    // Must be in DOM for Firefox; must NOT revoke synchronously —
    // revoking before the browser reads the blob causes "virus scan failed"
    // on Windows because Defender can't access an already-revoked object URL.
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* EU-632 extra inputs */}
      {formType === 'eu632' && (
        <>
          {/* Violations reference */}
          {parsedData?.violationItems && parsedData.violationItems.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Violations from PO (reference)</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {parsedData.violationItems.map((v, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="bg-amber-100 text-amber-800 rounded px-1.5 text-xs font-bold shrink-0 mt-0.5">#{i+1}</span>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Requirements & Corrective Actions</CardTitle>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => appendReq({ reqNumber: '', solution: '', cccmNumber: '', violation: '' })}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {reqFields.map((field, i) => (
                <div key={field.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Requirement {i + 1}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeReq(i)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Req # (from PO)</Label>
                      <Input {...register(`requirements.${i}.reqNumber`)} placeholder="1" className="h-8 text-sm" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Solution / Corrective Action</Label>
                      <Textarea {...register(`requirements.${i}.solution`)}
                        placeholder="What was done to fix this violation..."
                        rows={2} className="text-sm resize-none" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CCCM License #</Label>
                      <Input {...register(`requirements.${i}.cccmNumber`)} placeholder="CCCM-XXXXX" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Certifying Mechanic (CCCM)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>California State No. (from PO)</Label>
                <Input
                  {...register('stateNo')}
                  placeholder="e.g. 050152 — from the Preliminary Order header"
                  className={!parsedData?.equipmentId ? 'border-amber-400 bg-amber-50' : ''}
                />
                {!parsedData?.equipmentId && (
                  <div className="flex items-start gap-2">
                    <p className="text-xs text-amber-700 flex-1">
                      ⚠️ Not found in parsed data — enter it manually from the PO header, or re-parse the notice if it was uploaded before today&apos;s update.
                    </p>
                    {noticeId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                        onClick={handleReparse}
                        disabled={isReparsing}
                      >
                        {isReparsing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Re-parse Notice
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Full Name (printed)</Label>
                <Input {...register('cccmName')} placeholder="John Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>CCCM License Expiry</Label>
                <Input {...register('cccmLicenseExpiry')} placeholder="MM/DD/YYYY" />
              </div>
              <div className="space-y-1.5">
                <Label>Authorized Signer Name</Label>
                <Input {...register('signerName')} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Signer Phone</Label>
                <Input {...register('signerPhone')} placeholder="(310) 555-0100" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* EU-787 extra inputs */}
      {formType === 'eu787' && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Test Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>
                California State No. <span className="text-red-600">*</span>
              </Label>
              <Input
                {...register('stateNo')}
                placeholder="e.g. E-12345 — from the Preliminary Order header"
                className={!parsedData?.equipmentId ? 'border-amber-400 bg-amber-50' : ''}
              />
              {!parsedData?.equipmentId && (
                <div className="flex items-start gap-2">
                  <p className="text-xs text-amber-700 flex-1">
                    ⚠️ Not found in parsed data — enter it manually from the PO header, or re-parse the notice if it was uploaded before today's update.
                  </p>
                  {noticeId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                      onClick={handleReparse}
                      disabled={isReparsing}
                    >
                      {isReparsing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Re-parse Notice
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Test Date</Label>
              <Input {...register('testDate')} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>Test Time</Label>
              <Input {...register('testTime')} type="time" />
            </div>
            <div className="space-y-1.5">
              <Label>Mechanic Name (CCCM)</Label>
              <Input {...register('mechanicName')} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>CCCM License Number</Label>
              <Input {...register('mechanicLicenseNumber')} placeholder="CCCM-XXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>CCCM License Expiry</Label>
              <Input {...register('mechanicLicenseExpiry')} placeholder="MM/DD/YYYY" />
            </div>
            <div className="space-y-1.5">
              <Label>Test Group</Label>
              <select
                {...register('group')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="IV">Group IV — 5-Year Safety Test (most common)</option>
                <option value="III">Group III — Annual Safety Test</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Group III = annual; Group IV = 5-year hydraulic/traction safety test.
                Checks the corresponding box in the PDF.
              </p>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>District Office</Label>
              <Input {...register('districtOffice')} placeholder="Cal/OSHA Los Angeles District Office" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* DOSH-100 extra inputs */}
      {formType === 'dosh100' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">DOSH-100 Report Details</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pre-filled from the Preliminary Order. Edit any field before generating.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {/* Conveyance State No. — most likely to be missing */}
            <div className="col-span-2 space-y-1.5">
              <Label>
                Conveyance State No. <span className="text-red-600">*</span>
              </Label>
              <Input
                {...register('stateNo')}
                placeholder="e.g. 050152 — from the Preliminary Order header"
                className={!parsedData?.equipmentId ? 'border-amber-400 bg-amber-50' : ''}
              />
              {!parsedData?.equipmentId && (
                <div className="flex items-start gap-2">
                  <p className="text-xs text-amber-700 flex-1">
                    ⚠️ Not found in parsed data — enter it manually from the PO header, or re-parse the notice if it was uploaded before the latest update.
                  </p>
                  {noticeId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                      onClick={handleReparse}
                      disabled={isReparsing}
                    >
                      {isReparsing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Re-parse Notice
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Building / Property Name */}
            <div className="col-span-2 space-y-1.5">
              <Label>Building / Property Name</Label>
              <Input
                {...register('dosh100BuildingName')}
                placeholder="e.g. Main Street Tower"
              />
            </div>

            {/* Location Address */}
            <div className="col-span-2 space-y-1.5">
              <Label>Location Address of Conveyance</Label>
              <Input
                {...register('dosh100Address')}
                placeholder="e.g. 123 Main St, Los Angeles, CA 90001"
              />
            </div>

            {/* Responsible Party / Owner */}
            <div className="col-span-2 space-y-1.5">
              <Label>Responsible Party / Owner Name</Label>
              <Input
                {...register('dosh100ClientCompany')}
                placeholder="e.g. ABC Properties LLC"
              />
            </div>

            {/* Contact info note */}
            <div className="col-span-2 rounded border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-700">
                <strong>Contact Name, Phone &amp; Email</strong> are filled automatically from your company settings.
                Use &ldquo;Additional Field Overrides&rdquo; below to override them if needed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* EU-776A / EU-776B extra inputs */}
      {(formType === 'eu776a' || formType === 'eu776b') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {formType === 'eu776a' ? 'EU-776A (Hydraulic)' : 'EU-776B (Traction)'} Test Details
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pre-filled from the Preliminary Order. Edit any field before generating.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {/* California State ID */}
            <div className="col-span-2 space-y-1.5">
              <Label>
                California State ID <span className="text-red-600">*</span>
              </Label>
              <Input
                {...register('stateNo')}
                placeholder="e.g. 050152 — from the Preliminary Order header"
                className={!parsedData?.equipmentId ? 'border-amber-400 bg-amber-50' : ''}
              />
              {!parsedData?.equipmentId && (
                <div className="flex items-start gap-2">
                  <p className="text-xs text-amber-700 flex-1">
                    ⚠️ Not found in parsed data — enter it manually from the PO header, or re-parse the notice if it was uploaded before the latest update.
                  </p>
                  {noticeId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                      onClick={handleReparse}
                      disabled={isReparsing}
                    >
                      {isReparsing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Re-parse Notice
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Building Street Address */}
            <div className="col-span-2 space-y-1.5">
              <Label>Building Street Address</Label>
              <Input
                {...register('eu776Address')}
                placeholder="e.g. 123 Main St, Los Angeles, CA 90001"
              />
              <p className="text-xs text-muted-foreground">
                City, State, and Zip are extracted automatically from the address above.
              </p>
            </div>

            {/* Date of Testing */}
            <div className="space-y-1.5">
              <Label>Date of Testing</Label>
              <Input {...register('testDate')} type="date" />
            </div>

            {/* CCCM Performing Test */}
            <div className="space-y-1.5">
              <Label>CCCM Performing Test</Label>
              <Input {...register('mechanicName')} placeholder="John Smith" />
            </div>

            {/* CCCM Certificate # */}
            <div className="space-y-1.5">
              <Label>CCCM Certificate #</Label>
              <Input {...register('mechanicLicenseNumber')} placeholder="CCCM-XXXXX" />
            </div>

            {/* Cert Expiration Date */}
            <div className="space-y-1.5">
              <Label>Cert Expiration Date</Label>
              <Input {...register('mechanicLicenseExpiry')} placeholder="MM/DD/YYYY" />
            </div>

            {/* CQCC / test result note */}
            <div className="col-span-2 rounded border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-700">
                <strong>CQCC number</strong> is filled automatically from your company settings.
                Test result checkboxes (Pass / Fail / N/A per row) must be completed manually in the downloaded PDF before filing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual field overrides */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Additional Field Overrides</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                If a field wasn't auto-filled correctly, enter the exact PDF field name and the value you want.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline"
              onClick={() => appendExtra({ fieldName: '', value: '' })}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Field
            </Button>
          </div>
        </CardHeader>
        {extraFields.length > 0 && (
          <CardContent className="space-y-2">
            {extraFields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-5 gap-2 items-center">
                <div className="col-span-2">
                  <Input {...register(`extraFields.${i}.fieldName`)} placeholder="PDF field name" className="h-8 text-sm font-mono" />
                </div>
                <div className="col-span-2">
                  <Input {...register(`extraFields.${i}.value`)} placeholder="Value" className="h-8 text-sm" />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeExtra(i)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Flatten option */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Flatten form fields <span className="text-xs text-green-700 font-normal">(recommended)</span></p>
          <p className="text-xs text-muted-foreground">Bakes values into the PDF and removes interactive scripting — prevents antivirus false positives on download. Turn off only if you need to edit fields in Acrobat after generating.</p>
        </div>
        <Switch checked={flatten} onCheckedChange={setFlatten} />
      </div>

      {/* Generate */}
      <Button type="submit" disabled={isPending} className="w-full" size="lg">
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Filling Official Form…</>
          : `Generate ${formType.toUpperCase()} — Official Cal/OSHA Form`}
      </Button>

      {/* Result */}
      {pdfReady && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Official Form Generated</p>
              <p className="text-sm text-green-700">
                The official Cal/OSHA PDF has been filled with your data.
                Review carefully before sending.
              </p>
            </div>
          </div>

          {/* Template version drift warning — shown when fingerprint changed since last calibration */}
          {pdfReady.templateVersionWarning && (
            <div className="rounded border border-yellow-300 bg-yellow-50 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-yellow-800 mb-0.5">Template Version Warning</p>
                <p className="text-xs text-yellow-700">{pdfReady.templateVersionWarning}</p>
              </div>
            </div>
          )}

          {pdfReady.unfilledFields.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1 mb-1">
                <Info className="h-3.5 w-3.5" />
                {pdfReady.unfilledFields.length} field{pdfReady.unfilledFields.length !== 1 ? 's' : ''} could not be auto-filled
              </p>
              <p className="text-xs text-amber-700 mb-2">
                Use "Additional Field Overrides" above — paste the exact field name from the list below, then enter the value.
              </p>
              <div className="font-mono text-xs text-amber-800 space-y-0.5">
                {pdfReady.unfilledFields.map(f => (
                  <div key={f} className="flex items-center gap-1">
                    <span className="text-amber-500">•</span>
                    <span className="select-all">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Field Inspector — shows ALL fields so we can verify exact names */}
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              onClick={() => setShowFieldDebug(v => !v)}
              className="text-xs font-semibold text-slate-600 flex items-center gap-1 w-full text-left"
            >
              <Info className="h-3.5 w-3.5" />
              {showFieldDebug ? '▾' : '▸'} PDF Field Inspector ({pdfReady.allPdfFields.length} total fields)
            </button>
            {showFieldDebug && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-500 mb-2">
                  All fields in the uploaded PDF template. Green = auto-filled, Red = not filled.
                  Copy exact field names into the overrides above if needed.
                </p>
                {pdfReady.allPdfFields.map(f => {
                  const filled = pdfReady.autoFilledFields[f.name] || '';
                  return (
                    <div key={f.name} className={`flex items-center gap-2 text-xs font-mono rounded px-1.5 py-0.5 ${
                      filled ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'
                    }`}>
                      <span className="shrink-0">{filled ? '✓' : '○'}</span>
                      <span className="select-all flex-1">{f.name}</span>
                      <span className="text-xs opacity-60 font-sans">{f.type}</span>
                      {filled && <span className="opacity-70 truncate max-w-[120px]">= {filled}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Button onClick={downloadPdf} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="mr-2 h-4 w-4" />
            Download {formType.toUpperCase()} PDF
          </Button>
        </div>
      )}
    </form>
  );
}
