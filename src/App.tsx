import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
const iconButton = "w-9 flex-none px-0 compact:w-11 compact:px-0";
const panelBase = "rounded-md bg-canvas p-6 mobile:p-4 compact:p-3";
const insetBase = "grid gap-1 rounded-sm bg-bone p-4 text-body compact:p-3";
const eyebrow = "text-ui-label uppercase text-stone";
const sectionTitle = "m-0 text-display-lg text-ink";
// Countdown cells sit on the dark command surface, like a console's LCD readout.
const countdownCell =
  "rounded-sm bg-deep px-2 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] [&>strong]:block [&>strong]:text-display-xl [&>strong]:tabular-nums [&>strong]:text-on-dark [&>span]:text-ui-label [&>span]:uppercase [&>span]:text-on-dark-mute mobile:px-1 mobile:py-2 mobile:[&>strong]:text-display-lg compact:[&>span]:text-caption";
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

function formatLocalDateTime(isoDate: string | null): string {
  if (!isoDate) {
    return "Date to be announced";
  }

  const parsedDate = new Date(isoDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date to be announced";
  }

  return new Intl.DateTimeFormat(getUserLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function formatNextEpisodeLabel(isoDate: string | null): string {
  if (!isoDate) {
    return "Next episode date not announced";
  }

  const parsedDate = new Date(isoDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Next episode date not announced";
  }

  const weekday = new Intl.DateTimeFormat(getUserLocale(), { weekday: "long" }).format(parsedDate);
  return `${weekday}, ${formatLocalDateTime(isoDate)}`;
}

function stripSynopsis(synopsis: string | null): string {
  if (!synopsis) {
    return "No synopsis available yet.";
  }

  // Parse API markup in an inert template, then render only its plain text.
  const template = document.createElement("template");
  template.innerHTML = synopsis;
  template.content.querySelectorAll("script, style, iframe, object").forEach((element) => element.remove());
  template.content.querySelectorAll("br, hr, p, div, li").forEach((element) => {
    element.before(document.createTextNode(" "));
    element.after(document.createTextNode(" "));
  });

  return template.content.textContent?.replace(/\s+/g, " ").trim() || "No synopsis available yet.";
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
    studio: anime.studios?.nodes?.[0]?.name || "Studio TBA",
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
function formatShortCountdown(releaseAt: string | null, now: number): string {
  const parts = formatCountdown(releaseAt, now);

  if (!parts) {
    return "TBA";
  }

  const days = Number(parts.days);
  const hours = Number(parts.hours);
  const minutes = Number(parts.minutes);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return Number(parts.seconds) > 0 ? "<1m" : "Live";
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
  const [syncStatus, setSyncStatus] = useState("Saved on this device");
  const [syncError, setSyncError] = useState(false);
  const [syncReadyUser, setSyncReadyUser] = useState<string | null>(null);
  const [syncRetry, setSyncRetry] = useState(0);
  const syncQueue = useRef(Promise.resolve());
  const requestVersion = useRef(0);
  const [authError, setAuthError] = useState<string | null>(() => {
    if (!redirectLogin || !("error" in redirectLogin)) return null;
    return redirectLogin.error === "access_denied" ? "Sign-in was cancelled. Your local watchlist is safe." : "Sign-in failed. Please try again. Your local watchlist is safe.";
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
    setSyncStatus("Saved on this device");
  }, []);

  // Read cloud data before uploading, including when restoring a signed-in session.
  useEffect(() => {
    if (!authUser || syncReadyUser === authUser.id) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSyncStatus("Loading saved watchlist…");
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
          setSyncStatus("Cloud sync failed. Your watchlist is saved on this device.");
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
      setSyncStatus("Saving…");
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
          if (!cancelled) setSyncStatus("Saved across your devices");
        } catch {
          if (!cancelled) {
            setSyncError(true);
            setSyncStatus("Cloud sync failed. Your watchlist is saved on this device.");
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
          <strong>Next Episode TBA</strong>
          <span>The release time hasn’t been announced yet.</span>
        </div>
      );
    }

    if (countdown.days === "00" && countdown.hours === "00" && countdown.minutes === "00" && countdown.seconds === "00") {
      return (
        <div className={countdownUnavailable}>
          <strong>Airing Now</strong>
          <span>The next episode is airing right now!</span>
        </div>
      );
    }

    return (
      <>
        <div className={countdownCell}>
          <strong>{countdown.days}</strong>
          <span>Days</span>
        </div>
        <div className={countdownCell}>
          <strong>{countdown.hours}</strong>
          <span>Hours</span>
        </div>
        <div className={countdownCell}>
          <strong>{countdown.minutes}</strong>
          <span>Mins</span>
        </div>
        <div className={countdownCell}>
          <strong>{countdown.seconds}</strong>
          <span>Secs</span>
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

  return (
    <main className="flex flex-col gap-4 tablet:gap-3">
      {/* ─── Auth Banner ─── */}
      {authUser ? (
        <div className="flex h-12 items-center justify-between gap-3 border-b-2 border-divider px-4 text-nav-link text-ink">
          <span className="flex items-center gap-2">
            {authUser.avatarUrl ? <img src={authUser.avatarUrl} alt="" className="size-6.5 rounded-full border border-hairline" /> : null}
            <span>{authUser.name}</span>
          </span>
          <button type="button" className={ghostButton} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b-2 border-divider px-4 py-2 text-nav-link text-ink">
          <span>Sign in to sync your watchlist across devices</span>
          <button
            type="button"
            className={`${buttonBase} flex-none border-hairline bg-card px-4 text-ink shadow-level1 hover:bg-bone compact:px-4`}
            onClick={() => {
              setAuthError(null);
              startGoogleSignIn();
            }}
          >
            <GoogleIcon />
            Sign in with Google
          </button>
        </div>
      )}

      {authError && (
        <div className={errorBanner} role="alert">
          {authError}
        </div>
      )}

      {authUser && (
        <div className="flex items-center gap-3 px-4 text-charcoal" role="status">
          {syncStatus == "Saved across your devices" ? "" : syncStatus}
          {syncError && (
            <button type="button" className={ghostButton} onClick={() => setSyncRetry((value) => value + 1)}>
              Retry sync
            </button>
          )}
        </div>
      )}

      {nextCountdownAnime ? (
        <section className={`${panelBase} grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch gap-4 tablet:grid-cols-1`} aria-label="Your anime">
          {/* ─── Next episode: the dark command surface ─── */}
          <div
            className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 rounded-sm bg-dark p-4 text-on-dark shadow-level2 mobile:grid-cols-[72px_minmax(0,1fr)] mobile:gap-3 mobile:p-3"
            role="region"
            aria-labelledby="next-release-title"
          >
            <img className="w-full self-start aspect-poster object-cover object-top" src={nextCountdownAnime.imageUrl} alt={nextCountdownAnime.title} loading="lazy" decoding="async" />
            {/* Stretches to the watchlist's height; the countdown pins to the bottom. */}
            <div className="flex min-w-0 flex-col gap-3 mobile:gap-2">
              <span className="text-ui-label uppercase text-on-dark-mute">Next episode</span>
              <h2 className="m-0 text-display-lg text-on-dark mobile:text-hero-tagline" id="next-release-title">
                {nextCountdownAnime.title}
              </h2>
              <p className="text-on-dark-mute">{formatNextEpisodeLabel(nextCountdownAt)}</p>
              <div className="mt-auto grid grid-cols-4 gap-2 mobile:hidden" aria-label="Next episode countdown" role="timer" aria-live="off">
                {renderCountdown()}
              </div>
            </div>
            {/* Phones: the countdown spans the card below the poster. */}
            <div className="col-span-full hidden grid-cols-4 gap-2 mobile:grid compact:gap-1" aria-hidden="true">
              {renderCountdown()}
            </div>
          </div>

          {/* ─── Watchlist ─── */}
          <div className="grid min-w-0 content-start gap-3" role="region" aria-labelledby="watchlist-title">
            <div className="flex min-h-9 items-center justify-between gap-2">
              <h2 className="m-0 flex items-center gap-2 text-hero-tagline text-ink" id="watchlist-title">
                Your watchlist
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
                      aria-label="Confirm clear watchlist"
                    >
                      Clear all
                    </button>
                    <button type="button" className={ghostButton} onClick={() => setShowClearConfirm(false)} aria-label="Cancel clear watchlist">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${ghostButton} ${iconButton}`}
                    onClick={() => setShowClearConfirm(true)}
                    aria-label="Clear watchlist"
                    title="Clear watchlist"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>

            <ul className="m-0 grid max-h-[22rem] list-none content-start gap-2 overflow-y-auto p-0.5 tablet:max-h-none">
              {sortedWatchlist.map((anime) => {
                const nextEpisodeAt = resolveNextEpisodeAt(anime, now);
                const isNext = anime.malId === nextCountdownAnime.malId;

                return (
                  <li
                    key={anime.malId}
                    className={`grid grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-sm border-l-4 bg-card py-2 pr-1 pl-2 shadow-level1 ${isNext ? "border-secondary" : "border-transparent"}`}
                  >
                    <img className="w-10 aspect-poster object-cover object-top" src={anime.imageUrl} alt="" loading="lazy" decoding="async" />
                    <div className="grid min-w-0 gap-1">
                      <h3 className="m-0 truncate text-nav-link text-ink">{anime.title}</h3>
                      <p className="truncate text-caption text-charcoal">{formatNextEpisodeLabel(nextEpisodeAt)}</p>
                    </div>
                    <span className="text-ui-label tabular-nums text-ink">{formatShortCountdown(nextEpisodeAt, now)}</span>
                    <button
                      type="button"
                      className={`${ghostButton} ${iconButton}`}
                      onClick={() => toggleWatchlist(anime)}
                      aria-label={`Remove ${anime.title} from watchlist`}
                      title={`Remove ${anime.title} from watchlist`}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : (
        <section className={panelBase} aria-labelledby="next-release-title">
          <div className={`${insetBase} gap-2 [&>p]:text-charcoal`}>
            <span className={eyebrow}>Your watchlist is empty</span>
            <h2 className={sectionTitle} id="next-release-title">
              Build your AniCount list
            </h2>
            <p>Search or browse below, then choose Add to Watchlist to start a live countdown for each anime.</p>
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
          You are offline. Saved watchlist data still works, but fresh anime updates need an internet connection.
        </div>
      ) : null}

      {error ? (
        <div className={errorBanner} role="alert" aria-live="assertive">
          {isSearchMode ? "We couldn’t load your search results." : "We couldn’t load anime right now."}{" "}
          <button
            type="button"
            className={alertButton}
            onClick={() => {
              setError(null);
              if (failedRequest?.query) void searchAnimeCatalog(failedRequest.query, failedRequest.page, failedRequest.mode);
              else void loadUpcomingAnime(failedRequest?.page ?? 1, failedRequest?.mode ?? "replace");
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className={accentPanel} aria-labelledby="upcoming-title">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(260px,380px)] items-end gap-4 mobile:grid-cols-1 mobile:gap-3">
          <div className="grid min-w-0 content-start gap-1">
            <span className={eyebrow}>{isSearchMode ? "Search results" : "Upcoming anime"}</span>
            <h2 className={sectionTitle} id="upcoming-title">
              {isSearchMode ? `Results for "${searchQuery}"` : "Browse and choose anime"}
            </h2>
            <span className="text-ui-label uppercase text-charcoal">
              {visibleAnime.length} {isSearchMode ? "results" : "visible"}
            </span>
          </div>
          <div className="flex items-center gap-2" role="search">
            <label className="relative flex-1">
              <span className="sr-only">Search all anime</span>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">
                <SearchIcon />
              </span>
              <input
                className="h-9 w-full rounded-sm border border-hairline bg-surface pr-3 pl-9 text-body-md text-body placeholder:text-stone placeholder:opacity-100 focus-visible:border-deep compact:h-11"
                type="search"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search all anime by title"
              />
            </label>
            {isSearchMode ? (
              <button
                type="button"
                className={`${secondaryButton} ${iconButton}`}
                onClick={() => {
                  handleSearchChange("");
                }}
                aria-label="Clear search results"
                title="Clear search results"
              >
                <ClearIcon />
              </button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className={emptyState}>
            <p>{isSearchMode ? "Searching all anime..." : "Loading upcoming anime..."}</p>
            <span>{isSearchMode ? "Looking through the full anime catalog." : "Pulling the latest release data."}</span>
          </div>
        ) : error && visibleAnime.length === 0 ? (
          <div className={emptyState}>
            <p>Anime couldn’t be loaded.</p>
            <span>Check your connection and use Retry above. Your saved watchlist is still available.</span>
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
                        <span className={`${badgeBase} bg-badge-info`}>{anime.seasonLabel}</span>
                        <span className={`${badgeBase} bg-badge-success`}>{anime.status}</span>
                      </div>
                      <h3 className="m-0 text-hero-tagline text-ink">{anime.title}</h3>
                      <p className="font-bold text-charcoal">{anime.releaseLabel}</p>
                      <p className="line-clamp-4 min-h-[4.2rem] text-body mobile:line-clamp-3 mobile:min-h-0">{anime.synopsis}</p>
                      <div className="flex flex-wrap items-center gap-1 text-caption text-charcoal [&>span]:inline-flex [&>span]:h-[18px] [&>span]:items-center [&>span]:rounded-xs [&>span]:bg-bone [&>span]:px-1.5">
                        <span>{anime.studio}</span>
                        <span>{anime.episodes ?? "?"} eps</span>
                        <span>Score {anime.score ?? "N/A"}</span>
                      </div>
                      <div className="flex min-h-[18px] flex-wrap gap-1">
                        {anime.genres.slice(0, 3).map((genre) => (
                          <span key={genre} className={`${badgeBase} bg-deep`}>
                            {genre}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`${isSelected ? secondaryButton : primaryButton} mt-auto w-full`}
                        onClick={() => toggleWatchlist(anime)}
                        aria-label={isSelected ? `Remove ${anime.title} from watchlist` : `Add ${anime.title} to watchlist`}
                        title={isSelected ? `Remove ${anime.title} from watchlist` : `Add ${anime.title} to watchlist`}
                      >
                        {isSelected ? "In Watchlist" : "Add to Watchlist"}
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
                  aria-label={isSearchMode ? "Load more search results" : "Load more upcoming anime"}
                  title={isSearchMode ? "Load more search results" : "Load more upcoming anime"}
                >
                  <ChevronDownIcon />
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className={emptyState}>
            <p>{isSearchMode ? "No anime matched your search." : "No upcoming anime available yet."}</p>
            <span>Try another title or clear the search to browse upcoming releases.</span>
          </div>
        )}
      </section>

      <footer className="pt-4 pb-2 text-center text-caption text-charcoal">AniCount v{__APP_VERSION__}</footer>
    </main>
  );
}

export default App;
