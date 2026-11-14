import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android rider app (Capacitor shell around the Next.js frontend).
 *
 * The app loads the frontend from CAP_SERVER_URL instead of bundling it, so the
 * rider UI is always the same code as the web app (Next.js routes, sockets, auth).
 * This value is baked in at `npx cap sync` time:
 *
 *   CAP_SERVER_URL=http://192.168.1.103:3000 npx cap sync android   # dev, phone on same Wi-Fi
 *   CAP_SERVER_URL=https://rider.example.com npx cap sync android   # production
 *
 * Without it the app shows capacitor-shell/index.html with setup instructions.
 */
const serverUrl = process.env.CAP_SERVER_URL?.replace(/\/$/, '');

const config: CapacitorConfig = {
  appId: 'com.deliverytracker.rider',
  appName: 'Delivery Rider',
  webDir: 'capacitor-shell',
  server: serverUrl
    ? {
        url: serverUrl,
        // Plain-http dev servers (LAN IP) need cleartext allowed on Android.
        cleartext: serverUrl.startsWith('http://'),
      }
    : undefined,
  android: {
    // Required by @capacitor-community/background-geolocation: without it Android
    // halts location callbacks into the WebView after ~5 min in the background.
    useLegacyBridge: true,
  },
};

export default config;
