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

- Node.js 20+
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
