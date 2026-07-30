import 'server-only';

export type EU632Data = {
  // Header
  propertyAddress: string;
  city: string;
  zip: string;
  inspectionDate: string;
  stateId: string; // California State ID / Conveyance number

  // Requirements — one per violation on the PO
  requirements: Array<{
    reqNumber: string;       // Requirement number from the PO (e.g. "1", "2a")
    solution: string;        // What was done to correct it
    cccmNumber: string;      // CCCM license number of mechanic who did the work
  }>;

  // Certifying mechanic
  cccmName: string;
  cccmLicenseExpiry: string;
  cccmSignatureDate: string;

  // Second mechanic (optional)
  secondCccmName?: string;
  secondCccmDate?: string;

  // Company signer
  signerName: string;
  signerTitle: string;
  signerPhone: string;
  signerCompany: string;
  signerOfficeLocation: string;
  signerDate: string;
};

export type EU787Data = {
  stateId: string;
  propertyAddress: string;
  city: string;
  zip: string;
  unitCount: number;
  group: 'II' | 'III' | 'IV';
  driveType: string; // hydraulic, traction, etc.
  testType: 'Annual' | '5-Year' | 'Both';
  testDate: string;
  testTime: string;
  mechanicName: string;
  mechanicLicenseNumber: string;
  mechanicLicenseExpiry: string;
  isRescheduled: boolean;
  districtOffice: string;
};

export type AdvanceNoticeData = {
  date: string;
  recipientName: string;
  recipientCompany: string; // e.g. "Cal/OSHA District Office", "Building Owner"
  recipientAddress: string;
  propertyName: string;
  propertyAddress: string;
  stateId: string;
  elevatorDescription: string;
  scheduledWorkDate: string;
  scheduledWorkTime: string;
  natureOfWork: string;
  cqccName: string;
  cqccLicenseNumber: string;
  mechanicName: string;
  mechanicLicenseNumber: string;
  contactName: string;
  contactPhone: string;
  noticeHours: number; // usually 48
};

export type ProposalPDFData = {
  proposalNumber: string;
  date: string;
  validUntil: string;

  // Client
  clientName: string;
  clientCompany: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;

  // Property
  propertyName: string;
  propertyAddress: string;
  stateId: string;
  elevatorType: string;

  // Reference
  preliminaryOrderDate?: string;
  complianceDeadline?: string;

  // Work
  scopeSummary: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax?: number;
  total: number;

  // Company
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLicense: string;
};

export type DOSH100Data = {
  date: string;
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  propertyName: string;
  propertyAddress: string;
  city: string;
  zip: string;
  stateId: string;
  elevatorDescription: string;
  reasonForInspection: string; // "Annual reinspection", "Post-repair reinspection", etc.
  contactName: string;
  contactPhone: string;
  districtOffice: string;
};

/**
 * Generates an EU-632 Notice of Conveyance Compliance PDF.
 * Returns a Buffer containing the PDF.
 */
