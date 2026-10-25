// UI strings in English and Bahasa Melayu, plus the language and theme preferences.
// Anime data from AniList (titles, synopses) stays in its source language. Status,
// season, and genre labels are stored in English (they are synced and used for
// scheduling logic), so they are translated only when displayed.

export type Locale = "en" | "ms";
export type ThemePreference = "system" | "light" | "dark";
export type SyncStatus = "local" | "loading" | "saving" | "saved" | "failed";
export type AuthErrorKind = "cancelled" | "failed";

const LOCALE_KEY = "anicount-locale";
const THEME_KEY = "anicount-theme";

const en = {
  htmlLang: "en",
  // Undefined uses the browser's own locale for dates.
  dateLocale: undefined as string | undefined,

  languageLabel: "Language",
  switchToLight: "Switch to light theme",
  switchToDark: "Switch to dark theme",

  signInPrompt: "Sign in to sync your watchlist across devices",
  signInWithGoogle: "Sign in with Google",
  signOut: "Sign out",
  authErrors: {
    cancelled: "Sign-in was cancelled. Your local watchlist is safe.",
    failed: "Sign-in failed. Please try again. Your local watchlist is safe.",
  } satisfies Record<AuthErrorKind, string>,
  syncStatus: {
    local: "Saved on this device",
    loading: "Loading saved watchlist…",
    saving: "Saving…",
    saved: "Saved across your devices",
    failed: "Cloud sync failed. Your watchlist is saved on this device.",
  } satisfies Record<SyncStatus, string>,
  retrySync: "Retry sync",

  nextEpisode: "Next episode",
  countdownLabel: "Next episode countdown",
  countdownUnits: { days: "Days", hours: "Hours", minutes: "Mins", seconds: "Secs" },
  nextEpisodeTbaTitle: "Next Episode TBA",
  nextEpisodeTbaBody: "The release time hasn’t been announced yet.",
  airingNowTitle: "Airing Now",
  airingNowBody: "The next episode is airing right now!",
  shortCountdown: (days: number, hours: number, minutes: number) =>
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
  shortCountdownTba: "TBA",
  shortCountdownSoon: "<1m",
  shortCountdownLive: "Live",

  yourAnime: "Your anime",
  yourWatchlist: "Your watchlist",
  clearAll: "Clear all",
  cancel: "Cancel",
  confirmClearWatchlist: "Confirm clear watchlist",
  cancelClearWatchlist: "Cancel clear watchlist",
  clearWatchlist: "Clear watchlist",
  swipeHint: "Swipe a row left to remove it.",
  remove: "Remove",
  removeFromWatchlist: (title: string) => `Remove ${title} from watchlist`,
  addToWatchlistFor: (title: string) => `Add ${title} to watchlist`,
  emptyEyebrow: "Your watchlist is empty",
  emptyTitle: "Build your AniCount list",
  emptyBody: "Search or browse below, then choose Add to Watchlist to start a live countdown for each anime.",

  offline: "You are offline. Saved watchlist data still works, but fresh anime updates need an internet connection.",
  loadSearchFailed: "We couldn’t load your search results.",
  loadFailed: "We couldn’t load anime right now.",
  retry: "Retry",

  searchResults: "Search results",
  upcomingAnime: "Upcoming anime",
  resultsFor: (query: string) => `Results for "${query}"`,
  browseTitle: "Browse and choose anime",
  resultCount: (count: number) => `${count} results`,
  visibleCount: (count: number) => `${count} visible`,
  searchLabel: "Search all anime",
  searchPlaceholder: "Search all anime by title",
  clearSearch: "Clear search results",
  searchingTitle: "Searching all anime...",
  searchingBody: "Looking through the full anime catalog.",
  loadingTitle: "Loading upcoming anime...",
  loadingBody: "Pulling the latest release data.",
  loadErrorTitle: "Anime couldn’t be loaded.",
  loadErrorBody: "Check your connection and use Retry above. Your saved watchlist is still available.",
  noSearchMatch: "No anime matched your search.",
  noUpcoming: "No upcoming anime available yet.",
  emptyListHint: "Try another title or clear the search to browse upcoming releases.",
  loadMoreSearch: "Load more search results",
  loadMoreUpcoming: "Load more upcoming anime",

  episodes: (count: number | null) => `${count ?? "?"} eps`,
  score: (score: number | null) => `Score ${score ?? "N/A"}`,
  inWatchlist: "In Watchlist",
  addToWatchlist: "Add to Watchlist",
  dateTba: "Date to be announced",
  nextEpisodeDateTba: "Next episode date not announced",
  noSynopsis: "No synopsis available yet.",
  studioTba: "Studio TBA",

  // Keyed by the English labels stored with each anime.
  statuses: {} as Record<string, string>,
  seasons: {} as Record<string, string>,
  genres: {} as Record<string, string>,
};

