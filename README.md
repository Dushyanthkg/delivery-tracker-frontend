# Delivery Tracker — Frontend

Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind v4 + Zustand + React-Leaflet/OpenStreetMap.
Independent project — talks to the backend only via REST + Socket.io.

## Setup

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                  # http://localhost:3000  (backend must be running)
```

Demo logins (after `npm run seed` in the backend): `customer@demo.com`, `rider@demo.com`, `admin@demo.com` — password `Password123!`. The login page has one-click demo buttons.

## Try the full live loop on one laptop

1. Window A: log in as **rider** → `/rider/dashboard`
2. Window B (incognito): log in as **customer** → open the "Rider assigned" order
3. Window C (another profile): log in as **admin** → `/admin/dispatch`
4. In A pick `10×` and press **Simulate Rider Route** → the marker glides on B and C, ETA counts down.
5. Confirm pickup → Head to drop-off → simulate again → Mark as delivered.

Real GPS (`Start Delivery`) needs HTTPS or `localhost`. To test on a phone, tunnel both ports (e.g. `cloudflared tunnel --url http://localhost:3000`).

## Structure

```
src/
  app/                    routes (thin server pages → client feature views)
  features/               auth | customer | rider | admin  (page-level views)
  components/map/         LiveTrackingMap, SmoothRiderMarker, RoutePolyline, …
  components/ui|order/    design-system bits, StatusStepper, EtaPanel
  hooks/                  useSocket, useOrderRoom, useGeolocation, useRouteSimulator, useNow
  store/                  useTrackingStore (live data), useAuthStore (session)
  services/               api.ts (Axios), socket.ts (typed client), types.ts (contract copy)
  lib/                    geo math, formatting, config
```

## Performance design

- **No re-render per GPS tick.** `SmoothRiderMarker` subscribes to the Zustand store outside React and moves the Leaflet marker with `requestAnimationFrame` (3 s glide, shortest-arc bearing rotation). Only tiny components like `EtaPanel` re-render, via narrow selectors.
- **Throttled GPS.** Emit when ≥3 s and ≥10 m moved, or every 5 s heartbeat (`lib/config.ts`).
- **One socket per tab**, ref-counted; auto-rejoins rooms after every reconnect.

## Contract

`src/services/types.ts` must stay identical to `backend/src/shared/types.ts`. After changing the backend copy:
`cp ../backend/src/shared/types.ts src/services/types.ts` (then fix the header comment).

## Notes

- OSM's public tile server (the "Classic" style) is fine for development; for production traffic use a tile provider (MapTiler, Stadia, Thunderforest — all have free tiers).

## Customising the map

Everything visual lives in `src/components/map/theme.ts`:

- **Base styles** — the list shown in the on-map **Map** switcher (Brand, Streets, Light, Dark via [OpenFreeMap](https://openfreemap.org) vector tiles, no key; Satellite via Esri; Classic OSM). Add, remove or reorder entries; `defaultStyle` is what new viewers see.
- **Brand colours** — `brand.*` recolours the Brand style at runtime. For a fully custom design (fonts, which roads/POIs show), build a style in MapTiler/Stadia/Maputnik and set `NEXT_PUBLIC_MAP_BRAND_STYLE_URL`.
- **Markers & route** — `rider` (single colour or a stable per-rider palette, vehicle glyph `arrow` | `car` | `dot`), `places` (pin colours/glyphs), `route` (colour, casing, width).

**3D view** — the **3D** button next to **Map** switches to a tilted MapLibre map with extruded buildings (zoom in to street level; right-drag or Ctrl+drag to rotate/tilt, or use the compass control). Same styles, riders, route, pins, follow and toggles as 2D; the camera carries over when switching. Rider animation is shared by both views (`components/map/riderGlide.ts`), and 3D-specific code lives in `Map3D.tsx` / `maplibre.ts`.

Viewers' chosen style, layer toggles (Riders / Route / Pins) and 2D/3D mode are saved per browser (`store/useMapPrefsStore.ts`). Vector styles render inside Leaflet via `@maplibre/maplibre-gl-leaflet`, so markers and the smooth rider animation work the same on every style.
- Auth is Bearer-token in localStorage (mirrors mobile clients). Keep XSS surface minimal — no `dangerouslySetInnerHTML` with user data.

## Android rider app (background GPS)

Browsers stop GPS when the phone locks. The Android app (Capacitor, in `android/`) wraps this same
frontend and uses `@capacitor-community/background-geolocation` — a foreground service with a
"Delivery in progress" notification — so tracking continues with the screen locked.
`useGeolocation` switches to it automatically when running inside the app.

The app loads the frontend from `CAP_SERVER_URL` (baked in at sync time). For a phone on the same Wi-Fi:

1. `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://<LAN-IP>:4000`
2. `backend/.env`: add `http://<LAN-IP>:3000` to `CORS_ORIGINS`
3. Run backend + `npm run dev`, then:
   ```bash
   CAP_SERVER_URL=http://<LAN-IP>:3000 npm run android:build   # → android/app/build/outputs/apk/debug/app-debug.apk
   # or: CAP_SERVER_URL=... npm run android:sync && npm run android:open   (run from Android Studio)
   ```
4. On the phone: allow location ("While using the app" is enough) and notifications.

For production, deploy the frontend over HTTPS and sync with `CAP_SERVER_URL=https://your-domain`.
Some OEMs (Xiaomi, Samsung, Oppo…) kill background services aggressively — riders may need to set
the app's battery usage to "Unrestricted".
