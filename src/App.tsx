import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  messages,
  localeNames,
  localeShortNames,
  readLocale,
  saveLocale,
  readTheme,
  applyTheme,
  translateLabel,
  translateSeason,
  type Locale,
  type Messages,
  type ThemePreference,
  type SyncStatus,
  type AuthErrorKind,
} from "./i18n";

declare const __APP_VERSION__: string;
import {
  getStoredUser,
  consumeRedirectLogin,
  startGoogleSignIn,
  clearAuth,
  fetchRemoteWatchlist,
  pushWatchlist,
  getLocalRevision,
  bumpLocalRevision,
  readSyncState,
  writeSyncState,
  resolveLoginSync,
  type AuthUser,
} from "./auth";

// Read once at startup, before the first render stores or clears the session.
const redirectLogin = consumeRedirectLogin();

// Component styles follow the tokens and specs in Design.md.
const buttonBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-sm border px-6 text-button-md uppercase cursor-pointer transition-[background,border-color,opacity] duration-150 ease-[ease] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 compact:h-11 compact:px-7";
// px-0! must beat buttonBase's px-6: Tailwind orders same-property utilities by value,
// not class order, so a plain px-0 loses and squeezes the icon to zero width.
const iconButton = "w-9 flex-none px-0! compact:w-11 compact:px-0!";
const panelBase = "rounded-md bg-canvas p-6 mobile:p-4 compact:p-3";
const insetBase = "grid gap-1 rounded-sm bg-bone p-4 text-body compact:p-3";
const eyebrow = "text-ui-label uppercase text-stone";
const sectionTitle = "m-0 text-display-lg text-ink";
// Countdown cells sit on the dark command surface, like a console's LCD readout.
const countdownCell =
  "flex flex-col items-center justify-center gap-2 rounded-sm bg-deep/85 px-2 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] [&>strong]:block [&>strong]:text-countdown [&>strong]:tabular-nums [&>strong]:text-on-dark [&>span]:text-ui-label [&>span]:uppercase [&>span]:text-on-dark-mute mobile:px-1 mobile:py-2 mobile:[&>strong]:text-display-lg compact:[&>span]:text-caption";
const badgeBase = "inline-flex h-[18px] items-center rounded-xs px-1.5 text-caption uppercase text-on-dark";
const primaryButton = `${buttonBase} border-transparent bg-primary text-on-primary shadow-level1 hover:bg-primary-hover active:bg-primary-active`;
const secondaryButton = `${buttonBase} border-transparent bg-secondary text-on-secondary shadow-level1 hover:bg-secondary-hover active:bg-secondary-active`;
const ghostButton = `${buttonBase} border-transparent bg-transparent text-ink hover:border-hairline active:bg-primary/6`;
// Ghost variant for dark alert surfaces, where ink text would lose contrast.
const alertButton = `${buttonBase} border-on-dark-mute bg-transparent text-on-dark hover:bg-on-dark/10`;
const accentPanel = `${panelBase} flex flex-col gap-4`;
const emptyState = `${insetBase} [&>p]:font-bold [&>p]:text-ink [&>span]:text-charcoal`;
const countdownUnavailable = "col-span-full grid gap-1 rounded-sm bg-deep p-4 [&>strong]:text-hero-tagline [&>strong]:text-on-dark [&>span]:text-on-dark-mute";
const alertBase = "flex flex-wrap items-center gap-3 rounded-sm px-4 py-3 text-on-dark";
const statusBanner = `${alertBase} bg-info`;
const errorBanner = `${alertBase} bg-danger`;

const API_BASE = "https://graphql.anilist.co";
const PAGE_SIZE = 24;
const WATCHLIST_STORAGE_KEY = "anime-countdown-watchlist";

const MEDIA_FIELDS = `
    id
    title { romaji english native }
    coverImage { large }
    startDate { year month day }
    season
    seasonYear
    status
    description
    averageScore
    episodes
    popularity
    genres
    studios { nodes { name } }
    nextAiringEpisode { airingAt timeUntilAiring episode }
  `;

async function fetchWithRetry(query: string, variables: Record<string, unknown> = {}, retries = 2, signal?: AbortSignal): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(API_BASE, {
      signal,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (res.ok || res.status === 404) return res;
    // Only retry on 5xx gateway/server errors
    if (res.status < 500 || i === retries) return res;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return fetch(API_BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
}

type AniListDate = { year: number | null; month: number | null; day: number | null };

type AnimeApiItem = {
  id: number;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    large: string;
  };
  startDate: AniListDate;
  season: string | null;
  seasonYear: number | null;
  status: string;
  description: string | null;
  averageScore: number | null;
  episodes: number | null;
  popularity: number | null;
  genres: string[];
  studios: { nodes: Array<{ name: string }> };
  nextAiringEpisode: {
    airingAt: number;
    timeUntilAiring: number;
    episode: number;
  } | null;
};

type AnimeListApiResponse = {
  data: {
    Page: {
      pageInfo: { hasNextPage: boolean };
      media: AnimeApiItem[];
    };
  };
};

type AnimeCardData = {
  malId: number;
  title: string;
  imageUrl: string;
  airing: boolean;
  releaseAt: string | null;
  releaseLabel: string;
  broadcastLabel: string;
  broadcastDay: string | null;
  broadcastTime: string | null;
  broadcastTimezone: string | null;
  seasonLabel: string;
  synopsis: string;
  status: string;
  score: number | null;
  episodes: number | null;
  members: number | null;
  studio: string;
  genres: string[];
  nextAiringAt: number | null;
};

type CountdownParts = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

type EpisodeScheduleSource = Pick<AnimeCardData, "airing" | "releaseAt" | "status" | "nextAiringAt">;

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.1rem] fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.1rem] fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

