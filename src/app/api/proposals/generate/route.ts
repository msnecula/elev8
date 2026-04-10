import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateAIProposal } from '@/server/actions/proposals';
import { z } from 'zod';

const schema = z.object({
  jobId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  const result = await generateAIProposal(parsed.data.jobId, parsed.data.templateId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 422 });

  return NextResponse.json({ success: true, data: result.data });
}
