import type { Metadata, Viewport } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';
import './stride-design.css';
import './app-shell.css';
import './dashboard.css';
import './access.css';
import './watch-sync.css';
import './brand.css';
import './daily-guide.css';
import './plan-customization.css';
import './notifications.css';
import './plan-explorer.css';
import './workout-inspection.css';
import { APPEARANCE_BOOTSTRAP } from '@/lib/appearance';

const journalSans = Manrope({
  variable: '--font-journal-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const spatialDisplay = Space_Grotesk({
  variable: '--font-spatial-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Stride — Marathon training that fits your week',
  description:
    'Build around your recent running and the time you actually have. Compare training plans, understand the tradeoffs, and stay in control of every change.',
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1115' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${journalSans.variable} ${spatialDisplay.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
