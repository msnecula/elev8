/**
 * Local drop-in shim replacing the `react-email` package.
 *
 * react-email's component exports are just thin HTML wrappers. Using them directly
 * caused Turbopack/Next.js 16 build failures because of ESM resolution issues with
 * the react-email package itself. These plain JSX equivalents are identical in output.
 */

import React from 'react';

type StyleProps = { style?: React.CSSProperties };
type WithChildren = { children?: React.ReactNode };
type HtmlProps = WithChildren & { lang?: string };

export function Html({ children, lang = 'en' }: HtmlProps) {
  return (
    <html lang={lang} dir="ltr">
      {children}
    </html>
  );
}

export function Head({ children }: WithChildren) {
  return (
    <head>
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      {children}
    </head>
  );
}

/** Email preview text — rendered as a hidden zero-height div for inbox previews */
export function Preview({ children }: WithChildren) {
  return (
    <div
      style={{
        display: 'none',
        overflow: 'hidden',
        lineHeight: '1px',
        opacity: 0,
        maxHeight: 0,
        maxWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

export function Body({ children, style }: WithChildren & StyleProps) {
  return <body style={style}>{children}</body>;
}

export function Container({ children, style }: WithChildren & StyleProps) {
  return <div style={style}>{children}</div>;
}

export function Section({ children, style }: WithChildren & StyleProps) {
  return <div style={style}>{children}</div>;
}

export function Text({ children, style }: WithChildren & StyleProps) {
  return <p style={style}>{children}</p>;
}

export function Heading({
  children,
  style,
  as: Tag = 'h2',
}: WithChildren & StyleProps & { as?: 'h1' | 'h2' | 'h3' }) {
  return <Tag style={style}>{children}</Tag>;
}

export function Hr({ style }: StyleProps) {
  return <hr style={style} />;
}

export function Link({
  children,
  href,
  style,
  target,
}: WithChildren & StyleProps & { href?: string; target?: string }) {
  return (
    <a href={href} style={style} target={target}>
      {children}
    </a>
  );
}

export function Img({
  src,
  alt,
  width,
  height,
  style,
}: StyleProps & { src?: string; alt?: string; width?: number; height?: number }) {
  return <img src={src} alt={alt ?? ''} width={width} height={height} style={style} />;
}
