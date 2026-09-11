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
  title: 'Stride — Your running, considered',
  description:
    'Your personal training journal. Purposeful race plans, thoughtful workouts, and room for real life.',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
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
