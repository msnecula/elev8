import { BaseEmail, EmailHeading, EmailText, EmailButton } from './BaseEmail';
import { APP_NAME } from '@/lib/constants';

export function PasswordResetEmail({ name, resetUrl }: { name: string; resetUrl: string }) {
  return (
    <BaseEmail preview={`Reset your ${APP_NAME} password`}>
      <EmailHeading>Reset your password</EmailHeading>
      <EmailText>Hi {name},</EmailText>
      <EmailText>
        We received a request to reset the password for your {APP_NAME} account. Click the button below to
        choose a new one. The link can only be used once.
      </EmailText>
      <EmailButton href={resetUrl}>Reset Password</EmailButton>
      <EmailText style={{ fontSize: '13px', color: '#6b7280' }}>
        If you didn&apos;t ask for this, you can ignore this email — your password won&apos;t change.
      </EmailText>
    </BaseEmail>
  );
}

export default PasswordResetEmail;
