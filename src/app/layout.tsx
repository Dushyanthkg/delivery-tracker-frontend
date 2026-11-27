import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import { AuthHydrator } from '@/features/auth/AuthHydrator';
import { ThemeSync } from '@/components/theme/ThemeSync';
import { Toaster } from '@/components/ui/Toast';
import { THEME_COLORS, themeInitScript } from '@/lib/theme';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'DeliveryTrack', template: '%s · DeliveryTrack' },
  description: 'Real-time delivery partner tracking',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets content extend under notches / Android system bars; layouts pad with --safe-*.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning: the Capacitor Android app injects safe-area CSS variables
    // into <html>'s style, and the theme script sets data-theme, before React hydrates.
    // Applies to this element's attributes only.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-theme before first paint (no flash). Static string — see lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text">
        <AuthHydrator />
        <ThemeSync />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
