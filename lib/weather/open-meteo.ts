const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const FETCH_TIMEOUT_MS = 8000;

export type WeatherForecastDay = {
  date: string;
  precipitationSumMm: number | null;
  precipitationProbabilityMax: number | null;
  weatherCode: number | null;
  summary: string;
};

export type WeatherForecastHour = {
  time: string;
  precipitationMm: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
};

export type WeatherForecastResult = {
  available: boolean;
  lat: number;
  lng: number;
  timezone: string;
  generatedAt: string;
  daily: WeatherForecastDay[];
  hourlyNext24h: WeatherForecastHour[];
  floodRiskNote: string;
  error?: string;
};

function weatherCodeLabel(code: number | null): string {
  if (code === null) return "unknown conditions";
  if (code === 0) return "clear";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "foggy";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow or hail";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  if (code <= 99) return "thunderstorm";
  return "mixed conditions";
}

function floodRiskFromDaily(day: WeatherForecastDay): string {
  const rain = day.precipitationSumMm ?? 0;
  const prob = day.precipitationProbabilityMax ?? 0;
  if (rain >= 50 || prob >= 80) return "elevated";
  if (rain >= 25 || prob >= 60) return "moderate";
  if (rain >= 10 || prob >= 40) return "low";
  return "minimal";
}

function manilaLocalIsoMinutes(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Open-Meteo's hourly array starts at 00:00 local time of the current day, so
// the upcoming-24h window has to begin at the first hour >= now, not index 0.
export function findUpcomingHourlyStartIndex(hourlyTimes: string[], now = new Date()): number {
  const nowLocal = manilaLocalIsoMinutes(now);
  const startIndex = hourlyTimes.findIndex((time) => time >= nowLocal);
  return startIndex === -1 ? Math.max(0, hourlyTimes.length - 24) : startIndex;
}

export function getWeatherPrefetchDays(): number {
  const days = Number(process.env.WEATHER_PREFETCH_DAYS ?? "2");
  return Number.isFinite(days) && days >= 1 && days <= 7 ? days : 2;
}

export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  days = getWeatherPrefetchDays(),
): Promise<WeatherForecastResult> {
  const base: WeatherForecastResult = {
    available: false,
    lat,
    lng,
    timezone: "Asia/Manila",
    generatedAt: new Date().toISOString(),
    daily: [],
    hourlyNext24h: [],
    floodRiskNote: "Open-Meteo provides rainfall estimates, not street-level flood maps.",
  };

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ...base, error: "Invalid coordinates" };
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "precipitation,precipitation_probability,weather_code",
    daily: "precipitation_sum,precipitation_probability_max,weather_code",
    forecast_days: String(days),
    timezone: "Asia/Manila",
  });

  try {
    const response = await fetch(`${OPEN_METEO_BASE}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ...base, error: `Open-Meteo HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      timezone?: string;
      daily?: {
        time?: string[];
        precipitation_sum?: Array<number | null>;
        precipitation_probability_max?: Array<number | null>;
        weather_code?: Array<number | null>;
      };
      hourly?: {
        time?: string[];
        precipitation?: Array<number | null>;
        precipitation_probability?: Array<number | null>;
        weather_code?: Array<number | null>;
      };
    };

    const dailyTimes = data.daily?.time ?? [];
    const daily: WeatherForecastDay[] = dailyTimes.map((date, index) => {
      const precipitationSumMm = data.daily?.precipitation_sum?.[index] ?? null;
      const precipitationProbabilityMax =
        data.daily?.precipitation_probability_max?.[index] ?? null;
      const weatherCode = data.daily?.weather_code?.[index] ?? null;
      const summary = weatherCodeLabel(weatherCode);
      return {
        date,
        precipitationSumMm,
        precipitationProbabilityMax,
        weatherCode,
        summary,
      };
    });

    const hourlyTimes = data.hourly?.time ?? [];
    const hourlyStart = findUpcomingHourlyStartIndex(hourlyTimes);
    const hourlyNext24h: WeatherForecastHour[] = hourlyTimes
      .slice(hourlyStart, hourlyStart + 24)
      .map((time, offset) => {
        const index = hourlyStart + offset;
        return {
          time,
          precipitationMm: data.hourly?.precipitation?.[index] ?? null,
          precipitationProbability: data.hourly?.precipitation_probability?.[index] ?? null,
          weatherCode: data.hourly?.weather_code?.[index] ?? null,
        };
      });

    return {
      available: true,
      lat,
      lng,
      timezone: data.timezone ?? "Asia/Manila",
      generatedAt: new Date().toISOString(),
      daily: daily.map((day) => ({
        ...day,
        summary: `${day.summary}; flood-risk ${floodRiskFromDaily(day)}`,
      })),
      hourlyNext24h,
      floodRiskNote: base.floodRiskNote,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Open-Meteo fetch failed",
    };
  }
}
