// The SMS program in one place: the exact text of every message the app sends, and
// who gets each one. The code that sends texts and the pages that describe them
// (/sms, Privacy, Terms, consent pop-up) both read from here, so what we tell
// carriers and users always matches what we actually send.

export const SMS_PROGRAM_COMPANY = 'Precision Lift Co.';

/** Sent once, right after someone opts in. */
export const SMS_WELCOME_TEXT =
  `Elev8 Comply (${SMS_PROGRAM_COMPANY}): You're opted in to text alerts about your elevator ` +
  `compliance work. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.`;

export function smsWorkOrderAssigned(when: string): string {
  return `Elev8 Comply: You have been assigned a new job on ${when}. Log in to view your work order details.`;
}

export function smsWorkOrderDispatched(when: string): string {
  return `Elev8 Comply DISPATCH: You are dispatched for ${when}. Open the app for your full dispatch packet.`;
}

export function smsFortyEightHourDue(p: { urgent: boolean; hoursLeft: number; place: string; date: string; workOrderId: string }): string {
  return `${p.urgent ? '⚠️ URGENT' : '⚠️'} ELEV8 COMPLY — 48HR NOTICE DUE IN ${p.hoursLeft}H\n` +
    `${p.place} on ${p.date}. Send building notice now.\nelev8comply.com/work-orders/${p.workOrderId}`;
}

export function smsFortyEightHourOverdue(p: { place: string; date: string; workOrderId: string }): string {
  return `🚨 ELEV8 COMPLY — 48HR NOTICE OVERDUE\n` +
    `${p.place} on ${p.date} is now HELD. Mark notice sent before dispatching.\nelev8comply.com/work-orders/${p.workOrderId}`;
}

/** Every message type, with who receives it and a real example — shown on the public pages. */
export const SMS_MESSAGE_TYPES: Array<{ label: string; who: string; when: string; example: string }> = [
  {
    label: 'Opt-in confirmation',
    who: 'Everyone who opts in',
    when: 'Once, right after you opt in',
    example: SMS_WELCOME_TEXT,
  },
  {
    label: 'Work order assigned',
    who: 'Technicians',
    when: 'When a job is assigned to you',
    example: smsWorkOrderAssigned('Monday, Nov 3 at 9:00 AM'),
  },
  {
    label: 'Work order dispatched',
    who: 'Technicians',
    when: 'When you are dispatched to a job',
    example: smsWorkOrderDispatched('Monday, Nov 3 at 9:00 AM'),
  },
  {
    label: '48-hour advance-notice deadline alert',
    who: 'Admins and dispatchers',
    when: '24 hours before the deadline, and again (URGENT) at 4 hours',
    example: smsFortyEightHourDue({ urgent: false, hoursLeft: 23, place: '123 Main St', date: 'Nov 3', workOrderId: '…' }),
  },
  {
    label: '48-hour notice overdue',
    who: 'Admins and dispatchers',
    when: 'If the notice deadline is missed',
    example: smsFortyEightHourOverdue({ place: '123 Main St', date: 'Nov 3 at 9:00 AM', workOrderId: '…' }),
  },
];

/** One-line summary of what the program sends, for consent checkboxes. */
export const SMS_PROGRAM_SUMMARY =
  'an opt-in confirmation, work order assignment and dispatch alerts (technicians), and ' +
  '48-hour advance-notice deadline alerts (admins and dispatchers)';