export type Messages = typeof en;

const ms: Messages = {
  htmlLang: "ms",
  dateLocale: "ms-MY",

  languageLabel: "Bahasa",
  switchToLight: "Tukar ke tema cerah",
  switchToDark: "Tukar ke tema gelap",

  signInPrompt: "Log masuk untuk menyegerakkan senarai tontonan anda merentas peranti",
  signInWithGoogle: "Log masuk dengan Google",
  signOut: "Log keluar",
  authErrors: {
    cancelled: "Log masuk dibatalkan. Senarai tontonan setempat anda selamat.",
    failed: "Log masuk gagal. Sila cuba lagi. Senarai tontonan setempat anda selamat.",
  },
  syncStatus: {
    local: "Disimpan pada peranti ini",
    loading: "Memuatkan senarai tontonan tersimpan…",
    saving: "Menyimpan…",
    saved: "Disimpan merentas peranti anda",
    failed: "Penyegerakan awan gagal. Senarai tontonan anda disimpan pada peranti ini.",
  },
  retrySync: "Cuba segerak semula",

  nextEpisode: "Episod seterusnya",
  countdownLabel: "Kiraan detik episod seterusnya",
  countdownUnits: { days: "Hari", hours: "Jam", minutes: "Minit", seconds: "Saat" },
  nextEpisodeTbaTitle: "Episod Seterusnya Belum Diumumkan",
  nextEpisodeTbaBody: "Masa tayangan belum diumumkan.",
  airingNowTitle: "Sedang Bersiaran",
  airingNowBody: "Episod seterusnya sedang bersiaran sekarang!",
  // h = hari (days), j = jam (hours), m = minit (minutes).
  shortCountdown: (days, hours, minutes) => (days > 0 ? `${days}h ${hours}j` : hours > 0 ? `${hours}j ${minutes}m` : `${minutes}m`),
  shortCountdownTba: "Belum",
  shortCountdownSoon: "<1m",
  shortCountdownLive: "Langsung",

  yourAnime: "Anime anda",
  yourWatchlist: "Senarai tontonan anda",
  clearAll: "Kosongkan semua",
  cancel: "Batal",
  confirmClearWatchlist: "Sahkan kosongkan senarai tontonan",
  cancelClearWatchlist: "Batal kosongkan senarai tontonan",
  clearWatchlist: "Kosongkan senarai tontonan",
  swipeHint: "Leret baris ke kiri untuk membuangnya.",
  remove: "Buang",
  removeFromWatchlist: (title) => `Buang ${title} daripada senarai tontonan`,
  addToWatchlistFor: (title) => `Tambah ${title} ke senarai tontonan`,
  emptyEyebrow: "Senarai tontonan anda kosong",
  emptyTitle: "Bina senarai AniCount anda",
  emptyBody: "Cari atau semak imbas di bawah, kemudian pilih Tambah ke Senarai untuk memulakan kiraan detik langsung bagi setiap anime.",

  offline: "Anda di luar talian. Senarai tontonan yang disimpan masih berfungsi, tetapi kemas kini anime terkini memerlukan sambungan internet.",
  loadSearchFailed: "Kami tidak dapat memuatkan hasil carian anda.",
  loadFailed: "Kami tidak dapat memuatkan anime sekarang.",
  retry: "Cuba lagi",

  searchResults: "Hasil carian",
  upcomingAnime: "Anime akan datang",
  resultsFor: (query) => `Hasil untuk "${query}"`,
  browseTitle: "Semak imbas dan pilih anime",
  resultCount: (count) => `${count} hasil`,
  visibleCount: (count) => `${count} dipaparkan`,
  searchLabel: "Cari semua anime",
  searchPlaceholder: "Cari semua anime mengikut tajuk",
  clearSearch: "Kosongkan hasil carian",
  searchingTitle: "Mencari semua anime...",
  searchingBody: "Mencari dalam katalog anime penuh.",
  loadingTitle: "Memuatkan anime akan datang...",
  loadingBody: "Mendapatkan data tayangan terkini.",
  loadErrorTitle: "Anime tidak dapat dimuatkan.",
  loadErrorBody: "Semak sambungan anda dan tekan Cuba lagi di atas. Senarai tontonan anda yang disimpan masih tersedia.",
  noSearchMatch: "Tiada anime sepadan dengan carian anda.",
  noUpcoming: "Belum ada anime akan datang.",
  emptyListHint: "Cuba tajuk lain atau kosongkan carian untuk melihat tayangan akan datang.",
  loadMoreSearch: "Muatkan lebih banyak hasil carian",
  loadMoreUpcoming: "Muatkan lebih banyak anime akan datang",

  episodes: (count) => `${count ?? "?"} episod`,
  score: (score) => `Skor ${score ?? "T/A"}`,
  inWatchlist: "Dalam Senarai",
  addToWatchlist: "Tambah ke Senarai",
  dateTba: "Tarikh belum diumumkan",
  nextEpisodeDateTba: "Tarikh episod seterusnya belum diumumkan",
  noSynopsis: "Sinopsis belum tersedia.",
  studioTba: "Studio belum diumumkan",

  statuses: {
    "Not Yet Aired": "Belum Ditayangkan",
    "Currently Airing": "Sedang Ditayangkan",
    "Finished Airing": "Tamat Ditayangkan",
    Cancelled: "Dibatalkan",
    "On Hiatus": "Berehat",
  },
  seasons: {
    Winter: "Musim Sejuk",
    Spring: "Musim Bunga",
    Summer: "Musim Panas",
    Fall: "Musim Luruh",
    Upcoming: "Akan Datang",
    "Upcoming anime": "Anime akan datang",
  },
  // AniList's fixed genre list.
  genres: {
    Action: "Aksi",
    Adventure: "Pengembaraan",
    Comedy: "Komedi",
    Drama: "Drama",
    Fantasy: "Fantasi",
    Horror: "Seram",
    Music: "Muzik",
    Mystery: "Misteri",
    Psychological: "Psikologi",
    Romance: "Romantik",
    "Sci-Fi": "Sains Fiksyen",
    "Slice of Life": "Kehidupan Harian",
    Sports: "Sukan",
    Supernatural: "Ghaib",
    Thriller: "Saspens",
  },
};

