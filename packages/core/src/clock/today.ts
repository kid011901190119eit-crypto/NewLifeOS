const tokyoDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** now の時点での Asia/Tokyo の日付を YYYY-MM-DD で返す */
export function todayInTokyo(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("todayInTokyo: invalid Date");
  }

  const parts = tokyoDateFormat.formatToParts(now);
  const year = partValue(parts, "year");
  const month = partValue(parts, "month");
  const day = partValue(parts, "day");
  return `${year}-${month}-${day}`;
}

function partValue(parts: Intl.DateTimeFormatPart[], type: "year" | "month" | "day"): string {
  const part = parts.find((p) => p.type === type);
  if (part === undefined) {
    throw new Error(`todayInTokyo: missing ${type} in formatted date`);
  }
  return part.value;
}
