type EpisodeScheduleSource = {
  airing: boolean;
  releaseAt: string | null;
  broadcastDay: string | null;
  broadcastTime: string | null;
  broadcastTimezone: string | null;
  status: string;
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function getWeekdayIndex(day: string | null): number | null {
  if (typeof day !== "string" || !day) {
    return null;
  }

  const normalizedDay = day.toLowerCase().replace(/s$/, "").trim();
  return Object.hasOwn(WEEKDAY_INDEX, normalizedDay) ? WEEKDAY_INDEX[normalizedDay] : null;
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

export function resolveNextEpisodeAt(source: EpisodeScheduleSource, nowMs: number): string | null {
  const status = typeof source.status === "string" ? source.status.toLowerCase() : "";
  const releaseAtMs = typeof source.releaseAt === "string" ? Date.parse(source.releaseAt) : NaN;
  const releaseAt = Number.isFinite(releaseAtMs) ? source.releaseAt : null;
  const fallback = releaseAtMs > nowMs ? releaseAt : null;
  const isNotYetAired = status.includes("not yet aired");
  const isFinished = status.includes("finished");
  const isCurrentlyAiring = source.airing || status.includes("currently airing");

  if (isFinished) {
    return null;
  }

  if (isNotYetAired) {
    return releaseAt;
  }

  const weekdayIndex = getWeekdayIndex(source.broadcastDay);
  const timeMatch = typeof source.broadcastTime === "string" ? /^(\d{1,2}):(\d{2})$/.exec(source.broadcastTime) : null;
  const [, hourText, minuteText] = timeMatch ?? [];
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!isCurrentlyAiring || weekdayIndex === null || typeof source.broadcastTimezone !== "string" || !source.broadcastTimezone || !timeMatch || hour > 23 || minute > 59) {
    return fallback;
  }

  // API responses and saved watchlists can contain invalid IANA timezone names.
  // Validate before performing any date arithmetic that could throw during render.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: source.broadcastTimezone }).format(new Date(nowMs));
  } catch {
    return fallback;
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
