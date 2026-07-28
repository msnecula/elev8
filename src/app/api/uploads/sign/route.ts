import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export async function GET(request: Request) {
  await requireUser();
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const bucket = searchParams.get('bucket') ?? 'notices';
  const redirect = searchParams.get('redirect') === 'true';

  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const supabase = await createServerClient();
  // 60 minutes for viewing
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If redirect=true, send straight to the file (for View PDF links)
  if (redirect) {
    return NextResponse.redirect(data.signedUrl);
  }

  return NextResponse.json({ url: data.signedUrl });
}
