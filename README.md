# AniCount

AniCount is a compact PWA for tracking anime release countdowns. Users can search anime, add multiple titles to a watchlist, and see the next upcoming release in their own local date and time.

## Features

- Browse upcoming anime and search across the wider anime catalog
- Add multiple anime to a watchlist
- Show a main countdown for the next selected anime release
- Display the next episode date and time in the watchlist
- Save watchlist data locally for repeat visits
- Install as a PWA with offline support for saved data

## Tech Stack

- React
- TypeScript
- Vite
- `vite-plugin-pwa`

## Getting Started

### Requirements

- Node.js 22.18+ (supports the TypeScript regression tests)
- npm

### Install

```bash
npm install
```

### Run Dev Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```text
src/
  App.tsx         Main app logic and UI
  App.css         App-specific styling
  index.css       Global theme and layout tokens
public/
  favicon.svg
  pwa-192.svg
  pwa-512.svg
```

## Notes

- Release times are shown in the user's local timezone.
- Watchlist selections are stored in `localStorage`.
- The app is configured as a standalone PWA with automatic service worker updates.

## Security and deployment

Run `npm test`, `npm run lint`, `npm run build`, and `npm audit` when updating dependencies or security-sensitive code.

Production security headers are defined in `vite.config.ts`. The build emits `dist/_headers` for static deployments on Netlify or Cloudflare Pages. Upload the entire `dist/` directory, including `_headers`. Other hosts must apply the equivalent headers through their own server/CDN configuration; serving the file alone does not enforce them. Functions or worker routes may also need their own header configuration.

`npm run preview` sends the same headers for local production checks. After deployment, inspect the HTML response headers to confirm `Content-Security-Policy` (including `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY` are present. These protections require real response headers, not HTML meta tags. Serve production over HTTPS.

The build also embeds a valid CSP meta fallback for resource restrictions, excluding the unsupported `frame-ancestors` directive. This fallback does not replace the hosting header configuration. Header-file formats follow the [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/headers/) and [Netlify](https://docs.netlify.com/manage/routing/headers/) documentation.
