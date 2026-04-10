import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Accept Invitation' };
export default function InvitePage() {
  return (
    <div className="text-center p-8">
      <p className="text-muted-foreground text-sm">Invite acceptance — coming in a later phase.</p>
    </div>
  );
}
