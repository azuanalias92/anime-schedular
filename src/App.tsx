import { useCallback, useEffect, useMemo, useState } from "react";

declare const __APP_VERSION__: string;
import "./App.css";
import {
  getStoredUser,
  loginWithGoogle,
  clearAuth,
  fetchRemoteWatchlist,
  pushWatchlist,
  type AuthUser,
} from "./auth";

const API_BASE = "https://graphql.anilist.co";
const PAGE_SIZE = 24;
const WATCHLIST_STORAGE_KEY = "anime-countdown-watchlist";

async function fetchWithRetry(query: string, variables: Record<string, unknown> = {}, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(API_BASE, {
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="button-icon-svg">
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="button-icon-svg">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="button-icon-svg">
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

  return formatLocalDateTime(isoDate);
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

function byRecentRelease(a: AnimeCardData, b: AnimeCardData): number {
  const aTime = a.releaseAt ? new Date(a.releaseAt).getTime() : 0;
  const bTime = b.releaseAt ? new Date(b.releaseAt).getTime() : 0;

  return bTime - aTime;
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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(getStoredUser);
  const [isSyncing, setIsSyncing] = useState(false);
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
    const prompt = (window as any).__pwaInstallPrompt;
    if (prompt) setInstallPrompt(prompt);
  }, []);

  // ─── Google Sign-In ────────────────────────────────────────────────────────
  const [googleReady, setGoogleReady] = useState(false);

  const handleGoogleLogin = useCallback(async () => {
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      alert("Google Sign-In is not available right now.");
      return;
    }

    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        return;
      }
    });
  }, []);

  // Initialize Google Identity Services — retry until script is loaded
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const tryInit = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        if (attempts < 50 && !cancelled) {
          attempts++;
          setTimeout(tryInit, 200);
        }
        return;
      }

      google.accounts.id.initialize({
        client_id: "1004921240672-ong7k2d2fv3t1n6nfoen7d5cit6vptfi.apps.googleusercontent.com",
        callback: async (response: { credential: string }) => {
          try {
            const { user } = await loginWithGoogle(response.credential);
            setAuthUser(user);

            setIsSyncing(true);
            const remoteItems = await fetchRemoteWatchlist();
            if (remoteItems.length > 0) {
              setWatchlist((current) => {
                const merged = [...current];
                for (const remoteItem of remoteItems) {
                  if (!merged.some((local) => local.malId === remoteItem.malId)) {
                    merged.push(remoteItem as any);
                  }
                }
                return dedupeAnimeCards(merged).sort(byNearestRelease);
              });
            }
            setIsSyncing(false);
          } catch (err) {
            console.error("Google login failed:", err);
            setIsSyncing(false);
          }
        },
        auto_select: false,
      });

      if (!cancelled) setGoogleReady(true);
    };

    tryInit();

    return () => {
      cancelled = true;
      const google = (window as any).google;
      if (google?.accounts?.id) google.accounts.id.cancel();
    };
  }, []);

  const handleLogout = useCallback(() => {
    clearAuth();
    setAuthUser(null);
  }, []);

  // ─── Sync watchlist to cloud on changes (debounced) ────────────────────────

  useEffect(() => {
    if (!authUser || watchlist.length === 0) return;

    const timer = window.setTimeout(() => {
      void pushWatchlist(watchlist);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [authUser, watchlist]);

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

  const loadUpcomingAnime = useCallback(
    async (nextPage: number, mode: "replace" | "append") => {
      if (mode === "replace") {
        setError(null);
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
        const normalized = dedupeAnimeCards(payload.data.Page.media.map(normalizeAnime).filter((anime) => anime.status !== "Finished Airing")).sort(
          byNearestRelease,
        );

        setUpcomingAnime((currentList) => (mode === "replace" ? normalized : mergeAnimeCards(currentList, normalized)));
        syncWatchlist(normalized);

        setUpcomingPage(nextPage);
        setUpcomingHasNextPage(payload.data.Page.pageInfo.hasNextPage);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Unable to load upcoming anime right now.";
        setError(message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [syncWatchlist],
  );

  const searchAnimeCatalog = useCallback(
    async (query: string, nextPage: number, mode: "replace" | "append") => {
      if (!query) {
        setSearchResults([]);
        setSearchPage(1);
        setSearchHasNextPage(false);
        return;
      }

      if (mode === "replace") {
        setError(null);
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
        const response = await fetchWithRetry(gql, { search: query, page: nextPage, perPage: PAGE_SIZE });

        if (!response.ok) {
          throw new Error(`Anime search request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as AnimeListApiResponse;
        const normalized = dedupeAnimeCards(payload.data.Page.media.map(normalizeAnime)).sort(byRecentRelease);

        setSearchResults((currentList) => (mode === "replace" ? normalized : mergeAnimeCards(currentList, normalized)));
        syncWatchlist(normalized);

        setSearchPage(nextPage);
        setSearchHasNextPage(payload.data.Page.pageInfo.hasNextPage);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Unable to search anime right now.";
        setError(message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
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

    const timeoutId = window.setTimeout(() => {
      void searchAnimeCatalog(searchQuery, 1, "replace");
    }, 300);

    return () => {
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
    setSearch(value);

    if (!value.trim()) {
      setError(null);
    }
  }

  return (
    <main className="app-shell">
      {/* ─── Auth Banner ─── */}
      {authUser ? (
        <div className="auth-banner">
          <span className="auth-user-info">
            {authUser.avatarUrl ? (
              <img src={authUser.avatarUrl} alt="" className="auth-avatar" />
            ) : null}
            <span className="auth-name">{authUser.name}</span>
          </span>
          <button type="button" className="ghost-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="auth-banner">
          <span>Sign in to sync your watchlist across devices</span>
          <button type="button" className="primary-button" onClick={handleGoogleLogin} disabled={isSyncing || !googleReady}>
            {!googleReady ? "Loading…" : isSyncing ? "Syncing…" : "Sign in with Google"}
          </button>
        </div>
      )}

      <section className="countdown-panel" aria-labelledby="next-release-title">
        <div>
          <span className="eyebrow">Upcoming Anime</span>
        </div>
        {nextCountdownAnime ? (
          <>
            <div className="countdown-header">
              <img className="countdown-art" src={nextCountdownAnime.imageUrl} alt={nextCountdownAnime.title} loading="lazy" decoding="async" />
              <div className="countdown-copy">
                <h2 id="next-release-title">{nextCountdownAnime.title}</h2>
                <div className="countdown-grid" aria-label="Next episode countdown" aria-live="polite">
                  {countdown ? (
                    countdown.days === "00" && countdown.hours === "00" && countdown.minutes === "00" && countdown.seconds === "00" ? (
                      <div className="countdown-unavailable" style={{ borderColor: "rgba(122, 229, 130, 0.5)" }}>
                        <strong>Airing Now</strong>
                        <span>The next episode is airing right now!</span>
                      </div>
                    ) : (
                      <>
                        <div className="countdown-cell">
                          <strong>{countdown.days}</strong>
                          <span>Days</span>
                        </div>
                        <div className="countdown-cell">
                          <strong>{countdown.hours}</strong>
                          <span>Hours</span>
                        </div>
                        <div className="countdown-cell">
                          <strong>{countdown.minutes}</strong>
                          <span>Minutes</span>
                        </div>
                        <div className="countdown-cell">
                          <strong>{countdown.seconds}</strong>
                          <span>Seconds</span>
                        </div>
                      </>
                    )
                  ) : (
                    <div className="countdown-unavailable">
                      <strong>Next Episode TBA</strong>
                      <span>A concrete next episode timestamp is not available for this title yet.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-panel">
            <h2 id="next-release-title">Build your AniCount list</h2>
            <p>Select one or more anime below to pin them into your watchlist.</p>
          </div>
        )}
      </section>

      <section className="watchlist-panel" aria-labelledby="watchlist-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Your watchlist</span>
            <h2 id="watchlist-title">Your saved anime</h2>
          </div>
          <div className="section-actions">
            <span className="muted">{watchlist.length} anime</span>
            {showClearConfirm ? (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    clearWatchlist();
                    setShowClearConfirm(false);
                  }}
                  aria-label="Confirm clear watchlist"
                >
                  Clear all
                </button>
                <button type="button" className="ghost-button" onClick={() => setShowClearConfirm(false)} aria-label="Cancel clear watchlist">
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ghost-button icon-only-button"
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
          <div className="watchlist-items">
            {sortedWatchlist.map((anime) => (
              <article key={anime.malId} className="watchlist-card">
                <img src={anime.imageUrl} alt={anime.title} loading="lazy" decoding="async" />
                <div className="watchlist-card-copy">
                  <h3>{anime.title}</h3>
                  <p>Next ep: {formatNextEpisodeLabel(resolveNextEpisodeAt(anime, now))}</p>
                </div>
                <button
                  type="button"
                  className="icon-button icon-only-button watchlist-action"
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
          <div className="empty-state">
            <p>No anime selected yet.</p>
            <span>Add titles from the upcoming list to start multiple countdowns.</span>
          </div>
        )}
      </section>

      {installPrompt ? (
        <div className="status-banner" style={{ borderColor: "rgba(122, 229, 130, 0.4)" }}>
          Install AniCount for quick access
          <button type="button" className="ghost-button" onClick={() => void handleInstall()} style={{ marginLeft: "0.75rem" }}>
            Install
          </button>
          <button
            type="button"
            className="icon-button icon-only-button"
            onClick={() => setInstallPrompt(null)}
            style={{ marginLeft: "0.4rem" }}
            aria-label="Dismiss install prompt"
          >
            <ClearIcon />
          </button>
        </div>
      ) : null}
      {isOffline ? (
        <div className="status-banner" role="status">
          You are offline. Saved watchlist data still works, but fresh anime updates need an internet connection.
        </div>
      ) : null}

      {error ? (
        <div className="status-banner error-banner" role="alert" aria-live="assertive">
          {error}{" "}
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setError(null);
              void loadUpcomingAnime(1, "replace");
            }}
            style={{ marginLeft: "0.75rem" }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="toolbar" aria-label="Anime controls">
        <label className="search-field">
          <span className="eyebrow">Search all anime</span>
          <input type="search" value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search by anime title" />
        </label>
        {isSearchMode ? (
          <div className="toolbar-actions">
            <button
              type="button"
              className="secondary-button icon-only-button"
              onClick={() => {
                setSearch("");
                setError(null);
              }}
              aria-label="Clear search results"
              title="Clear search results"
            >
              <ClearIcon />
            </button>
          </div>
        ) : null}
      </section>

      <section className="upcoming-panel" aria-labelledby="upcoming-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{isSearchMode ? "Search results" : "Upcoming anime"}</span>
            <h2 id="upcoming-title">{isSearchMode ? `Results for "${searchQuery}"` : "Browse and choose anime"}</h2>
          </div>
          <span className="muted">
            {visibleAnime.length} {isSearchMode ? "results" : "visible"}
          </span>
        </div>

        {isLoading ? (
          <div className="empty-state">
            <p>{isSearchMode ? "Searching all anime..." : "Loading upcoming anime..."}</p>
            <span>{isSearchMode ? "Looking through the full anime catalog." : "Pulling the latest release data."}</span>
          </div>
        ) : visibleAnime.length > 0 ? (
          <>
            <div className="anime-grid">
              {visibleAnime.map((anime) => {
                const isSelected = watchlistIds.has(anime.malId);

                return (
                  <article key={anime.malId} className="anime-card">
                    <img className="anime-card-art" src={anime.imageUrl} alt={anime.title} loading="lazy" decoding="async" />
                    <div className="anime-card-body">
                      <div className="card-topline">
                        <span className="card-badge">{anime.seasonLabel}</span>
                        <span className="card-badge muted-badge">{anime.status}</span>
                      </div>
                      <h3>{anime.title}</h3>
                      <p className="release-copy">{anime.releaseLabel}</p>
                      <p className="card-synopsis">{anime.synopsis}</p>
                      <div className="meta-row">
                        <span>{anime.studio}</span>
                        <span>{anime.episodes ?? "?"} eps</span>
                        <span>Score {anime.score ?? "N/A"}</span>
                      </div>
                      <div className="genre-row">
                        {anime.genres.slice(0, 3).map((genre) => (
                          <span key={genre} className="genre-pill">
                            {genre}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={isSelected ? "secondary-button full-width anime-card-action" : "primary-button full-width anime-card-action"}
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
              <div className="load-more-row">
                <button
                  type="button"
                  className="primary-button icon-only-button"
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
          <div className="empty-state">
            <p>No anime matched your search.</p>
            <span>Try another title or clear the search to browse upcoming releases.</span>
          </div>
        )}
      </section>

      <footer className="app-version">AniCount v{__APP_VERSION__}</footer>
    </main>
  );
}

export default App;