export async function generateEU632PDF(data: EU632Data): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const blue = rgb(0.1, 0.2, 0.6);
  const lightGray = rgb(0.9, 0.9, 0.9);

  // Helper functions
  const text = (str: string, x: number, y: number, size = 10, font = fontReg, color = black) => {
    if (!str) return;
    page.drawText(str, { x, y, size, font, color });
  };

  const line = (x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = black) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  };

  const rect = (x: number, y: number, w: number, h: number, color = lightGray) => {
    page.drawRectangle({ x, y, width: w, height: h, color });
  };

  const field = (label: string, value: string, x: number, y: number, w = 200) => {
    text(label, x, y + 12, 7, fontReg, gray);
    line(x, y, x + w, y, 0.5, gray);
    text(value, x, y + 2, 9, fontReg, black);
  };

  let y = height - 50;

  // Header bar
  rect(40, y - 10, width - 80, 36, blue);
  page.drawText('STATE OF CALIFORNIA — DEPARTMENT OF INDUSTRIAL RELATIONS', {
    x: 50, y: y + 8, size: 8, font: fontBold, color: rgb(1, 1, 1),
  });
  page.drawText('Division of Occupational Safety and Health — Elevator Unit', {
    x: 50, y: y - 2, size: 8, font: fontReg, color: rgb(0.85, 0.85, 1),
  });

  y -= 55;
  text('NOTICE OF CONVEYANCE COMPLIANCE', 40, y, 16, fontBold, blue);
  text('Form EU-632 (Rev. 1, 8/21/2018)', width - 190, y, 8, fontReg, gray);

  y -= 8;
  text('One conveyance per form. File with the district office that issued the Preliminary Order or Show Cause Order.', 40, y, 7.5, fontReg, gray);

  y -= 20;
  line(40, y, width - 40, y, 1, blue);

  // Header fields
  y -= 25;
  field('PROPERTY ADDRESS', data.propertyAddress, 40, y, 220);
  field('INSPECTION DATE', data.inspectionDate, 280, y, 120);
  field('STATE ID / CONVEYANCE NUMBER', data.stateId, 420, y, 150);

  y -= 30;
  field('CITY', data.city, 40, y, 160);
  field('ZIP', data.zip, 220, y, 80);

  y -= 25;
  line(40, y, width - 40, y, 0.5, gray);

  // Requirements table header
  y -= 18;
  rect(40, y - 4, width - 80, 18, blue);
  text('REQ. #', 45, y + 2, 8, fontBold, rgb(1, 1, 1));
  text('SOLUTION / CORRECTIVE ACTION TAKEN', 110, y + 2, 8, fontBold, rgb(1, 1, 1));
  text('CCCM LICENSE #', 465, y + 2, 8, fontBold, rgb(1, 1, 1));

  // Requirement rows
  const reqRowHeight = 42;
  for (let i = 0; i < data.requirements.length; i++) {
    const req = data.requirements[i];
    y -= reqRowHeight;

    if (i % 2 === 0) rect(40, y - 4, width - 80, reqRowHeight - 2, rgb(0.97, 0.97, 0.97));

    // Row number
    text(String(i + 1), 45, y + 24, 7, fontReg, gray);

    // Req number box
    rect(48, y + 8, 45, 22, rgb(0.9, 0.92, 0.98));
    text(req.reqNumber, 52, y + 14, 11, fontBold, blue);

    // Solution text (wrap if needed)
    const maxCharsPerLine = 55;
    const words = req.solution.split(' ');
    let currentLine = '';
    let lineY = y + 26;
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        text(currentLine, 110, lineY, 8.5, fontReg, black);
        lineY -= 11;
        currentLine = word;
      }
    }
    if (currentLine) text(currentLine, 110, lineY, 8.5, fontReg, black);

    // CCCM number
    text(req.cccmNumber, 465, y + 20, 9, fontReg, black);

    line(40, y - 4, width - 40, y - 4, 0.3, gray);
  }

  // Add empty rows if fewer than 4 requirements
  const minRows = 4;
  for (let i = data.requirements.length; i < minRows; i++) {
    y -= reqRowHeight;
    if (i % 2 === 0) rect(40, y - 4, width - 80, reqRowHeight - 2, rgb(0.97, 0.97, 0.97));
    line(97, y + 4, 455, y + 4, 0.3, gray);
    text('REQ #', 48, y + 7, 6.5, fontReg, rgb(0.7, 0.7, 0.7));
    text('_______________________', 110, y + 4, 8, fontReg, rgb(0.8, 0.8, 0.8));
    line(40, y - 4, width - 40, y - 4, 0.3, gray);
  }

  y -= 20;
  line(40, y, width - 40, y, 1, blue);

  // Certification statement
  y -= 18;
  rect(40, y - 6, width - 80, 30, rgb(1, 0.97, 0.9));
  text(
    '"I hereby certify that the statement I have given herein is true and complete to the best of my knowledge.',
    45, y + 10, 7.5, fontReg, black,
  );
  text(
    'A false statement will be cause for voiding this notice of compliance and may cause reinstatement of accumulating fines from the original date of notification."',
    45, y, 7.5, fontReg, black,
  );

  // Signature blocks
  y -= 45;
  text('CERTIFYING MECHANIC (CCCM)', 40, y, 8, fontBold, blue);
  y -= 18;
  field('Printed Name', data.cccmName, 40, y, 200);
  field('CCCM License Expiry', data.cccmLicenseExpiry, 260, y, 140);
  field('Date', data.cccmSignatureDate, 420, y, 150);
  y -= 10;
  rect(40, y, 200, 24, rgb(0.95, 0.95, 1));
  text('SIGNATURE', 50, y + 8, 7, fontReg, gray);
  text('(sign and date before submitting)', 100, y + 8, 7, fontReg, rgb(0.7, 0.7, 0.7));

  if (data.secondCccmName) {
    y -= 35;
    text('2ND MECHANIC (if applicable)', 40, y, 8, fontBold, blue);
    y -= 18;
    field('Printed Name', data.secondCccmName, 40, y, 200);
    field('Date', data.secondCccmDate ?? '', 260, y, 140);
  }

  y -= 40;
  line(40, y, width - 40, y, 0.5, gray);
  y -= 15;
  text('AUTHORIZED COMPANY REPRESENTATIVE', 40, y, 8, fontBold, blue);
  y -= 18;
  field('Printed Name & Title', `${data.signerName}${data.signerTitle ? ` — ${data.signerTitle}` : ''}`, 40, y, 200);
  field('Phone', data.signerPhone, 260, y, 100);
  field('Date', data.signerDate, 380, y, 100);

  y -= 20;
  field('Company Name', data.signerCompany, 40, y, 200);
  field('Office Location', data.signerOfficeLocation, 260, y, 310);

  y -= 35;
  rect(40, y, 250, 24, rgb(0.95, 0.95, 1));
  text('AUTHORIZED SIGNATURE', 50, y + 8, 7, fontReg, gray);

  // Footer
  y -= 30;
  line(40, y, width - 40, y, 0.3, gray);
  text('EU-632 (Rev. 1, 8/21/2018)  |  Submit to the Cal/OSHA district office that issued the Preliminary Order', 40, y - 12, 7, fontReg, gray);
  text('Generated by Elev8 Comply', width - 150, y - 12, 7, fontReg, gray);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generates a 48-Hour Advance Notice Letter PDF.
 */
