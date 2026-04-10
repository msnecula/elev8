import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await requireUser();

  const destinations: Record<string, string> = {
    admin: '/notices',
    reviewer: '/notices',
    dispatcher: '/dispatch',
    technician: '/technician',
    client: '/client',
  };

  redirect(destinations[user.role] ?? '/notices');
}
