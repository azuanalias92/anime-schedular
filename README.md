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
- Tailwind CSS v4
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
  App.tsx         Main app logic and Tailwind-styled UI
  index.css       Tailwind import, theme tokens, and base styles
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

Production security headers are defined in `vercel.json` and reused by `vite.config.ts`. The build emits `dist/_headers` for static deployments on Netlify or Cloudflare Pages. Upload the entire `dist/` directory, including `_headers`. Other hosts must apply the equivalent headers through their own server/CDN configuration; serving the file alone does not enforce them. Functions or worker routes may also need their own header configuration.

`npm run preview` sends the same headers for local production checks. After deployment, inspect the HTML response headers to confirm `Content-Security-Policy` (including `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY` are present. These protections require real response headers, not HTML meta tags. Serve production over HTTPS.

The build also embeds a valid CSP meta fallback for resource restrictions, excluding the unsupported `frame-ancestors` directive. This fallback does not replace the hosting header configuration. Header-file formats follow the [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/headers/) and [Netlify](https://docs.netlify.com/manage/routing/headers/) documentation.

### Vercel

Vercel Web Analytics is integrated through `@vercel/analytics/react` in `src/main.tsx`. Enable Web Analytics in the Vercel project's Analytics tab, then redeploy to start collecting page views. Local development uses debug mode. The production script and collection endpoint are same-origin and allowed by the existing security policy. See the [Vercel Analytics setup guide](https://vercel.com/docs/analytics/quickstart).

`vercel.json` is the source of truth for production security headers. Vite uses the same headers for preview and the generated CSP fallback. Deploy the repository with Vercel's Vite preset (build: `npm run build`, output: `dist`). The policy permits AniList, the existing watchlist API, Google Identity Services, and the configured fonts and image hosts. Verify the deployed response headers after redeployment. Header configuration follows the [Vercel documentation](https://vercel.com/docs/project-configuration). Google Identity policy entries follow [Google’s setup guidance](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#content_security_policy).