export async function generate48HourNoticePDF(data: AdvanceNoticeData): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);
  const blue = rgb(0.1, 0.2, 0.6);
  const gray = rgb(0.4, 0.4, 0.4);

  const text = (str: string, x: number, y: number, size = 10, font = fontReg, color = black) => {
    if (!str) return;
    page.drawText(str, { x, y, size, font, color });
  };

  const line = (x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: black });
  };

  const wrap = (str: string, x: number, startY: number, maxWidth: number, size = 10): number => {
    const words = str.split(' ');
    let currentLine = '';
    let y = startY;
    const approxCharWidth = size * 0.55;
    const charsPerLine = Math.floor(maxWidth / approxCharWidth);

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= charsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) text(currentLine, x, y, size);
        y -= size + 4;
        currentLine = word;
      }
    }
    if (currentLine) text(currentLine, x, y, size);
    return y - size - 4;
  };

  let y = height - 60;

  // Company letterhead
  text(data.cqccName, 40, y, 14, fontBold, blue);
  y -= 16;
  text('Certified Qualified Conveyance Company (CQCC)', 40, y, 9, fontReg, gray);
  y -= 12;
  text(`CQCC License: ${data.cqccLicenseNumber}`, 40, y, 9, fontReg, gray);

  // Date
  text(data.date, width - 160, height - 60, 10, fontReg, black);

  y -= 30;
  line(40, y, width - 40, y, 1);

  // Recipient
  y -= 25;
  text(data.recipientName, 40, y, 10, fontBold, black);
  y -= 14;
  text(data.recipientCompany, 40, y, 10, fontReg, black);
  y -= 14;
  const recipientLines = data.recipientAddress.split('\n');
  for (const rl of recipientLines) { text(rl, 40, y, 10, fontReg, black); y -= 14; }

  // Subject
  y -= 10;
  text('RE:', 40, y, 10, fontBold, black);
  text(`${data.noticeHours}-Hour Advance Written Notice of Elevator Work`, 60, y, 10, fontBold, blue);
  y -= 14;
  text(`Property: ${data.propertyName} — ${data.propertyAddress}`, 60, y, 10, fontReg, black);
  y -= 14;
  text(`California State ID / Conveyance Number: ${data.stateId}`, 60, y, 10, fontReg, black);

  y -= 20;
  line(40, y, width - 40, y, 0.5);

  // Body
  y -= 20;
  y = wrap(
    `Pursuant to California elevator safety regulations, this letter serves as formal ${data.noticeHours}-hour advance written notice that elevator maintenance and repair work is scheduled at the above-referenced property.`,
    40, y, width - 80
  );

  y -= 20;
  text('SCHEDULED WORK DETAILS', 40, y, 10, fontBold, blue);
  y -= 16;

  const details = [
    ['Property:', data.propertyName],
    ['Address:', data.propertyAddress],
    ['California State ID:', data.stateId],
    ['Elevator / Unit:', data.elevatorDescription],
    ['Scheduled Date:', data.scheduledWorkDate],
    ['Scheduled Time:', data.scheduledWorkTime],
    ['Nature of Work:', data.natureOfWork],
  ];

  for (const [label, value] of details) {
    text(label, 50, y, 10, fontBold, black);
    text(value, 200, y, 10, fontReg, black);
    y -= 16;
  }

  y -= 10;
  text('CERTIFIED QUALIFIED CONVEYANCE COMPANY (CQCC)', 40, y, 10, fontBold, blue);
  y -= 16;
  text(`Company: ${data.cqccName}`, 50, y, 10, fontReg, black);
  y -= 14;
  text(`CQCC License Number: ${data.cqccLicenseNumber}`, 50, y, 10, fontReg, black);
  y -= 14;
  text(`Assigned Mechanic: ${data.mechanicName}`, 50, y, 10, fontReg, black);
  y -= 14;
  text(`CCCM License Number: ${data.mechanicLicenseNumber}`, 50, y, 10, fontReg, black);
  y -= 14;
  text(`Contact: ${data.contactName} — ${data.contactPhone}`, 50, y, 10, fontReg, black);

  y -= 25;
  y = wrap(
    'If you have any questions or need to reschedule, please contact us as soon as possible at the number above. We appreciate your cooperation in maintaining elevator safety compliance.',
    40, y, width - 80
  );

  y -= 25;
  text('Sincerely,', 40, y, 10, fontReg, black);
  y -= 40;
  line(40, y, 240, y, 0.5);
  y -= 14;
  text(data.contactName, 40, y, 10, fontBold, black);
  y -= 14;
  text(data.cqccName, 40, y, 10, fontReg, black);
  y -= 14;
  text(data.contactPhone, 40, y, 10, fontReg, black);

  // Footer
  line(40, 50, width - 40, 50, 0.3);
  text(
    `Generated by Elev8 Comply  |  ${data.cqccName}  |  CQCC License: ${data.cqccLicenseNumber}`,
    40, 36, 7, fontReg, gray,
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generates an EU-787 Annual and 5-Year Test Notification Form PDF.
 */
export async function generateEU787PDF(data: EU787Data): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);
  const blue = rgb(0.1, 0.2, 0.6);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.9, 0.9, 0.9);

  const text = (str: string, x: number, y: number, size = 10, font = fontReg, color = black) => {
    if (!str) return;
    page.drawText(str, { x, y, size, font, color });
  };
  const line = (x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = black) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  };
  const field = (label: string, value: string, x: number, y: number, w = 200) => {
    text(label, x, y + 12, 7, fontReg, gray);
    line(x, y, x + w, y, 0.5, gray);
    text(value, x, y + 2, 9, fontReg, black);
  };
  const rect = (x: number, y: number, w: number, h: number, color = lightGray) => {
    page.drawRectangle({ x, y, width: w, height: h, color });
  };

  let y = height - 50;

  // Header
  rect(40, y - 10, width - 80, 36, blue);
  page.drawText('STATE OF CALIFORNIA — DEPARTMENT OF INDUSTRIAL RELATIONS', {
    x: 50, y: y + 8, size: 8, font: fontBold, color: rgb(1, 1, 1),
  });
  page.drawText('Division of Occupational Safety and Health — Elevator Unit', {
    x: 50, y: y - 2, size: 8, font: fontReg, color: rgb(0.85, 0.85, 1),
  });

  y -= 55;
  text('ANNUAL AND 5 YEAR TEST NOTIFICATION FORM', 40, y, 14, fontBold, blue);
  text('Form EU-787  |  Groups III and IV', width - 220, y, 8, fontReg, gray);

  y -= 10;
  text('File with your district office BEFORE the test. Retain a copy for your records.', 40, y, 7.5, fontReg, gray);

  y -= 15;
  line(40, y, width - 40, y, 1, blue);

  y -= 25;
  field('CALIFORNIA STATE ID / CONVEYANCE NUMBER', data.stateId, 40, y, 220);
  field('NUMBER OF UNITS', String(data.unitCount), 280, y, 100);
  field('GROUP', data.group, 400, y, 80);

  y -= 30;
  field('PROPERTY ADDRESS', data.propertyAddress, 40, y, 280);
  field('CITY', data.city, 340, y, 130);
  field('ZIP', data.zip, 490, y, 80);

  y -= 30;
  field('DRIVE TYPE', data.driveType, 40, y, 160);
  field('TEST TYPE', data.testType, 220, y, 160);
  field('RESCHEDULED?', data.isRescheduled ? 'YES' : 'NO', 400, y, 170);

  y -= 30;
  field('SCHEDULED TEST DATE', data.testDate, 40, y, 180);
  field('SCHEDULED TEST TIME', data.testTime, 240, y, 140);

  y -= 30;
  line(40, y, width - 40, y, 0.5, gray);

  y -= 20;
  text('CERTIFYING MECHANIC (CCCM)', 40, y, 10, fontBold, blue);
  y -= 20;
  field('Mechanic Full Name', data.mechanicName, 40, y, 240);
  field('CCCM License Number', data.mechanicLicenseNumber, 300, y, 160);
  field('License Expiry Date', data.mechanicLicenseExpiry, 480, y, 90);

  y -= 35;
  line(40, y, width - 40, y, 0.5, gray);

  y -= 20;
  text('DISTRICT OFFICE', 40, y, 10, fontBold, blue);
  y -= 20;
  field('Submitting to District Office', data.districtOffice, 40, y, 500);

  y -= 40;
  rect(40, y - 6, width - 80, 32, rgb(1, 0.97, 0.9));
  text('NOTE: Confirm the test witnessing requirements with your district office. A test that is not witnessed may require re-testing at $225/hour.', 48, y + 14, 7.5, fontReg, black);
  text('Retain proof of submission. Rescheduling may require advance notice — confirm with your district office.', 48, y + 2, 7.5, fontReg, black);

  // Footer
  line(40, 50, width - 40, 50, 0.3);
  text('EU-787  |  Submit to Cal/OSHA District Office before the test  |  Generated by Elev8 Comply', 40, 36, 7, fontReg, gray);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
