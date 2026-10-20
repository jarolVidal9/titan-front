const timeFmt = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit', hour12: true });

/** Hora en formato de 12 horas: "6:45 p. m.". */
export const formatTime = (ms: number) => timeFmt.format(ms);

/** Formatea con `Intl` en español; las opciones se cachean. */
const cache = new Map<string, Intl.DateTimeFormat>();
export function formatDate(ms: number, options: Intl.DateTimeFormatOptions): string {
  const key = JSON.stringify(options);
  let fmt = cache.get(key);
  if (!fmt) cache.set(key, (fmt = new Intl.DateTimeFormat('es', options)));
  return fmt.format(ms);
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "d MMM" → "5 oct". */
export const shortDate = (ms: number) => formatDate(ms, { day: 'numeric', month: 'short' }).replace('.', '');

/** "d MMM yy" → "5 oct 26". */
export const shortDateYear = (ms: number) =>
  formatDate(ms, { day: 'numeric', month: 'short', year: '2-digit' }).replace('.', '').replace(' de', '');

/** "d/M". */
export const dayMonth = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** 80 → "80", 82.5 → "82.5", 82.25 → "82.25". */
export function formatKg(kg: number): string {
  if (Number.isInteger(kg)) return kg.toFixed(0);
  return kg.toFixed(Math.abs(kg * 10 - Math.round(kg * 10)) < 1e-9 ? 1 : 2);
}

/** "32 min" o "32 min 30 s". */
export function formatMinutes(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** 95 → "1:35". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 45 → "45 min", 135 → "2 h 15 min". */
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** 1 = lunes ... 7 = domingo (como `DateTime.weekday` de Dart). */
export const isoWeekday = (ms: number) => ((new Date(ms).getDay() + 6) % 7) + 1;

export const isSameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** "Biserie", "Triserie" o "Circuito (n)". */
export function supersetLabel(size: number): string {
  if (size === 2) return 'Biserie';
  if (size === 3) return 'Triserie';
  return `Circuito (${size})`;
}

export const letter = (i: number) => String.fromCharCode(65 + i);
