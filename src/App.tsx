import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare const __APP_VERSION__: string;
import {
  getStoredUser,
  loginWithGoogle,
  clearAuth,
  fetchRemoteWatchlist,
  pushWatchlist,
  type AuthUser,
} from "./auth";

const buttonBase = "inline-flex items-center justify-center rounded-[999px] font-bold cursor-pointer transition-[transform,opacity,background] duration-180 ease-[ease] hover:[transform:translateY(-1px)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:[transform:translateY(0)_scale(0.97)] active:brightness-90";
const panelBase = "rounded-[28px] border shadow-panel backdrop-blur-[24px] compact:rounded-[20px]";
const emptyBase = "grid gap-[0.35rem] rounded-[22px] border border-surface bg-panel-strong p-4 compact:p-[0.85rem]";
const eyebrow = "text-[0.72rem] leading-[1.1] font-bold tracking-[0.12em] uppercase text-sky [text-shadow:0_0_18px_rgba(0,165,207,0.18)] compact:text-[0.66rem] compact:tracking-[0.1em]";
const sectionHeading = "flex items-center justify-between [&>div]:grid [&>div]:content-start [&>div]:gap-[0.2rem] mobile:flex-col mobile:items-start mobile:gap-[0.3rem]";
const countdownCell = "rounded-[22px] border border-sky/30 bg-countdown bg-panel-strong p-[0.8rem] text-center [&>strong]:block [&>strong]:text-foam [&>strong]:text-[clamp(1.8rem,4vw,3rem)] [&>strong]:leading-none [&>strong]:[text-shadow:0_0_18px_rgba(159,255,203,0.15)] [&>span]:text-secondary [&>span]:leading-[1.35] mobile:px-[0.3rem] mobile:py-2 mobile:[&>strong]:text-[clamp(1.2rem,5vw,1.8rem)] mobile:[&>span]:text-[0.62rem] compact:px-[0.15rem] compact:py-[0.4rem] compact:[&>strong]:text-[clamp(1rem,5vw,1.4rem)] compact:[&>span]:text-[0.55rem]";
const badgeBase = "inline-flex items-center rounded-[999px] border px-[0.58rem] py-[0.3rem] text-[0.72rem] leading-[1.2] tracking-[0.12em] uppercase mobile:px-2 mobile:py-[0.28rem] mobile:leading-[1.25] compact:text-[0.66rem] compact:tracking-[0.1em]";
const primaryButton = `${buttonBase} border-0 bg-primary-button text-foam shadow-primary-button`;
const secondaryButton = `${buttonBase} border border-button-secondary-border bg-button-secondary text-foam`;
const ghostButton = `${buttonBase} border border-[rgba(37,161,142,0.24)] bg-button-ghost text-ice hover:bg-sky/18 hover:text-foam hover:border-sky/30`;
const accentPanel = `${panelBase} flex flex-col gap-[0.8rem] border-[rgba(37,161,142,0.4)] bg-accent-panel p-[1.1rem] mobile:p-[0.9rem]`;
const emptyState = `${emptyBase} [&>p]:leading-[1.15] [&>span]:text-secondary [&>span]:leading-normal`;
const countdownUnavailable = `${emptyBase} col-span-full [&>strong]:leading-[1.15] [&>span]:text-secondary [&>span]:leading-[1.35]`;
const statusBanner = `${panelBase} border-surface bg-status px-4 py-[0.8rem] text-primary compact:px-[0.9rem] compact:py-3 compact:text-[0.92rem]`;
const errorBanner = `${panelBase} border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.4)] px-4 py-[0.8rem] text-primary compact:px-[0.9rem] compact:py-3 compact:text-[0.92rem]`;

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

  return synopsis.replace(/\s+/g, " ").trim();
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
    case "NOT_YET_RELEASED": return "Not Yet Aired";
    case "RELEASING": return "Currently Airing";
    case "FINISHED": return "Finished Airing";
    case "CANCELLED": return "Cancelled";
    case "HIATUS": return "On Hiatus";
    default: return status;
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
          synopsis: typeof item.synopsis === "string" ? item.synopsis : "No synopsis available yet.",
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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() => window.__pwaInstallPrompt ?? null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(getStoredUser);
  const [syncStatus, setSyncStatus] = useState("Saved on this device");
  const [syncError, setSyncError] = useState(false);
  const [syncReadyUser, setSyncReadyUser] = useState<string | null>(null);
  const [syncRetry, setSyncRetry] = useState(0);
  const syncQueue = useRef(Promise.resolve());
  const requestVersion = useRef(0);
  const [authError, setAuthError] = useState<string | null>(null);
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
    const capturePrompt = (event: Event) => setInstallPrompt(event as BeforeInstallPromptEvent);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    return () => window.removeEventListener("beforeinstallprompt", capturePrompt);
  }, []);

  // ─── Google Sign-In ────────────────────────────────────────────────────────
  const [googleReady, setGoogleReady] = useState(false);

  const handleGoogleLogin = useCallback(() => {
    setAuthError(null);
    const google = window.google;
    if (!google?.accounts?.id) {
      setAuthError("Sign-in is unavailable. You can keep using your watchlist on this device. Reload to try again.");
      return;
    }
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setAuthError("Sign-in did not open. Check your browser's sign-in settings and try again. Your local watchlist is safe.");
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number;
    const tryInit = () => {
      if (cancelled) return;
      const google = window.google;
      if (!google?.accounts?.id) {
        if (attempts++ < 50) timer = window.setTimeout(tryInit, 200);
        else setAuthError("Sign-in could not load. Your watchlist still works on this device. Reload to try again.");
        return;
      }
      google.accounts.id.initialize({
        client_id: "1004921240672-ong7k2d2fv3t1n6nfoen7d5cit6vptfi.apps.googleusercontent.com",
        callback: async (response: { credential: string }) => {
          try {
            const { user } = await loginWithGoogle(response.credential);
            if (cancelled) return;
            setSyncReadyUser(null);
            setAuthError(null);
            setAuthUser(user);
          } catch {
            if (!cancelled) setAuthError("Sign-in failed. Please try again. Your local watchlist is safe.");
          }
        },
        auto_select: false,
      });
      setGoogleReady(true);
    };
    timer = window.setTimeout(tryInit, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.google?.accounts.id.cancel();
    };
  }, []);

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
        setWatchlist(current => dedupeAnimeCards([...current, ...remote.filter(item =>
          typeof item.malId === "number" && typeof item.title === "string" && typeof item.status === "string"
        ) as AnimeCardData[]]).sort(byNearestRelease));
        setSyncReadyUser(authUser.id);
      } catch {
        if (!cancelled) {
          setSyncError(true);
          setSyncStatus("Cloud sync failed. Your watchlist is saved on this device.");
        }
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [authUser, syncReadyUser, syncRetry]);

  useEffect(() => {
    if (!authUser || syncReadyUser !== authUser.id) return;
    let cancelled = false;
    const statusTimer = window.setTimeout(() => { setSyncStatus("Saving…"); setSyncError(false); }, 0);
    const timer = window.setTimeout(() => {
      // Serialize writes so an older request cannot overwrite a newer watchlist.
      syncQueue.current = syncQueue.current.then(async () => {
        if (cancelled) return;
        try {
          if (!await pushWatchlist(watchlist)) throw new Error("Sync failed");
          if (!cancelled) setSyncStatus("Saved across your devices");
        } catch {
          if (!cancelled) {
            setSyncError(true);
            setSyncStatus("Cloud sync failed. Your watchlist is saved on this device.");
          }
        }
      });
    }, 700);
    return () => { cancelled = true; window.clearTimeout(timer); window.clearTimeout(statusTimer); };
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
        const normalized = dedupeAnimeCards(payload.data.Page.media.map(normalizeAnime).filter((anime) => anime.status !== "Finished Airing")).sort(
          byNearestRelease,
        );

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
    setWatchlist((currentWatchlist) => {
      const exists = currentWatchlist.some((item) => item.malId === anime.malId);

      if (exists) {
        return currentWatchlist.filter((item) => item.malId !== anime.malId);
      }

      return [...currentWatchlist, anime].sort(byNearestRelease);
    });
  }

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  function clearWatchlist() {
    setWatchlist([]);
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
    <main className="flex flex-col gap-4 tablet:gap-[0.85rem]">
      {/* ─── Auth Banner ─── */}
      {authUser ? (
        <div className="flex items-center justify-between gap-3 rounded-[24px] border border-surface bg-auth px-4 py-[0.65rem] text-[0.85rem] text-muted">
          <span className="flex items-center gap-2 text-primary">
            {authUser.avatarUrl ? (
              <img src={authUser.avatarUrl} alt="" className="size-[26px] rounded-full border-[1.5px] border-[rgba(37,161,142,0.5)]" />
            ) : null}
            <span className="text-[0.85rem] font-semibold">{authUser.name}</span>
          </span>
          <button type="button" className={`${ghostButton} px-[1.1rem] py-[0.85rem]`} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-[24px] border border-surface bg-auth px-4 py-[0.65rem] text-[0.85rem] text-muted">
          <span>Sign in to sync your watchlist across devices</span>
          <button type="button" className={`${primaryButton} px-[1.1rem] py-[0.85rem]`} onClick={handleGoogleLogin} disabled={!googleReady}>
            {!googleReady ? (authError ? "Sign-in unavailable" : "Loading sign-in…") : "Sign in with Google"}
          </button>
        </div>
      )}

      {authError && <div className={errorBanner} role="alert">{authError}</div>}
      {authUser && <div className="text-muted" role="status">{syncStatus} {syncError && <button type="button" className={`${ghostButton} px-[1.1rem] py-[0.85rem]`} onClick={() => setSyncRetry(value => value + 1)}>Retry sync</button>}</div>}
      <section className={accentPanel} aria-labelledby="next-release-title">
        <div>
          <span className={eyebrow}>Upcoming Anime</span>
        </div>
        {nextCountdownAnime ? (
          <>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-[0.8rem] mobile:grid-cols-1 mobile:justify-items-center mobile:text-center">
              <img className="h-auto w-28 aspect-poster rounded-[20px] object-cover object-top mobile:w-full mobile:max-w-[220px]" src={nextCountdownAnime.imageUrl} alt={nextCountdownAnime.title} loading="lazy" decoding="async" />
              <div className="grid min-w-0 content-start gap-[0.35rem] mobile:w-full">
                <h2 className="text-2xl m-0 font-bold leading-[1.15] text-primary mobile:text-[1.15rem] mobile:leading-[1.2]" id="next-release-title">{nextCountdownAnime.title}</h2>
                <div className="grid grid-cols-4 gap-[0.65rem] self-start mobile:gap-[0.4rem] compact:gap-1" aria-label="Next episode countdown" role="timer" aria-live="off">
                  {countdown ? (
                    countdown.days === "00" && countdown.hours === "00" && countdown.minutes === "00" && countdown.seconds === "00" ? (
                      <div className={`${countdownUnavailable} border-sky/50!`}>
                        <strong>Airing Now</strong>
                        <span>The next episode is airing right now!</span>
                      </div>
                    ) : (
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
                          <span>Minutes</span>
                        </div>
                        <div className={countdownCell}>
                          <strong>{countdown.seconds}</strong>
                          <span>Seconds</span>
                        </div>
                      </>
                    )
                  ) : (
                    <div className={countdownUnavailable}>
                      <strong>Next Episode TBA</strong>
                      <span>The release time hasn’t been announced yet.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={`${emptyBase} [&>p]:text-secondary [&>p]:leading-normal`}>
            <h2 className="m-0 text-2xl font-bold leading-[1.15] text-primary mobile:text-[1.15rem] mobile:leading-[1.2]" id="next-release-title">Build your AniCount list</h2>
            <p>Select one or more anime below to pin them into your watchlist.</p>
          </div>
        )}
      </section>

      <section className={accentPanel} aria-labelledby="watchlist-title">
        <div className={sectionHeading}>
          <div>
            <span className={eyebrow}>Your watchlist</span>
            <h2 className="text-2xl m-0 font-bold leading-[1.15] text-primary mobile:text-[1.15rem] mobile:leading-[1.2]" id="watchlist-title">Your saved anime</h2>
          </div>
          <div className="items-center mobile:self-start">
            <span className="text-muted">{watchlist.length} anime</span>
            {showClearConfirm ? (
              <>
                <button
                  type="button"
                  className={`${secondaryButton} px-[1.1rem] py-[0.85rem]`}
                  onClick={() => {
                    clearWatchlist();
                    setShowClearConfirm(false);
                  }}
                  aria-label="Confirm clear watchlist"
                >
                  Clear all
                </button>
                <button type="button" className={`${ghostButton} px-[1.1rem] py-[0.85rem]`} onClick={() => setShowClearConfirm(false)} aria-label="Cancel clear watchlist">
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`${ghostButton} size-11 flex-none p-0`}
                onClick={() => setShowClearConfirm(true)}
                disabled={watchlist.length === 0}
                aria-label="Clear watchlist"
                title="Clear watchlist"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </div>

        {sortedWatchlist.length > 0 ? (
          <div className="grid gap-[0.7rem]">
            {sortedWatchlist.map((anime) => (
              <article key={anime.malId} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-[0.85rem] rounded-[22px] border border-[rgba(37,161,142,0.34)] bg-watchlist-card bg-panel-strong p-3 mobile:grid-cols-[60px_minmax(0,1fr)_auto] mobile:gap-[0.65rem] mobile:p-[0.7rem]">
                <img className="h-auto w-[72px] aspect-poster rounded-[20px] object-cover object-top mobile:w-[60px] mobile:rounded-[16px]" src={anime.imageUrl} alt={anime.title} loading="lazy" decoding="async" />
                <div className="grid min-w-0 content-center gap-[0.35rem] [&>p]:min-w-0 [&>p]:text-[0.9rem] [&>p]:leading-[1.35] [&>p]:text-secondary mobile:[&>p]:text-[0.88rem]">
                  <h3 className="text-[1.17em] m-0 font-bold leading-[1.15] text-primary mobile:text-[1.15rem] mobile:leading-[1.2]">{anime.title}</h3>
                  <p>Next ep: {formatNextEpisodeLabel(resolveNextEpisodeAt(anime, now))}</p>
                </div>
                <button
                  type="button"
                  className={`${ghostButton} size-11 flex-none p-0 self-center justify-self-center mobile:size-10`}
                  onClick={() => toggleWatchlist(anime)}
                  aria-label={`Remove ${anime.title} from watchlist`}
                  title={`Remove ${anime.title} from watchlist`}
                >
                  <TrashIcon />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className={emptyState}>
            <p>No anime selected yet.</p>
            <span>Add titles from the upcoming list to start multiple countdowns.</span>
          </div>
        )}
      </section>

      {installPrompt ? (
        <div className={`${statusBanner} border-sky/40!`}>
          Install AniCount for quick access
          <button type="button" className={`${ghostButton} ml-3 px-[1.1rem] py-[0.85rem]`} onClick={() => void handleInstall()}>
            Install
          </button>
          <button
            type="button"
            className={`${ghostButton} ml-[0.4rem] size-11 flex-none p-0`}
            onClick={() => setInstallPrompt(null)}
            aria-label="Dismiss install prompt"
          >
            <ClearIcon />
          </button>
        </div>
      ) : null}
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
            className={`${ghostButton} ml-3 px-[1.1rem] py-[0.85rem]`}
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

      <section className={`${panelBase} grid grid-cols-[minmax(0,1fr)_auto] items-center justify-between gap-3 border-surface bg-toolbar p-[1.1rem] mobile:gap-[0.7rem] mobile:p-[0.9rem]`} aria-label="Anime controls">
        <label className="grid flex-[1_1_320px] gap-[0.35rem] font-semibold text-primary [&>span]:leading-[1.35] mobile:w-full mobile:basis-auto">
          <span className={eyebrow}>Search all anime</span>
          <input className="w-full rounded-[16px] border border-surface bg-search bg-panel-strong px-[0.9rem] py-[0.78rem] text-primary placeholder:text-muted placeholder:opacity-100 mobile:px-[0.85rem] mobile:py-3" type="search" value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search by anime title" />
        </label>
        {isSearchMode ? (
          <div className="flex items-center self-center gap-[0.55rem] tablet:w-full tablet:self-auto">
            <button
              type="button"
              className={`${secondaryButton} size-11 flex-none p-0`}
              onClick={() => {
                handleSearchChange("");
              }}
              aria-label="Clear search results"
              title="Clear search results"
            >
              <ClearIcon />
            </button>
          </div>
        ) : null}
      </section>

      <section className={`${panelBase} flex flex-col gap-[0.8rem] border-sky/34 bg-upcoming-panel p-[1.1rem] mobile:p-[0.9rem]`} aria-labelledby="upcoming-title">
        <div className={sectionHeading}>
          <div>
            <span className={eyebrow}>{isSearchMode ? "Search results" : "Upcoming anime"}</span>
            <h2 className="text-2xl m-0 font-bold leading-[1.15] text-primary mobile:text-[1.15rem] mobile:leading-[1.2]" id="upcoming-title">{isSearchMode ? `Results for "${searchQuery}"` : "Browse and choose anime"}</h2>
          </div>
          <span className="text-muted">
            {visibleAnime.length} {isSearchMode ? "results" : "visible"}
          </span>
        </div>

        {isLoading ? (
          <div className={emptyState}>
            <p>{isSearchMode ? "Searching all anime..." : "Loading upcoming anime..."}</p>
            <span>{isSearchMode ? "Looking through the full anime catalog." : "Pulling the latest release data."}</span>
          </div>
        ) : error && visibleAnime.length === 0 ? (
          <div className={emptyState}><p>Anime couldn’t be loaded.</p><span>Check your connection and use Retry above. Your saved watchlist is still available.</span></div>
        ) : visibleAnime.length > 0 ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-stretch gap-[0.8rem] tablet:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mobile:grid-cols-1 mobile:gap-[0.7rem]">
              {visibleAnime.map((anime) => {
                const isSelected = watchlistIds.has(anime.malId);

                return (
                  <article key={anime.malId} className="flex h-full flex-col overflow-hidden rounded-[24px] border border-[rgba(0,165,207,0.26)] bg-anime-card bg-panel [content-visibility:auto] [contain-intrinsic-size:auto_420px] transition-[transform,border-color,box-shadow] duration-200 ease-[ease] hover:border-[rgba(0,165,207,0.5)] hover:[transform:translateY(-2px)] hover:shadow-card-focus focus-within:border-[rgba(0,165,207,0.5)] focus-within:[transform:translateY(-2px)] focus-within:shadow-card-focus mobile:rounded-[20px]">
                    <img className="w-full aspect-poster rounded-[20px] object-cover object-top" src={anime.imageUrl} alt={anime.title} loading="lazy" decoding="async" />
                    <div className="flex flex-1 flex-col gap-3 p-[0.85rem] mobile:gap-[0.65rem] mobile:p-3">
                      <div className="flex flex-wrap items-center gap-[0.45rem]">
                        <span className={`${badgeBase} border-[rgba(0,165,207,0.34)] bg-[rgba(0,165,207,0.18)] text-foam`}>{anime.seasonLabel}</span>
                        <span className={`${badgeBase} border-[rgba(0,165,207,0.34)] bg-[rgba(0,165,207,0.18)] text-secondary`}>{anime.status}</span>
                      </div>
                      <h3 className="text-[1.17em] m-0 font-bold leading-[1.15] text-primary mobile:text-[1.15rem] mobile:leading-[1.2]">{anime.title}</h3>
                      <p className="leading-[1.35] text-muted">{anime.releaseLabel}</p>
                      <p className="line-clamp-4 min-h-[5.4rem] leading-normal text-secondary mobile:line-clamp-3 mobile:min-h-0 mobile:text-[0.95rem]">{anime.synopsis}</p>
                      <div className="flex flex-wrap items-center gap-[0.45rem] text-[0.85rem] leading-[1.35] text-secondary [&>span]:inline-flex [&>span]:items-center [&>span]:rounded-[999px] [&>span]:border [&>span]:border-chip-border [&>span]:bg-chip [&>span]:px-[0.58rem] [&>span]:py-[0.3rem] [&>span]:leading-[1.2] mobile:gap-[0.38rem] mobile:text-[0.8rem] mobile:[&>span]:px-2 mobile:[&>span]:py-[0.28rem] mobile:[&>span]:leading-[1.25]">
                        <span>{anime.studio}</span>
                        <span>{anime.episodes ?? "?"} eps</span>
                        <span>Score {anime.score ?? "N/A"}</span>
                      </div>
                      <div className="flex min-h-8 flex-wrap gap-[0.45rem]">
                        {anime.genres.slice(0, 3).map((genre) => (
                          <span key={genre} className={`${badgeBase} border-[rgba(37,161,142,0.34)] bg-[rgba(37,161,142,0.2)] text-ice`}>
                            {genre}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`${isSelected ? secondaryButton : primaryButton} mt-auto w-full px-[1.1rem] py-[0.85rem]`}
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
              <div className="flex flex-wrap items-center justify-center gap-[0.45rem] pt-1">
                <button
                  type="button"
                  className={`${primaryButton} size-11 flex-none p-0`}
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

      <footer className="pt-4 pb-2 text-center text-xs leading-normal text-muted opacity-60">AniCount v{__APP_VERSION__}</footer>
    </main>
  );
}

export default App;