export const messages: Record<Locale, Messages> = { en, ms };
export const localeNames: Record<Locale, string> = { en: "English", ms: "Bahasa Melayu" };
// Short labels for the language toggle; BM is the usual abbreviation for Bahasa Melayu.
export const localeShortNames: Record<Locale, string> = { en: "EN", ms: "BM" };

/** Translates an English stored label, falling back to the original. */
export function translateLabel(table: Record<string, string>, label: string): string {
  return table[label] ?? label;
}

/** Translates a season label such as "Winter 2026". */
export function translateSeason(t: Messages, label: string): string {
  const match = /^(\S+)(\s+\d{4})?$/.exec(label);
  if (match && t.seasons[match[1]]) return `${t.seasons[match[1]]}${match[2] ?? ""}`;
  return translateLabel(t.seasons, label);
}

function readPreference<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : null;
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

export function readLocale(): Locale {
  const saved = readPreference<Locale>(LOCALE_KEY, ["en", "ms"]);
  if (saved) return saved;
  const languages = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language];
  return languages.some((language) => /^(ms|zsm)\b/i.test(language)) ? "ms" : "en";
}

export function saveLocale(locale: Locale): void {
  writePreference(LOCALE_KEY, locale);
}

export function readTheme(): ThemePreference {
  return readPreference<ThemePreference>(THEME_KEY, ["system", "light", "dark"]) ?? "system";
}

/** Saves the theme and applies it; "system" follows the OS setting. */
export function applyTheme(theme: ThemePreference): void {
  writePreference(THEME_KEY, theme);
  if (typeof document === "undefined") return;
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
