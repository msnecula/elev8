import { BaseEmail, EmailHeading, EmailText, EmailButton, EmailInfoBox } from './BaseEmail';
import { APP_NAME } from '@/lib/constants';

// Sent to the NEW address: the link applies the change.
export function ConfirmEmailChangeEmail({
  name,
  fromEmail,
  toEmail,
  confirmUrl,
}: {
  name: string;
  fromEmail: string;
  toEmail: string;
  confirmUrl: string;
}) {
  return (
    <BaseEmail preview={`Confirm your new ${APP_NAME} email address`}>
      <EmailHeading>Confirm your new email address</EmailHeading>
      <EmailText>Hi {name},</EmailText>
      <EmailText>
        You asked to change the email you use to sign in to {APP_NAME} from <strong>{fromEmail}</strong> to{' '}
        <strong>{toEmail}</strong>. Click the button below to confirm.
      </EmailText>
      <EmailButton href={confirmUrl}>Confirm New Email</EmailButton>
      <EmailText style={{ fontSize: '13px', color: '#6b7280' }}>
        This link expires in 24 hours. Until you confirm, you keep signing in with {fromEmail}. If you didn&apos;t
        ask for this, ignore this email and nothing will change.
      </EmailText>
    </BaseEmail>
  );
}

// Sent to the OLD address: a heads-up in case someone else made the request.
export function EmailChangeRequestedNotice({
  name,
  fromEmail,
  toEmail,
}: {
  name: string;
  fromEmail: string;
  toEmail: string;
}) {
  return (
    <BaseEmail preview={`A change to your ${APP_NAME} sign-in email was requested`}>
      <EmailHeading>Email change requested</EmailHeading>
      <EmailText>Hi {name},</EmailText>
      <EmailText>
        Someone signed in to your {APP_NAME} account asked to change its sign-in email from{' '}
        <strong>{fromEmail}</strong> to <strong>{toEmail}</strong>. The change only happens once the new address
        is confirmed.
      </EmailText>
      <EmailInfoBox variant="warning">
        If this wasn&apos;t you, contact your administrator right away and change your password.
      </EmailInfoBox>
    </BaseEmail>
  );
}
