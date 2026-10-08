'use client';

import { useEffect } from 'react';

/**
 * Overrides the root layout's `overflow-hidden` on <html> and <body>
 * so the /privacy page can scroll normally.
 * Restores the original values when the component unmounts (navigation away).
 */
export default function ScrollEnabler() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'auto';
    body.style.overflow = 'auto';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return null;
}
