/**
 * Static Cal/OSHA form template metadata.
 *
 * Lives here (not in server/services/) so client components can import it
 * without pulling in server-only dependencies.
 */

export type FormTemplateType =
  | 'eu632'       // Notice of Conveyance Compliance
  | 'eu787'       // Annual & 5 Year Test Notification
  | 'eu776a'      // Periodic Elevator Test — Hydraulic (DIR DOSH 776A)
  | 'eu776b'      // Periodic Elevator Test — Traction (DIR DOSH 776B)
  | 'dosh100'     // Request for Inspection (DIR DOSH 100)
  | 'eu215'       // Intent to Install
  | 'eu237'       // Alteration Intent to Install
  | 'eu471'       // Load Test (EU-471 Group 2 Hydraulic)
  | 'firelog'     // Monthly Fire Testing Log
  | 'suspension'  // Suspension Means Fastenings Replacement Notification
  | 'eu943';      // Change in Responsible Party

export interface FormTemplateInfo {
  label: string;
  description: string;
  officialUrl: string;
  filedWith: string;
  filedWhen: string;
}

export const FORM_TEMPLATE_INFO: Record<FormTemplateType, FormTemplateInfo> = {
  eu632: {
    label: 'EU-632 — Notice of Conveyance Compliance',
    description: 'Filed with Cal/OSHA after ALL violations on a Preliminary Order are corrected. One form per conveyance.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/compliance%20form%20Doc%20EU-632.pdf',
    filedWith: 'Cal/OSHA District Office that issued the Preliminary Order',
    filedWhen: 'After all corrective work is complete — before the compliance deadline on the PO',
  },
  eu787: {
    label: 'EU-787 — Annual & 5 Year Test Notification',
    description: 'Filed with Cal/OSHA district office BEFORE scheduled annual or 5-year tests. Groups III and IV.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Test%20Notification%20Form%20Doc%20EU-787%20fillable.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'Before the test — confirm specific lead time with your district office',
  },
  eu776a: {
    label: 'DIR DOSH 776A — Periodic Elevator Test (Hydraulic)',
    description: 'Filed with Cal/OSHA after periodic testing of hydraulic elevators. Rev. 9/2026.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Periodic-Hydraulic-Test-Form.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'After periodic hydraulic elevator testing is complete',
  },
  eu776b: {
    label: 'DIR DOSH 776B — Periodic Elevator Test (Traction)',
    description: 'Filed with Cal/OSHA after periodic testing of traction elevators. Rev. 9/2026.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Periodic-Traction-Test-Form.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'After periodic traction elevator testing is complete',
  },
  dosh100: {
    label: 'DIR DOSH 100 — Request for Inspection',
    description: 'Requests a Division inspection for permit renewal or post-repair reinspection.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/reinspection-request-form-a.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'When requesting reinspection after repairs, or for permit renewal',
  },
  eu215: {
    label: 'EU-215 — Intent to Install',
    description: 'Filed before new elevator installation begins.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Intent%20To%20Install%20Form%20Doc%20EU-215.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'Before installation begins',
  },
  eu237: {
    label: 'EU-237 — Alteration Intent to Install',
    description: 'Filed before a material alteration begins. A §7301.1 permit must already be obtained.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Intent%20to%20Alter%20EU-237%20fillable.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'Before alteration work begins — after permit is obtained',
  },
  eu471: {
    label: 'EU-471 — Group 2 Five Year Hydraulic Load Test Report',
    description: 'Filed with Cal/OSHA after a 5-year hydraulic load test. Documents load test data, pressures, and CCCM certification.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Load-Test-Form-EU-471.pdf',
    filedWith: 'Cal/OSHA District Office',
    filedWhen: 'After the 5-year hydraulic load test is complete',
  },
  firelog: {
    label: 'Monthly Fire Testing Log',
    description: 'Suggested FFS recall test log for use by CQCCs. Records monthly fire service recall test results for the calendar year.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Monthly-Fire-Testing-Log.pdf',
    filedWith: 'Kept on file with CQCC / building records',
    filedWhen: 'Updated monthly after each fire service recall test',
  },
  suspension: {
    label: 'Suspension Means Fastenings Replacement Notification',
    description: 'Filed with Cal/OSHA when suspension means (ropes/belts) are replaced. Documents conveyance removal, replacement, and return to service.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Suspension-Means-Fastenings-Replacement-Notification.pdf',
    filedWith: 'Cal/OSHA Elevator District Office',
    filedWhen: 'After suspension means replacement is complete and conveyance is returned to service',
  },
  eu943: {
    label: 'EU-943 — Change in Responsible Party',
    description: 'Filed when building ownership or property management changes.',
    officialUrl: 'https://www.dir.ca.gov/dosh/elevator/Change%20in%20responsible%20Party%20Form%20Doc%20EU-943%20fillable.pdf',
    filedWith: 'Cal/OSHA Elevator District Office',
    filedWhen: 'Promptly after ownership or management changes',
  },
};

/** Ordered list of all form types (matches the order in FORM_TEMPLATE_INFO). */
export const FORM_TYPES = Object.keys(FORM_TEMPLATE_INFO) as FormTemplateType[];
