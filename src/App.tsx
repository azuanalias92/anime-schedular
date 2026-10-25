import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare const __APP_VERSION__: string;
import {
  getStoredUser,
  consumeRedirectLogin,
  getLoginNonce,
  GOOGLE_LOGIN_URI,
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
const sectionHeading = "flex items-start justify-between gap-3 [&>div]:grid [&>div]:content-start [&>div]:gap-1";
const countdownCell =
  "rounded-sm bg-card p-3 text-center shadow-level1 [&>strong]:block [&>strong]:text-display-xl [&>strong]:text-ink [&>span]:text-ui-label [&>span]:uppercase [&>span]:text-stone mobile:px-1 mobile:py-2 mobile:[&>strong]:text-display-lg compact:[&>span]:text-caption";
const badgeBase = "inline-flex h-[18px] items-center rounded-xs px-1.5 text-caption uppercase text-on-dark";
const primaryButton = `${buttonBase} border-transparent bg-primary text-on-primary shadow-level1 hover:bg-primary-hover active:bg-primary-active`;
const secondaryButton = `${buttonBase} border-transparent bg-secondary text-on-secondary shadow-level1 hover:bg-secondary-hover active:bg-secondary-active`;
const ghostButton = `${buttonBase} border-transparent bg-transparent text-ink hover:border-hairline active:bg-primary/6`;
// Ghost variant for dark alert surfaces, where ink text would lose contrast.
const alertButton = `${buttonBase} border-on-dark-mute bg-transparent text-on-dark hover:bg-on-dark/10`;
const accentPanel = `${panelBase} flex flex-col gap-4`;
const emptyState = `${insetBase} [&>p]:font-bold [&>p]:text-ink [&>span]:text-charcoal`;
const countdownUnavailable = `${insetBase} col-span-full bg-card shadow-level1 [&>strong]:text-hero-tagline [&>strong]:text-ink [&>span]:text-charcoal`;
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
  const [authError, setAuthError] = useState<string | null>(() =>
    redirectLogin && "error" in redirectLogin ? "Sign-in failed. Please try again. Your local watchlist is safe." : null,
  );
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
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Google's rendered button, unlike One Tap, which Google suppresses for hours
  // after a user dismisses it.
  useEffect(() => {
    const container = googleButtonRef.current;
    if (!googleReady || authUser || !container) return;
    window.google?.accounts.id.renderButton(container, { type: "standard", theme: "outline", size: "medium", text: "signin_with", shape: "rectangular" });
  }, [googleReady, authUser]);

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
        // Full-page redirect instead of a popup, which pop-up blockers, Safari,
        // and in-app browsers can stop. The result is read by consumeRedirectLogin.
        ux_mode: "redirect",
        login_uri: GOOGLE_LOGIN_URI,
        nonce: getLoginNonce(),
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
          {googleReady ? null : (
            <button type="button" className={primaryButton} disabled>
              {authError ? "Sign-in unavailable" : "Loading sign-in…"}
            </button>
          )}
          <div ref={googleButtonRef} className={googleReady ? "flex-none" : "hidden"} />
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

      <section className={accentPanel} aria-labelledby="next-release-title">
        <div>
          <span className={eyebrow}>Upcoming Anime</span>
        </div>
        {nextCountdownAnime ? (
          <>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 mobile:grid-cols-1 mobile:justify-items-center mobile:text-center">
              <img
                className="h-auto w-28 aspect-poster object-cover object-top mobile:w-full mobile:max-w-[220px]"
                src={nextCountdownAnime.imageUrl}
                alt={nextCountdownAnime.title}
                loading="lazy"
                decoding="async"
              />
              <div className="grid min-w-0 content-start gap-3 mobile:w-full">
                <h2 className={sectionTitle} id="next-release-title">
                  {nextCountdownAnime.title}
                </h2>
                <div className="grid grid-cols-4 gap-3 self-start mobile:gap-2 compact:gap-1" aria-label="Next episode countdown" role="timer" aria-live="off">
                  {countdown ? (
                    countdown.days === "00" && countdown.hours === "00" && countdown.minutes === "00" && countdown.seconds === "00" ? (
                      <div className={countdownUnavailable}>
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
          <div className={`${insetBase} gap-2 [&>p]:text-charcoal`}>
            <h2 className={sectionTitle} id="next-release-title">
              Build your AniCount list
            </h2>
            <p>Select one or more anime below to pin them into your watchlist.</p>
          </div>
        )}
      </section>

      <section className={accentPanel} aria-labelledby="watchlist-title">
        <div className={sectionHeading}>
          <div>
            <span className={eyebrow}>Your watchlist - {watchlist.length} anime</span>
          </div>
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
          <div className="grid gap-3">
            {sortedWatchlist.map((anime) => (
              <article
                key={anime.malId}
                className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 rounded-sm bg-card p-4 shadow-level1 mobile:grid-cols-[60px_minmax(0,1fr)_auto] mobile:gap-3 mobile:p-3"
              >
                <img
                  className="h-auto w-18 aspect-poster object-cover object-top mobile:w-[60px]"
                  src={anime.imageUrl}
                  alt={anime.title}
                  loading="lazy"
                  decoding="async"
                />
                <div className="grid min-w-0 content-center gap-1 [&>p]:min-w-0 [&>p]:text-charcoal">
                  <h3 className="m-0 text-hero-tagline text-ink">{anime.title}</h3>
                  <p>Next ep: {formatNextEpisodeLabel(resolveNextEpisodeAt(anime, now))}</p>
                </div>
                <button
                  type="button"
                  className={`${ghostButton} ${iconButton} self-center justify-self-center`}
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

      <section
        className={`${panelBase} grid grid-cols-[minmax(0,1fr)_auto] items-end justify-between gap-3`}
        aria-label="Anime controls"
      >
        <label className="grid flex-[1_1_320px] gap-2 mobile:w-full mobile:basis-auto">
          <span className={eyebrow}>Search all anime</span>
          <input
            className="h-9 w-full rounded-sm border border-hairline bg-surface px-3 text-body-md text-body placeholder:text-stone placeholder:opacity-100 focus-visible:border-deep compact:h-11"
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search by anime title"
          />
        </label>
        {isSearchMode ? (
          <div className="flex items-center gap-2">
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
          </div>
        ) : null}
      </section>

      <section className={accentPanel} aria-labelledby="upcoming-title">
        <div className={sectionHeading}>
          <div>
            <span className={eyebrow}>{isSearchMode ? "Search results" : "Upcoming anime"}</span>
            <h2 className={sectionTitle} id="upcoming-title">
              {isSearchMode ? `Results for "${searchQuery}"` : "Browse and choose anime"}
            </h2>
          </div>
          <span className="flex-none text-ui-label uppercase text-charcoal">
            {visibleAnime.length} {isSearchMode ? "results" : "visible"}
          </span>
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
