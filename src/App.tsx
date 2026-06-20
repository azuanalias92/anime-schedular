import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "https://api.jikan.moe/v4";
const PAGE_SIZE = 24;
const WATCHLIST_STORAGE_KEY = "anime-countdown-watchlist";

type AnimeApiItem = {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese?: string | null;
  images: {
    jpg?: {
      image_url?: string | null;
      large_image_url?: string | null;
    };
    webp?: {
      image_url?: string | null;
      large_image_url?: string | null;
    };
  };
  aired?: {
    from: string | null;
    string?: string | null;
  };
  broadcast?: {
    day: string | null;
    time: string | null;
    timezone: string | null;
    string?: string | null;
  };
  season: string | null;
  year: number | null;
  status: string;
  synopsis: string | null;
  score: number | null;
  episodes: number | null;
  members: number | null;
  genres?: Array<{ mal_id: number; name: string }>;
  studios?: Array<{ mal_id: number; name: string }>;
};

type AnimeListApiResponse = {
  pagination: {
    has_next_page: boolean;
  };
  data: AnimeApiItem[];
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
};

type CountdownParts = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

type EpisodeScheduleSource = Pick<AnimeCardData, "airing" | "releaseAt" | "broadcastDay" | "broadcastTime" | "broadcastTimezone" | "status">;

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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

function fallbackReleaseLabel(releaseAt: string | null): string {
  if (!releaseAt) {
    return "Date to be announced";
  }

  return formatLocalDateTime(releaseAt);
}

function stripSynopsis(synopsis: string | null): string {
  if (!synopsis) {
    return "No synopsis available yet.";
  }

  return synopsis.replace(/\s+/g, " ").trim();
}

function normalizeTitleMatchText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isExactAnimeTitleMatch(query: string, anime: AnimeApiItem): boolean {
  const normalizedQuery = normalizeTitleMatchText(query);

  if (!normalizedQuery) {
    return false;
  }

  return [anime.title, anime.title_english, anime.title_japanese].some((title) => normalizeTitleMatchText(title) === normalizedQuery);
}

function getWeekdayIndex(day: string | null): number | null {
  if (!day) {
    return null;
  }

  const normalizedDay = day.toLowerCase().replace(/s$/, "").trim();
  return WEEKDAY_INDEX[normalizedDay] ?? null;
}

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: getWeekdayIndex(values.weekday) ?? 0,
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const zoned = getZonedDateParts(date, timeZone);
  const zonedAsUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);

  return zonedAsUtc - date.getTime();
}

function addDaysToCalendarDate(year: number, month: number, day: number, daysToAdd: number) {
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + daysToAdd);

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

function zonedLocalDateTimeToIso(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): string {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let resolved = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(resolved), timeZone);

  if (secondOffset !== firstOffset) {
    resolved = utcGuess - secondOffset;
  }

  return new Date(resolved).toISOString();
}

function resolveNextEpisodeAt(source: EpisodeScheduleSource, nowMs: number): string | null {
  const status = source.status.toLowerCase();
  const releaseAtMs = source.releaseAt ? new Date(source.releaseAt).getTime() : null;
  const isNotYetAired = status.includes("not yet aired");
  const isFinished = status.includes("finished");
  const isCurrentlyAiring = source.airing || status.includes("currently airing");

  if (isFinished) {
    return null;
  }

  if (isNotYetAired) {
    return source.releaseAt;
  }

  const weekdayIndex = getWeekdayIndex(source.broadcastDay);
  const [hourText, minuteText = "0"] = (source.broadcastTime || "").split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!isCurrentlyAiring || weekdayIndex === null || !source.broadcastTimezone || Number.isNaN(hour) || Number.isNaN(minute)) {
    return releaseAtMs && releaseAtMs > nowMs ? source.releaseAt : null;
  }

  const nowInBroadcastZone = getZonedDateParts(new Date(nowMs), source.broadcastTimezone);
  let daysUntilNextEpisode = (weekdayIndex - nowInBroadcastZone.weekday + 7) % 7;
  let candidateDate = addDaysToCalendarDate(nowInBroadcastZone.year, nowInBroadcastZone.month, nowInBroadcastZone.day, daysUntilNextEpisode);
  let candidateIso = zonedLocalDateTimeToIso(candidateDate.year, candidateDate.month, candidateDate.day, hour, minute, source.broadcastTimezone);
  let candidateMs = new Date(candidateIso).getTime();

  if (candidateMs <= nowMs) {
    daysUntilNextEpisode += 7;
    candidateDate = addDaysToCalendarDate(nowInBroadcastZone.year, nowInBroadcastZone.month, nowInBroadcastZone.day, daysUntilNextEpisode);
    candidateIso = zonedLocalDateTimeToIso(candidateDate.year, candidateDate.month, candidateDate.day, hour, minute, source.broadcastTimezone);
    candidateMs = new Date(candidateIso).getTime();
  }

  if (releaseAtMs && releaseAtMs > nowMs && candidateMs < releaseAtMs) {
    return source.releaseAt;
  }

  return candidateIso;
}

function toSeasonLabel(season: string | null, year: number | null): string {
  if (!season && !year) {
    return "Upcoming anime";
  }

  const seasonText = season ? `${season.slice(0, 1).toUpperCase()}${season.slice(1)}` : "Upcoming";
  return year ? `${seasonText} ${year}` : seasonText;
}

function toBroadcastLabel(anime: AnimeApiItem): string {
  const broadcast = anime.broadcast?.string?.trim();

  if (broadcast) {
    return broadcast;
  }

  const day = anime.broadcast?.day;
  const time = anime.broadcast?.time;
  const timezone = anime.broadcast?.timezone;

  if (!day && !time && !timezone) {
    return "Broadcast time not announced";
  }

  return [day, time, timezone].filter(Boolean).join(" • ");
}

