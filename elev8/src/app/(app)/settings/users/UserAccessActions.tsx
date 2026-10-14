'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { toast } from '@/lib/toast';
import { resendInvite, setUserActive } from '@/server/actions/users';
import { Loader2, Mail, UserCheck, UserX } from 'lucide-react';

interface UserAccessActionsProps {
  userId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isSelf: boolean;
}

export default function UserAccessActions({ userId, fullName, email, isActive, isSelf }: UserAccessActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isToggling, startToggle] = useTransition();
  const [isSending, startSend] = useTransition();

  function toggleActive() {
    startToggle(async () => {
      const result = await setUserActive(userId, !isActive);
      setConfirmOpen(false);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(isActive ? `${fullName} deactivated` : `${fullName} reactivated`);
      router.refresh();
    });
  }

  function sendInvite() {
    startSend(async () => {
      const result = await resendInvite(userId);
      if (!result.success) { toast.error(result.error); return; }
      toast.success('Invite sent', { description: `A "set your password" link was emailed to ${email}.` });
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={sendInvite} disabled={isSending || !isActive}>
        {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
        Resend invite
      </Button>

      {!isSelf && (
        isActive ? (
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)}>
            <UserX className="mr-2 h-4 w-4" />
            Deactivate user
          </Button>
        ) : (
          <Button variant="outline" onClick={toggleActive} disabled={isToggling}>
            {isToggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
            Reactivate user
          </Button>
        )
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Deactivate ${fullName}?`}
        description="They will be signed out and won't be able to sign in. Their past jobs, work orders and forms keep their name. You can reactivate them at any time."
        confirmLabel="Deactivate"
        destructive
        loading={isToggling}
        onConfirm={toggleActive}
      />
    </div>
  );
}
