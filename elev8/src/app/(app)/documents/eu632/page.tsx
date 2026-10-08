import { redirect } from 'next/navigation';

export default async function EU632Page({
  searchParams,
}: {
  searchParams: Promise<{ noticeId?: string }>;
}) {
  const { noticeId } = await searchParams;
  const target = noticeId
    ? `/documents/generate?formType=eu632&noticeId=${noticeId}`
    : '/documents/generate?formType=eu632';
  redirect(target);
}