function normalizeAnime(anime: AnimeApiItem): AnimeCardData {
  return {
    malId: anime.mal_id,
    title: anime.title_english || anime.title,
    imageUrl: anime.images.webp?.large_image_url || anime.images.jpg?.large_image_url || anime.images.webp?.image_url || anime.images.jpg?.image_url || "/favicon.svg",
    airing: anime.status === "Currently Airing",
    releaseAt: anime.aired?.from ?? null,
    releaseLabel: anime.aired?.string?.trim() || fallbackReleaseLabel(anime.aired?.from ?? null),
    broadcastLabel: toBroadcastLabel(anime),
    broadcastDay: anime.broadcast?.day ?? null,
    broadcastTime: anime.broadcast?.time ?? null,
    broadcastTimezone: anime.broadcast?.timezone ?? null,
    seasonLabel: toSeasonLabel(anime.season, anime.year),
    synopsis: stripSynopsis(anime.synopsis),
    status: anime.status,
    score: anime.score,
    episodes: anime.episodes,
    members: anime.members,
    studio: anime.studios?.[0]?.name || "Studio TBA",
    genres: anime.genres?.map((genre) => genre.name) ?? [],
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
        const imageUrl = typeof item.imageUrl === "string" && item.imageUrl.startsWith("https://")
          ? item.imageUrl
          : "/favicon.svg";

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
        };
      })
      .sort(byNearestRelease);
  } catch {
    return [];
  }
}

function mergeAnimeCards(currentList: AnimeCardData[], incomingList: AnimeCardData[]): AnimeCardData[] {
  const deduped = new Map<number, AnimeCardData>();

  [...currentList, ...incomingList].forEach((item) => {
    deduped.set(item.malId, item);
  });

  return [...deduped.values()].sort(byNearestRelease);
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

  const loadUpcomingAnime = useCallback(
    async (nextPage: number, mode: "replace" | "append") => {
      if (mode === "replace") {
        setError(null);
        setIsLoading(nextPage === 1);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await fetch(`${API_BASE}/seasons/upcoming?page=${nextPage}&limit=${PAGE_SIZE}`);

        if (!response.ok) {
          throw new Error(`Anime data request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as AnimeListApiResponse;
        const normalized = payload.data
          .map(normalizeAnime)
          .filter((anime) => anime.status !== "Finished Airing")
          .sort(byNearestRelease);

        setUpcomingAnime((currentList) => (mode === "replace" ? normalized : mergeAnimeCards(currentList, normalized)));
        syncWatchlist(normalized);

        setUpcomingPage(nextPage);
        setUpcomingHasNextPage(payload.pagination.has_next_page);
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
    async (query: string, nextPage: number, mode: "replace" | "append", signal?: AbortSignal) => {
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
        const requestUrl = `${API_BASE}/anime?q=${encodeURIComponent(query)}&page=${nextPage}&limit=${PAGE_SIZE}`;
        const response = await fetch(requestUrl, { signal });

        if (!response.ok) {
          throw new Error(`Anime search request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as AnimeListApiResponse;
        const normalized = payload.data
          .filter((anime) => anime.status !== "Finished Airing")
          .filter((anime) => isExactAnimeTitleMatch(query, anime))
          .map(normalizeAnime)
          .sort(byNearestRelease);

        setSearchResults((currentList) => (mode === "replace" ? normalized : mergeAnimeCards(currentList, normalized)));
        syncWatchlist(normalized);

        setSearchPage(nextPage);
        setSearchHasNextPage(payload.pagination.has_next_page);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

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

  const sortedWatchlist = useMemo(() => [...watchlist].sort(byNearestRelease), [watchlist]);

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
      <section className="countdown-panel" aria-labelledby="next-release-title">
        <div>
          <span className="eyebrow">Upcoming Anime</span>
        </div>
        {nextCountdownAnime ? (
          <>
            <div className="countdown-header">
              <img className="countdown-art" src={nextCountdownAnime.imageUrl} alt={nextCountdownAnime.title} />
              <div className="countdown-copy">
                <h2 id="next-release-title">{nextCountdownAnime.title}</h2>
                <div className="countdown-grid" aria-label="Next episode countdown">
                  {countdown ? (
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
            <h2 id="watchlist-title">Selected AniCount picks</h2>
          </div>
          <div className="section-actions">
            <span className="muted">{watchlist.length} anime</span>
            <button
              type="button"
              className="ghost-button icon-only-button"
              onClick={clearWatchlist}
              disabled={watchlist.length === 0}
              aria-label="Clear watchlist"
              title="Clear watchlist"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        {sortedWatchlist.length > 0 ? (
          <div className="watchlist-items">
            {sortedWatchlist.map((anime) => (
              <article key={anime.malId} className="watchlist-card">
                <img src={anime.imageUrl} alt={anime.title} />
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

      {isOffline ? <div className="status-banner">You are offline. Saved watchlist data still works, but fresh anime updates need an internet connection.</div> : null}

      {error ? <div className="status-banner error-banner">{error}</div> : null}

      <section className="toolbar" aria-label="Anime controls">
        <label className="search-field">
          <span>Search all anime</span>
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
                    <img className="anime-card-art" src={anime.imageUrl} alt={anime.title} />
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
                        className={isSelected ? "secondary-button full-width" : "primary-button full-width"}
                        onClick={() => toggleWatchlist(anime)}
                        aria-label={isSelected ? `Remove ${anime.title} from watchlist` : `Add ${anime.title} to watchlist`}
                        title={isSelected ? `Remove ${anime.title} from watchlist` : `Add ${anime.title} to watchlist`}
                      >
                        {isSelected ? "In Watchlist" : "Add Watchlist"}
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
    </main>
  );
}

export default App;
