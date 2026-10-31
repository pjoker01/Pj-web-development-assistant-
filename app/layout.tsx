import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'PJ Assistant | PJ Web Development',
  description:
    'Your digital business partner. Chat with PJ Web Development about websites, online stores, AI assistants and digital projects.',
  applicationName: 'PJ Web Development Assistant',
  icons: { icon: '/pj-web-development-logo.webp' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
