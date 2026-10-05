import { BaseEmail, EmailHeading, EmailText, EmailButton, EmailInfoBox } from './BaseEmail';
import { APP_NAME } from '@/lib/constants';

interface InviteEmailProps {
  inviteeName: string;
  accountName: string;
  inviteUrl: string;
  tempPassword?: string;
}

export function InviteEmail({
  inviteeName,
  accountName,
  inviteUrl,
  tempPassword,
}: InviteEmailProps) {
  return (
    <BaseEmail
      preview={`You've been invited to ${APP_NAME} — ${accountName}`}
    >
      <EmailHeading>Welcome to {APP_NAME}</EmailHeading>

      <EmailText>Hi {inviteeName},</EmailText>

      <EmailText>
        You have been invited to access the {APP_NAME} client portal for{' '}
        <strong>{accountName}</strong>.
      </EmailText>

      <EmailText>
        Through the portal you can:
      </EmailText>

      <EmailText>
        {'• View the status of your elevator compliance jobs\n'}
        {'• Review and approve proposals\n'}
        {'• Request scheduling for approved work\n'}
        {'• Upload new Order to Comply notices\n'}
        {'• Track technician dispatch and work progress'}
      </EmailText>

      {tempPassword && (
        <EmailInfoBox variant="info">
          Your temporary password is: <strong>{tempPassword}</strong>
          {'\n'}Please change it after your first login.
        </EmailInfoBox>
      )}

      <EmailButton href={inviteUrl}>Accept Invitation &amp; Log In</EmailButton>

      <EmailText style={{ fontSize: '13px', color: '#6b7280' }}>
        If you did not expect this invitation, you can safely ignore this email.
      </EmailText>
    </BaseEmail>
  );
}

export default InviteEmail;
