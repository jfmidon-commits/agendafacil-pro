function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: "year" | "month" | "day") => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`invalid_${type}`);
    return Number(value);
  };

  return { year: get("year"), month: get("month"), day: get("day") };
}

export function localDateKey(date: Date, timeZone: string) {
  const { year, month, day } = localDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function nextLocalDateKey(now: Date, timeZone: string) {
  const { year, month, day } = localDateParts(now, timeZone);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function isNextLocalDay(startsAt: string, now: Date, timeZone: string) {
  return localDateKey(new Date(startsAt), timeZone) === nextLocalDateKey(now, timeZone);
}
