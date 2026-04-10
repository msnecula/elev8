import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { APP_NAME } from '@/lib/constants';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { template: `%s | ${APP_NAME}`, default: APP_NAME },
  description: 'Elevator compliance management — notices, proposals, dispatch, and technician workflows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background`}>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
