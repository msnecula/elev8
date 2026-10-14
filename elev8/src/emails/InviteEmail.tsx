import { BaseEmail, EmailHeading, EmailText, EmailButton } from './BaseEmail';
import { APP_NAME, ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/auth';

interface InviteEmailProps {
  inviteeName: string;
  role: UserRole;
  accountName?: string;
  inviteUrl: string;
  isReminder?: boolean;
}

export function InviteEmail({
  inviteeName,
  role,
  accountName,
  inviteUrl,
  isReminder = false,
}: InviteEmailProps) {
  const isClient = role === 'client';
  const where = isClient && accountName ? ` — ${accountName}` : '';

  return (
    <BaseEmail preview={`You've been invited to ${APP_NAME}${where}`}>
      <EmailHeading>Welcome to {APP_NAME}</EmailHeading>

      <EmailText>Hi {inviteeName},</EmailText>

      {isClient ? (
        <>
          <EmailText>
            You have been invited to access the {APP_NAME} client portal
            {accountName ? <> for <strong>{accountName}</strong></> : null}.
          </EmailText>
          <EmailText>Through the portal you can:</EmailText>
          <EmailText>
            {'• View the status of your elevator compliance jobs\n'}
            {'• Review and approve proposals\n'}
            {'• Request scheduling for approved work\n'}
            {'• Upload new Order to Comply notices\n'}
            {'• Track technician dispatch and work progress'}
          </EmailText>
        </>
      ) : (
        <EmailText>
          You have been added to {APP_NAME} as a <strong>{ROLE_LABELS[role]}</strong>.
        </EmailText>
      )}

      <EmailText>
        Click the button below to set your password and sign in. This link can only be used once
        and expires after 24 hours.
      </EmailText>

      <EmailButton href={inviteUrl}>
        {isReminder ? 'Set Your Password' : 'Accept Invitation & Set Password'}
      </EmailButton>

      <EmailText style={{ fontSize: '13px', color: '#6b7280' }}>
        If you did not expect this invitation, you can safely ignore this email.
      </EmailText>
    </BaseEmail>
  );
}

export default InviteEmail;
