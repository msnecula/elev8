import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { triggerNoticeParsing } from '@/server/actions/notices';
import { z } from 'zod';

const schema = z.object({ noticeId: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'noticeId is required and must be a UUID' }, { status: 400 });
  }

  const result = await triggerNoticeParsing(parsed.data.noticeId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 422 });

  return NextResponse.json({ success: true, jobId: result.data.jobId });
}
