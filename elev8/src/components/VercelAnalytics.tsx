'use client';

import { Analytics } from '@vercel/analytics/next';

// Invite, reset and email-confirm links carry one-time tokens in the query
// string or hash; report only the path so those never reach analytics.
export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => ({ ...event, url: event.url.split(/[?#]/)[0] })}
    />
  );
}