// Share of the row width a left swipe must pass to remove it on release.
const SWIPE_REMOVE_RATIO = 0.35;
// Movement before a press counts as a swipe, so taps and vertical scrolls pass through.
const SWIPE_SLOP_PX = 8;
const SWIPE_SETTLE_MS = 180;

// Row that can be swiped left to reveal and trigger a remove action. Vertical
// panning stays native (touch-action: pan-y); keyboard and screen-reader users
// keep the row's own remove button.
function SwipeToRemove({ onRemove, removeLabel, className, children }: { onRemove: () => void; removeLabel: string; className: string; children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  // The parent re-renders every second for the countdown, so read the latest
  // callback through a ref instead of restarting the removal timer.
  const onRemoveRef = useRef(onRemove);
  const gesture = useRef<{ pointerId: number; startX: number; startY: number; dragging: boolean } | null>(null);
  const offsetRef = useRef(0);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    onRemoveRef.current = onRemove;
  });

  useEffect(() => {
    if (!removing) return;
    const timer = window.setTimeout(() => onRemoveRef.current(), SWIPE_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [removing]);

  function moveTo(next: number) {
    offsetRef.current = next;
    setOffset(next);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (removing || (event.pointerType === "mouse" && event.button !== 0)) return;
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
    suppressClick.current = false;
    setSettling(false);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;

    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (!current.dragging) {
      if (Math.abs(dy) > SWIPE_SLOP_PX && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null; // A vertical scroll, not a swipe.
        return;
      }
      if (dx > -SWIPE_SLOP_PX) return;
      current.dragging = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    moveTo(Math.min(0, dx));
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    gesture.current = null;
    if (!current?.dragging) return;

    const width = rowRef.current?.offsetWidth ?? 0;
    setSettling(true);

    if (event.type === "pointerup" && width > 0 && -offsetRef.current > width * SWIPE_REMOVE_RATIO) {
      moveTo(-width);
      setRemoving(true);
    } else {
      moveTo(0);
    }
  }

  return (
    <li className="relative overflow-hidden rounded-sm shadow-level1">
      <div className="absolute inset-0 flex items-center justify-end gap-2 bg-danger px-4 text-button-md uppercase text-on-dark" aria-hidden="true">
        <TrashIcon />
        {removeLabel}
      </div>
      <div
        ref={rowRef}
        className={`relative touch-pan-y select-none ${settling ? "transition-transform duration-180 ease-out" : ""} ${className}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={(event) => {
          // A drag ending over the remove button must not also click it.
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}

// Google's "G" mark in its brand colors, as its sign-in branding guidelines require.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-4 flex-none">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.1rem] fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.1rem] fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.1rem] fill-none stroke-current stroke-[1.9] [stroke-linecap:round] [stroke-linejoin:round]">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function getUserLocale(): string | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  return navigator.language;
}

function formatLocalDateTime(isoDate: string | null, t: Messages = messages.en): string {
  if (!isoDate) {
    return t.dateTba;
  }

  const parsedDate = new Date(isoDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return t.dateTba;
  }

  return new Intl.DateTimeFormat(t.dateLocale ?? getUserLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function formatNextEpisodeLabel(isoDate: string | null, t: Messages): string {
  if (!isoDate) {
    return t.nextEpisodeDateTba;
  }

  const parsedDate = new Date(isoDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return t.nextEpisodeDateTba;
  }

  const weekday = new Intl.DateTimeFormat(t.dateLocale ?? getUserLocale(), { weekday: "long" }).format(parsedDate);
  return `${weekday}, ${formatLocalDateTime(isoDate, t)}`;
}

// Start dates are stored at UTC noon, so show the date only.
function formatReleaseDate(isoDate: string | null, t: Messages): string {
  const parsedDate = isoDate ? new Date(isoDate) : null;

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return t.dateTba;
  }

  return new Intl.DateTimeFormat(t.dateLocale ?? getUserLocale(), { dateStyle: "medium" }).format(parsedDate);
}

// English fallbacks saved with each anime; swapped for translations when shown.
const NO_SYNOPSIS = messages.en.noSynopsis;
const STUDIO_TBA = messages.en.studioTba;

function stripSynopsis(synopsis: string | null): string {
  if (!synopsis) {
    return NO_SYNOPSIS;
  }

  // Parse API markup in an inert template, then render only its plain text.
  const template = document.createElement("template");
  template.innerHTML = synopsis;
  template.content.querySelectorAll("script, style, iframe, object").forEach((element) => element.remove());
  template.content.querySelectorAll("br, hr, p, div, li").forEach((element) => {
    element.before(document.createTextNode(" "));
    element.after(document.createTextNode(" "));
  });

  return template.content.textContent?.replace(/\s+/g, " ").trim() || NO_SYNOPSIS;
}

// ─── Next-episode resolution (AniList provides exact timestamps) ─────────────

function resolveNextEpisodeAt(source: EpisodeScheduleSource, nowMs: number): string | null {
  const statusLower = source.status.toLowerCase();

  // Finished / cancelled / hiatus — no next episode
  if (statusLower.includes("finished") || statusLower.includes("cancelled") || statusLower.includes("hiatus")) {
    return null;
  }

  // If we have an exact next airing timestamp, use it
  if (source.nextAiringAt && source.nextAiringAt > nowMs) {
    return new Date(source.nextAiringAt).toISOString();
  }

  // Fallback: use releaseAt for not-yet-aired
  if (source.releaseAt) {
    const releaseMs = new Date(source.releaseAt).getTime();
    if (releaseMs > nowMs) return source.releaseAt;
  }

  return null;
}

function toSeasonLabel(season: string | null, year: number | null): string {
  if (!season && !year) {
    return "Upcoming anime";
  }

  const seasonText = season ? `${season.slice(0, 1).toUpperCase()}${season.slice(1).toLowerCase()}` : "Upcoming";
  return year ? `${seasonText} ${year}` : seasonText;
}

function anilistStatusLabel(status: string): string {
  switch (status) {
    case "NOT_YET_RELEASED":
      return "Not Yet Aired";
    case "RELEASING":
      return "Currently Airing";
    case "FINISHED":
      return "Finished Airing";
    case "CANCELLED":
      return "Cancelled";
    case "HIATUS":
      return "On Hiatus";
    default:
      return status;
  }
}

function startDateToIso(date: AniListDate): string | null {
  if (!date.year || !date.month || !date.day) return null;
  // Use UTC noon to avoid timezone edge cases
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0)).toISOString();
}

function normalizeAnime(anime: AnimeApiItem): AnimeCardData {
  const releaseAt = startDateToIso(anime.startDate);
  return {
    malId: anime.id,
    title: anime.title.english || anime.title.romaji || anime.title.native || "Unknown",
    imageUrl: anime.coverImage?.large || "/favicon.svg",
    airing: anime.status === "RELEASING",
    releaseAt,
    releaseLabel: anime.startDate.year
      ? `${anime.startDate.year}-${String(anime.startDate.month ?? 1).padStart(2, "0")}-${String(anime.startDate.day ?? 1).padStart(2, "0")}`
      : "Date to be announced",
    broadcastLabel: anime.nextAiringEpisode
      ? `Ep ${anime.nextAiringEpisode.episode} — ${formatLocalDateTime(new Date(anime.nextAiringEpisode.airingAt * 1000).toISOString())}`
      : "Broadcast time not announced",
    broadcastDay: null,
    broadcastTime: null,
    broadcastTimezone: null,
    seasonLabel: toSeasonLabel(anime.season, anime.seasonYear),
    synopsis: stripSynopsis(anime.description),
    status: anilistStatusLabel(anime.status),
    score: anime.averageScore,
    episodes: anime.episodes,
    members: anime.popularity,
    studio: anime.studios?.nodes?.[0]?.name || STUDIO_TBA,
    genres: anime.genres ?? [],
    nextAiringAt: anime.nextAiringEpisode ? anime.nextAiringEpisode.airingAt * 1000 : null,
  };
}

function byNearestRelease(a: AnimeCardData, b: AnimeCardData): number {
  const aTime = a.releaseAt ? new Date(a.releaseAt).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.releaseAt ? new Date(b.releaseAt).getTime() : Number.POSITIVE_INFINITY;

  return aTime - bTime;
}

function toFutureTimeOrInfinity(isoDate: string | null, now: number): number {
  if (!isoDate) {
    return Number.POSITIVE_INFINITY;
  }

  const target = new Date(isoDate).getTime();

  if (Number.isNaN(target) || target < now) {
    return Number.POSITIVE_INFINITY;
  }

  return target;
}

function formatCountdown(releaseAt: string | null, now: number): CountdownParts | null {
  if (!releaseAt) {
    return null;
  }

  const target = new Date(releaseAt).getTime();

  if (Number.isNaN(target)) {
    return null;
  }

  const diff = Math.max(target - now, 0);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

// Compact countdown for watchlist rows, e.g. "3d 4h", "4h 12m", "12m".
function formatShortCountdown(releaseAt: string | null, now: number, t: Messages): string {
  const parts = formatCountdown(releaseAt, now);

  if (!parts) {
    return t.shortCountdownTba;
  }

  const days = Number(parts.days);
  const hours = Number(parts.hours);
  const minutes = Number(parts.minutes);

  if (days > 0 || hours > 0 || minutes > 0) return t.shortCountdown(days, hours, minutes);
  return Number(parts.seconds) > 0 ? t.shortCountdownSoon : t.shortCountdownLive;
}

function readStoredWatchlist(): AnimeCardData[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as AnimeCardData[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => typeof item?.malId === "number" && typeof item?.title === "string")
      .map((item) => {
        const imageUrl = typeof item.imageUrl === "string" && item.imageUrl.startsWith("https://") ? item.imageUrl : "/favicon.svg";

        return {
          malId: item.malId,
          title: item.title,
          imageUrl,
          airing: Boolean(item.airing),
          releaseAt: typeof item.releaseAt === "string" ? item.releaseAt : null,
          releaseLabel: formatLocalDateTime(typeof item.releaseAt === "string" ? item.releaseAt : null),
          broadcastLabel: typeof item.broadcastLabel === "string" ? item.broadcastLabel : "Broadcast time not announced",
          broadcastDay: typeof item.broadcastDay === "string" ? item.broadcastDay : null,
          broadcastTime: typeof item.broadcastTime === "string" ? item.broadcastTime : null,
          broadcastTimezone: typeof item.broadcastTimezone === "string" ? item.broadcastTimezone : null,
          seasonLabel: typeof item.seasonLabel === "string" ? item.seasonLabel : "Upcoming anime",
          synopsis: stripSynopsis(typeof item.synopsis === "string" ? item.synopsis : null),
          status: typeof item.status === "string" ? item.status : "Unknown",
          score: typeof item.score === "number" ? item.score : null,
          episodes: typeof item.episodes === "number" ? item.episodes : null,
          members: typeof item.members === "number" ? item.members : null,
          studio: typeof item.studio === "string" ? item.studio : "Studio TBA",
          genres: Array.isArray(item.genres) ? item.genres.filter((g: unknown) => typeof g === "string") : [],
          nextAiringAt: typeof item.nextAiringAt === "number" ? item.nextAiringAt : null,
        };
      })
      .sort(byNearestRelease);
  } catch {
    return [];
  }
}

function dedupeAnimeCards(list: AnimeCardData[]): AnimeCardData[] {
  const deduped = new Map<number, AnimeCardData>();

  list.forEach((item) => {
    deduped.set(item.malId, item);
  });

  return [...deduped.values()];
}

function mergeAnimeCards(currentList: AnimeCardData[], incomingList: AnimeCardData[]): AnimeCardData[] {
  return dedupeAnimeCards([...currentList, ...incomingList]).sort(byNearestRelease);
}

function App() {
  const [upcomingAnime, setUpcomingAnime] = useState<AnimeCardData[]>([]);
  const [searchResults, setSearchResults] = useState<AnimeCardData[]>([]);
  const [watchlist, setWatchlist] = useState<AnimeCardData[]>(readStoredWatchlist);
  const [search, setSearch] = useState("");
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingHasNextPage, setUpcomingHasNextPage] = useState(true);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasNextPage, setSearchHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator === "undefined" ? false : !navigator.onLine);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() => window.__pwaInstallPrompt ?? null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(getStoredUser);
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [theme, setTheme] = useState<ThemePreference>(readTheme);
  const t = messages[locale];
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncError, setSyncError] = useState(false);
  const [syncReadyUser, setSyncReadyUser] = useState<string | null>(null);
  const [syncRetry, setSyncRetry] = useState(0);
  const syncQueue = useRef(Promise.resolve());
  const requestVersion = useRef(0);
  const [authError, setAuthError] = useState<AuthErrorKind | null>(() => {
    if (!redirectLogin || !("error" in redirectLogin)) return null;
    return redirectLogin.error === "access_denied" ? "cancelled" : "failed";
  });
  const [failedRequest, setFailedRequest] = useState<{ query: string; page: number; mode: "replace" | "append" } | null>(null);
  const searchQuery = useMemo(() => search.trim(), [search]);
  const isSearchMode = searchQuery.length > 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    saveLocale(locale);
    document.documentElement.lang = messages[locale].htmlLang;
  }, [locale]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemPrefersDark(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  // useEffect(() => {
  //   const capturePrompt = (event: Event) => setInstallPrompt(event as BeforeInstallPromptEvent);
  //   window.addEventListener("beforeinstallprompt", capturePrompt);
  //   return () => window.removeEventListener("beforeinstallprompt", capturePrompt);
  // }, []);

  // ─── Google Sign-In ────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    clearAuth();
    setAuthUser(null);
    setSyncReadyUser(null);
    setSyncError(false);
    setSyncStatus("local");
  }, []);

  // Read cloud data before uploading, including when restoring a signed-in session.
  useEffect(() => {
    if (!authUser || syncReadyUser === authUser.id) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSyncStatus("loading");
      setSyncError(false);
      try {
        const remote = await fetchRemoteWatchlist();
        if (cancelled) return;
        const remoteItems = remote.items.filter(
          (item) => typeof item.malId === "number" && typeof item.title === "string" && typeof item.status === "string",
        ) as AnimeCardData[];
        const strategy = resolveLoginSync(readSyncState(), authUser.id, getLocalRevision(), remote.updatedAt);
        setWatchlist((current) => {
          if (strategy === "local") return current;
          if (strategy === "remote") return dedupeAnimeCards(remoteItems).sort(byNearestRelease);
          return dedupeAnimeCards([...current, ...remoteItems]).sort(byNearestRelease);
        });
        setSyncReadyUser(authUser.id);
      } catch {
        if (!cancelled) {
          setSyncError(true);
          setSyncStatus("failed");
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authUser, syncReadyUser, syncRetry]);

  useEffect(() => {
    if (!authUser || syncReadyUser !== authUser.id) return;
    let cancelled = false;
    const userId = authUser.id;
    // Captured with this render's list so a newer edit is never recorded as synced.
    const revision = getLocalRevision();
    const statusTimer = window.setTimeout(() => {
      setSyncStatus("saving");
      setSyncError(false);
    }, 0);
    const timer = window.setTimeout(() => {
      // Serialize writes so an older request cannot overwrite a newer watchlist.
      syncQueue.current = syncQueue.current.then(async () => {
        if (cancelled) return;
        try {
          const saved = await pushWatchlist(watchlist);
          if (!saved) throw new Error("Sync failed");
          writeSyncState({ userId, syncedAt: saved.updatedAt, syncedRevision: revision });
          if (!cancelled) setSyncStatus("saved");
        } catch {
          if (!cancelled) {
            setSyncError(true);
            setSyncStatus("failed");
          }
        }
      });
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(statusTimer);
    };
  }, [authUser, syncReadyUser, watchlist, syncRetry]);

  const syncWatchlist = useCallback((incomingList: AnimeCardData[]) => {
    setWatchlist((currentWatchlist) => {
      const incomingById = new Map(incomingList.map((item) => [item.malId, item]));
      let changed = false;

      const synced = currentWatchlist.map((item) => {
        const latest = incomingById.get(item.malId);

        if (!latest) {
          return item;
        }

        const hasChanged =
          item.airing !== latest.airing ||
          item.releaseAt !== latest.releaseAt ||
          item.releaseLabel !== latest.releaseLabel ||
          item.imageUrl !== latest.imageUrl ||
          item.status !== latest.status ||
          item.broadcastLabel !== latest.broadcastLabel ||
          item.broadcastDay !== latest.broadcastDay ||
          item.broadcastTime !== latest.broadcastTime ||
          item.broadcastTimezone !== latest.broadcastTimezone ||
          item.synopsis !== latest.synopsis;

        if (hasChanged) {
          changed = true;
          return latest;
        }

        return item;
      });

      return changed ? synced.sort(byNearestRelease) : currentWatchlist;
    });
  }, []);

  // ─── GraphQL query fragments ──────────────────────────────────────────────

  const loadUpcomingAnime = useCallback(
    async (nextPage: number, mode: "replace" | "append") => {
      const version = ++requestVersion.current;
      setError(null);
      setFailedRequest(null);
      if (mode === "replace") {
        setIsLoading(nextPage === 1);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const query = `query($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            pageInfo { hasNextPage }
            media(type: ANIME, status_in: [NOT_YET_RELEASED, RELEASING], sort: POPULARITY_DESC) {
              ${MEDIA_FIELDS}
            }
          }
        }`;
        const response = await fetchWithRetry(query, { page: nextPage, perPage: PAGE_SIZE });

        if (!response.ok) {
          throw new Error(`Anime data request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as AnimeListApiResponse;
        if (version !== requestVersion.current) return;
        const normalized = dedupeAnimeCards(payload.data.Page.media.map(normalizeAnime).filter((anime) => anime.status !== "Finished Airing")).sort(byNearestRelease);

        setUpcomingAnime((currentList) => (mode === "replace" ? normalized : mergeAnimeCards(currentList, normalized)));
        syncWatchlist(normalized);

        setUpcomingPage(nextPage);
        setUpcomingHasNextPage(payload.data.Page.pageInfo.hasNextPage);
      } catch (caughtError) {
        if (version !== requestVersion.current || (caughtError instanceof DOMException && caughtError.name === "AbortError")) return;
        const message = caughtError instanceof Error ? caughtError.message : "Unable to load upcoming anime right now.";
        setError(message);
        setFailedRequest({ query: "", page: nextPage, mode });
      } finally {
        if (version === requestVersion.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [syncWatchlist],
  );

  const searchAnimeCatalog = useCallback(
    async (query: string, nextPage: number, mode: "replace" | "append", signal?: AbortSignal) => {
      const version = ++requestVersion.current;
      if (!query) {
        setSearchResults([]);
        setSearchPage(1);
        setSearchHasNextPage(false);
        return;
      }

      setError(null);
      setFailedRequest(null);
      if (mode === "replace") {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const gql = `query($search: String, $page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            pageInfo { hasNextPage }
            media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
              ${MEDIA_FIELDS}
            }
          }
        }`;
        const response = await fetchWithRetry(gql, { search: query, page: nextPage, perPage: PAGE_SIZE }, 2, signal);

        if (!response.ok) {
          throw new Error(`Anime search request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as AnimeListApiResponse;
        if (version !== requestVersion.current) return;
        const normalized = dedupeAnimeCards(payload.data.Page.media.map(normalizeAnime));

        setSearchResults((currentList) => (mode === "replace" ? normalized : dedupeAnimeCards([...currentList, ...normalized])));
        syncWatchlist(normalized);

        setSearchPage(nextPage);
        setSearchHasNextPage(payload.data.Page.pageInfo.hasNextPage);
      } catch (caughtError) {
        if (version !== requestVersion.current || (caughtError instanceof DOMException && caughtError.name === "AbortError")) return;
        const message = caughtError instanceof Error ? caughtError.message : "Unable to search anime right now.";
        setError(message);
        setFailedRequest({ query, page: nextPage, mode });
      } finally {
        if (version === requestVersion.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [syncWatchlist],
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void loadUpcomingAnime(1, "replace");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [loadUpcomingAnime]);

  useEffect(() => {
    if (!searchQuery) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void searchAnimeCatalog(searchQuery, 1, "replace", controller.signal);
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchAnimeCatalog, searchQuery]);

  const watchlistIds = useMemo(() => new Set(watchlist.map((anime) => anime.malId)), [watchlist]);
  const visibleAnime = useMemo(() => (isSearchMode ? searchResults : upcomingAnime), [isSearchMode, searchResults, upcomingAnime]);
  const activePage = isSearchMode ? searchPage : upcomingPage;
  const activeHasNextPage = isSearchMode ? searchHasNextPage : upcomingHasNextPage;

  const sortedWatchlist = useMemo(
    () =>
      [...watchlist]
        .map((anime) => ({
          anime,
          nextEpisodeAt: resolveNextEpisodeAt(anime, now),
        }))
        .sort((a, b) => toFutureTimeOrInfinity(a.nextEpisodeAt, now) - toFutureTimeOrInfinity(b.nextEpisodeAt, now))
        .map((entry) => entry.anime),
    [now, watchlist],
  );

  const watchlistWithNextEpisode = useMemo(
    () =>
      sortedWatchlist
        .map((anime) => ({
          anime,
          nextEpisodeAt: resolveNextEpisodeAt(anime, now),
        }))
        .sort((a, b) => toFutureTimeOrInfinity(a.nextEpisodeAt, now) - toFutureTimeOrInfinity(b.nextEpisodeAt, now)),
    [now, sortedWatchlist],
  );

  const nextCountdownEntry = useMemo(() => watchlistWithNextEpisode.find((entry) => entry.nextEpisodeAt) || watchlistWithNextEpisode[0] || null, [watchlistWithNextEpisode]);
  const nextCountdownAnime = nextCountdownEntry?.anime ?? null;
  const nextCountdownAt = nextCountdownEntry?.nextEpisodeAt ?? null;

  const countdown = useMemo(() => formatCountdown(nextCountdownAt, now), [nextCountdownAt, now]);

  function toggleWatchlist(anime: AnimeCardData) {
    bumpLocalRevision();
    setWatchlist((currentWatchlist) => {
      const exists = currentWatchlist.some((item) => item.malId === anime.malId);

      if (exists) {
        return currentWatchlist.filter((item) => item.malId !== anime.malId);
      }

      return [...currentWatchlist, anime].sort(byNearestRelease);
    });
  }

  // async function handleInstall() {
  //   if (!installPrompt) return;
  //   await installPrompt.prompt();
  //   const result = await installPrompt.userChoice;
  //   if (result.outcome === "accepted") {
  //     setInstallPrompt(null);
  //   }
  // }

  function clearWatchlist() {
    bumpLocalRevision();
    setWatchlist([]);
  }

  function renderCountdown() {
    if (!countdown) {
      return (
        <div className={countdownUnavailable}>
          <strong>{t.nextEpisodeTbaTitle}</strong>
          <span>{t.nextEpisodeTbaBody}</span>
        </div>
      );
    }

    if (countdown.days === "00" && countdown.hours === "00" && countdown.minutes === "00" && countdown.seconds === "00") {
      return (
        <div className={countdownUnavailable}>
          <strong>{t.airingNowTitle}</strong>
          <span>{t.airingNowBody}</span>
        </div>
      );
    }

    return (
      <>
        <div className={countdownCell}>
          <strong>{countdown.days}</strong>
          <span>{t.countdownUnits.days}</span>
        </div>
        <div className={countdownCell}>
          <strong>{countdown.hours}</strong>
          <span>{t.countdownUnits.hours}</span>
        </div>
        <div className={countdownCell}>
          <strong>{countdown.minutes}</strong>
          <span>{t.countdownUnits.minutes}</span>
        </div>
        <div className={countdownCell}>
          <strong>{countdown.seconds}</strong>
          <span>{t.countdownUnits.seconds}</span>
        </div>
      </>
    );
  }

  function handleSearchChange(value: string) {
    requestVersion.current++;
    setSearch(value);
    setIsLoading(Boolean(value.trim()));
    setIsLoadingMore(false);
    setSearchResults([]);
    setError(null);
    setFailedRequest(null);

    if (!value.trim() && upcomingAnime.length === 0) {
      void loadUpcomingAnime(1, "replace");
    }
  }

  // Until the user toggles, the theme follows the OS; the toggle flips whatever is showing.
  const effectiveTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  const preferenceControls = (
    <>
      {/* Language: a two-way segmented toggle; the active side uses the dark command surface. */}
      <div className="flex h-9 items-stretch rounded-sm border border-hairline bg-surface p-0.5 compact:h-11" role="group" aria-label={t.languageLabel}>
        {(Object.keys(localeShortNames) as Locale[]).map((code) => (
          <button
            key={code}
            type="button"
            lang={messages[code].htmlLang}
            title={localeNames[code]}
            aria-pressed={locale === code}
            onClick={() => setLocale(code)}
            className={`min-w-9 cursor-pointer rounded-xs px-2 text-ui-label transition-colors duration-150 ${locale === code ? "bg-dark text-on-dark" : "text-ink hover:bg-bone"}`}
          >
            {localeShortNames[code]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`${buttonBase} ${iconButton} border-hairline bg-surface text-ink hover:bg-bone`}
        onClick={() => setTheme(effectiveTheme === "dark" ? "light" : "dark")}
        aria-label={effectiveTheme === "dark" ? t.switchToLight : t.switchToDark}
        title={effectiveTheme === "dark" ? t.switchToLight : t.switchToDark}
      >
        {effectiveTheme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </>
  );

  return (
    <main className="flex flex-col gap-4 tablet:gap-3">
      {/* ─── Auth Banner ─── */}
      {authUser ? (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b-2 border-divider px-4 py-2 text-nav-link text-ink">
          <span className="flex items-center gap-2">
            {authUser.avatarUrl ? <img src={authUser.avatarUrl} alt="" className="size-6.5 rounded-full border border-hairline" /> : null}
            <span>{authUser.name}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {preferenceControls}
            <button type="button" className={ghostButton} onClick={handleLogout}>
              {t.signOut}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b-2 border-divider px-4 py-2 text-nav-link text-ink">
          <span>{t.signInPrompt}</span>
          <div className="flex flex-wrap items-center gap-2">
            {preferenceControls}
            <button
            type="button"
            className={`${buttonBase} flex-none border-hairline bg-card px-4! text-ink shadow-level1 hover:bg-bone compact:px-4!`}
            onClick={() => {
              setAuthError(null);
              startGoogleSignIn();
            }}
          >
            <GoogleIcon />
            {t.signInWithGoogle}
          </button>
          </div>
        </div>
      )}

      {authError && (
        <div className={errorBanner} role="alert">
          {t.authErrors[authError]}
        </div>
      )}

      {authUser && (
        <div className="flex items-center gap-3 px-4 text-charcoal" role="status">
          {syncStatus === "saved" ? "" : t.syncStatus[syncStatus]}
          {syncError && (
            <button type="button" className={ghostButton} onClick={() => setSyncRetry((value) => value + 1)}>
              {t.retrySync}
            </button>
          )}
        </div>
      )}

      {nextCountdownAnime ? (
        <section className={`${panelBase} grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch gap-4 tablet:grid-cols-1`} aria-label={t.yourAnime}>
          {/* ─── Next episode: the dark command surface ─── */}
          {/* The poster covers the card as a hero band; a gradient keeps text legible. Its
              height sets the row, and the watchlist beside it scrolls to match. */}
          <div
            className="relative isolate flex min-h-[26rem] flex-col justify-end gap-3 overflow-hidden rounded-sm bg-dark p-6 text-on-dark shadow-level2 mobile:min-h-[22rem] mobile:gap-2 mobile:p-4"
            role="region"
            aria-labelledby="next-release-title"
          >
            <img className="absolute inset-0 -z-10 size-full object-cover object-[center_20%]" src={nextCountdownAnime.imageUrl} alt="" loading="lazy" decoding="async" />
            <div className="absolute inset-0 -z-10 bg-linear-to-t from-dark via-dark/75 to-dark/10" aria-hidden="true" />
            <span className="text-ui-label uppercase text-on-dark-mute">{t.nextEpisode}</span>
            <h2 className="m-0 text-display-lg text-on-dark [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] mobile:text-hero-tagline" id="next-release-title">
              {nextCountdownAnime.title}
            </h2>
            <p className="text-on-dark-mute">{formatNextEpisodeLabel(nextCountdownAt, t)}</p>
            <div className="grid grid-cols-4 gap-2 compact:gap-1" aria-label={t.countdownLabel} role="timer" aria-live="off">
              {renderCountdown()}
            </div>
          </div>

          {/* ─── Watchlist ─── */}
          {/* Desktop: absolutely filled so the list never stretches the row; it scrolls instead. */}
          <div className="relative min-w-0 tablet:static" role="region" aria-labelledby="watchlist-title">
            <div className="absolute inset-0 flex flex-col gap-3 tablet:static">
              <div className="flex min-h-9 items-center justify-between gap-2">
                <h2 className="m-0 flex items-center gap-2 text-hero-tagline text-ink" id="watchlist-title">
                  {t.yourWatchlist}
                  <span className={`${badgeBase} bg-deep`}>{watchlist.length}</span>
                </h2>
                <div className="flex items-center gap-2">
                  {showClearConfirm ? (
                    <>
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => {
                          clearWatchlist();
                          setShowClearConfirm(false);
                        }}
                        aria-label={t.confirmClearWatchlist}
                      >
                        {t.clearAll}
                      </button>
                      <button type="button" className={ghostButton} onClick={() => setShowClearConfirm(false)} aria-label={t.cancelClearWatchlist}>
                        {t.cancel}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={`${ghostButton} ${iconButton}`}
                      onClick={() => setShowClearConfirm(true)}
                      aria-label={t.clearWatchlist}
                      title={t.clearWatchlist}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-caption text-stone">{t.swipeHint}</p>
              {/* auto-rows-max: rows clip their swipe layer (overflow-hidden), which lets grid
                  rows shrink to zero; fixing them at full height makes the list overflow and scroll. */}
              <ul className="m-0 grid min-h-0 flex-1 auto-rows-max list-none content-start gap-2 overflow-y-auto overscroll-contain p-0.5 tablet:max-h-[22rem]">
                {sortedWatchlist.map((anime) => {
                  const nextEpisodeAt = resolveNextEpisodeAt(anime, now);
                  const isNext = anime.malId === nextCountdownAnime.malId;

                  return (
                    <SwipeToRemove
                      key={anime.malId}
                      onRemove={() => toggleWatchlist(anime)}
                      removeLabel={t.remove}
                      className={`grid grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-sm border-l-4 bg-card py-2 pr-1 pl-2 ${isNext ? "border-secondary" : "border-card"}`}
                    >
                      <img className="w-10 aspect-poster object-cover object-top" src={anime.imageUrl} alt="" loading="lazy" decoding="async" />
                      <div className="grid min-w-0 gap-1">
                        <h3 className="m-0 truncate text-nav-link text-ink">{anime.title}</h3>
                        <p className="truncate text-caption text-charcoal">{formatNextEpisodeLabel(nextEpisodeAt, t)}</p>
                      </div>
                      <span className="text-ui-label tabular-nums text-ink">{formatShortCountdown(nextEpisodeAt, now, t)}</span>
                      <button
                        type="button"
                        className={`${ghostButton} ${iconButton}`}
                        onClick={() => toggleWatchlist(anime)}
                        aria-label={t.removeFromWatchlist(anime.title)}
                        title={t.removeFromWatchlist(anime.title)}
                      >
                        <TrashIcon />
                      </button>
                    </SwipeToRemove>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <section className={panelBase} aria-labelledby="next-release-title">
          <div className={`${insetBase} gap-2 [&>p]:text-charcoal`}>
            <span className={eyebrow}>{t.emptyEyebrow}</span>
            <h2 className={sectionTitle} id="next-release-title">
              {t.emptyTitle}
            </h2>
            <p>{t.emptyBody}</p>
          </div>
        </section>
      )}

      {/* {installPrompt ? (
        <div className={statusBanner}>
          Install AniCount for quick access
          <button type="button" className={alertButton} onClick={() => void handleInstall()}>
            Install
          </button>
          <button type="button" className={`${alertButton} ${iconButton}`} onClick={() => setInstallPrompt(null)} aria-label="Dismiss install prompt">
            <ClearIcon />
          </button>
        </div>
      ) : null} */}
      {isOffline ? (
        <div className={statusBanner} role="status">
          {t.offline}
        </div>
      ) : null}

      {error ? (
        <div className={errorBanner} role="alert" aria-live="assertive">
          {isSearchMode ? t.loadSearchFailed : t.loadFailed}{" "}
          <button
            type="button"
            className={alertButton}
            onClick={() => {
              setError(null);
              if (failedRequest?.query) void searchAnimeCatalog(failedRequest.query, failedRequest.page, failedRequest.mode);
              else void loadUpcomingAnime(failedRequest?.page ?? 1, failedRequest?.mode ?? "replace");
            }}
          >
            {t.retry}
          </button>
        </div>
      ) : null}

      <section className={accentPanel} aria-labelledby="upcoming-title">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(260px,380px)] items-end gap-4 mobile:grid-cols-1 mobile:gap-3">
          <div className="grid min-w-0 content-start gap-1">
            <span className={eyebrow}>{isSearchMode ? t.searchResults : t.upcomingAnime}</span>
            <h2 className={sectionTitle} id="upcoming-title">
              {isSearchMode ? t.resultsFor(searchQuery) : t.browseTitle}
            </h2>
            <span className="text-ui-label uppercase text-charcoal">
              {isSearchMode ? t.resultCount(visibleAnime.length) : t.visibleCount(visibleAnime.length)}
            </span>
          </div>
          <div className="flex items-center gap-2" role="search">
            <label className="relative flex-1">
              <span className="sr-only">{t.searchLabel}</span>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">
                <SearchIcon />
              </span>
              <input
                className="h-9 w-full rounded-sm border border-hairline bg-surface pr-3 pl-9 text-body-md text-body placeholder:text-stone placeholder:opacity-100 focus-visible:border-deep compact:h-11"
                type="search"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </label>
            {isSearchMode ? (
              <button
                type="button"
                className={`${secondaryButton} ${iconButton}`}
                onClick={() => {
                  handleSearchChange("");
                }}
                aria-label={t.clearSearch}
                title={t.clearSearch}
              >
                <ClearIcon />
              </button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className={emptyState}>
            <p>{isSearchMode ? t.searchingTitle : t.loadingTitle}</p>
            <span>{isSearchMode ? t.searchingBody : t.loadingBody}</span>
          </div>
        ) : error && visibleAnime.length === 0 ? (
          <div className={emptyState}>
            <p>{t.loadErrorTitle}</p>
            <span>{t.loadErrorBody}</span>
          </div>
        ) : visibleAnime.length > 0 ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-stretch gap-3 tablet:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mobile:grid-cols-1">
              {visibleAnime.map((anime) => {
                const isSelected = watchlistIds.has(anime.malId);

                return (
                  <article
                    key={anime.malId}
                    className="flex h-full flex-col overflow-hidden rounded-sm bg-card shadow-level1 [content-visibility:auto] [contain-intrinsic-size:auto_420px] transition-shadow duration-150 ease-[ease] hover:shadow-level2 focus-within:shadow-level2"
                  >
                    <img className="w-full aspect-poster object-cover object-top" src={anime.imageUrl} alt={anime.title} loading="lazy" decoding="async" />
                    <div className="flex flex-1 flex-col gap-3 p-4 mobile:p-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`${badgeBase} bg-badge-info`}>{translateSeason(t, anime.seasonLabel)}</span>
                        <span className={`${badgeBase} bg-badge-success`}>{translateLabel(t.statuses, anime.status)}</span>
                      </div>
                      <h3 className="m-0 text-hero-tagline text-ink">{anime.title}</h3>
                      <p className="font-bold text-charcoal">{formatReleaseDate(anime.releaseAt, t)}</p>
                      <p className="line-clamp-4 min-h-[4.2rem] text-body mobile:line-clamp-3 mobile:min-h-0">{anime.synopsis === NO_SYNOPSIS ? t.noSynopsis : anime.synopsis}</p>
                      <div className="flex flex-wrap items-center gap-1 text-caption text-charcoal [&>span]:inline-flex [&>span]:h-[18px] [&>span]:items-center [&>span]:rounded-xs [&>span]:bg-bone [&>span]:px-1.5">
                        <span>{anime.studio === STUDIO_TBA ? t.studioTba : anime.studio}</span>
                        <span>{t.episodes(anime.episodes)}</span>
                        <span>{t.score(anime.score)}</span>
                      </div>
                      <div className="flex min-h-[18px] flex-wrap gap-1">
                        {anime.genres.slice(0, 3).map((genre) => (
                          <span key={genre} className={`${badgeBase} bg-deep`}>
                            {translateLabel(t.genres, genre)}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`${isSelected ? secondaryButton : primaryButton} mt-auto w-full`}
                        onClick={() => toggleWatchlist(anime)}
                        aria-label={isSelected ? t.removeFromWatchlist(anime.title) : t.addToWatchlistFor(anime.title)}
                        title={isSelected ? t.removeFromWatchlist(anime.title) : t.addToWatchlistFor(anime.title)}
                      >
                        {isSelected ? t.inWatchlist : t.addToWatchlist}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {activeHasNextPage ? (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  className={`${primaryButton} ${iconButton}`}
                  onClick={() => (isSearchMode ? void searchAnimeCatalog(searchQuery, activePage + 1, "append") : void loadUpcomingAnime(activePage + 1, "append"))}
                  disabled={isLoadingMore}
                  aria-label={isSearchMode ? t.loadMoreSearch : t.loadMoreUpcoming}
                  title={isSearchMode ? t.loadMoreSearch : t.loadMoreUpcoming}
                >
                  <ChevronDownIcon />
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className={emptyState}>
            <p>{isSearchMode ? t.noSearchMatch : t.noUpcoming}</p>
            <span>{t.emptyListHint}</span>
          </div>
        )}
      </section>

      <footer className="pt-4 pb-2 text-center text-caption text-charcoal">AniCount v{__APP_VERSION__}</footer>
    </main>
  );
}

export default App;
