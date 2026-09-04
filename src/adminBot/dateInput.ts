/**
 * Разбор дат из пользовательского ввода в admin-визардах.
 * Всё в локальной таймзоне процесса. Бросают `Error` при неверном формате —
 * вызывающий ловит и показывает подсказку.
 */

/** `ДД.ММ.ГГГГ` → `Date` (полночь локального времени). */
export function parseDate(input: string): Date {
  const parts = input.trim().split(".");
  if (parts.length !== 3) throw new Error("Invalid date format");

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error("Invalid date format");
  }

  const date = new Date(year, month, day);
  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year
  ) {
    throw new Error("Invalid date");
  }
  return date;
}

/** `ДД.ММ.ГГГГ ЧЧ:ММ` → `Date`. */
export function parseDateTime(input: string): Date {
  const parts = input.trim().split(" ");
  if (parts.length !== 2) throw new Error("Invalid format");

  const dateParts = parts[0].split(".");
  const timeParts = parts[1].split(":");
  if (dateParts.length !== 3 || timeParts.length !== 2) {
    throw new Error("Invalid format");
  }

  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  if ([day, month, year, hours, minutes].some((n) => isNaN(n))) {
    throw new Error("Invalid format");
  }

  const date = new Date(year, month, day, hours, minutes);
  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    throw new Error("Invalid date");
  }
  return date;
}

/** true, если строка — валидный URL. */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
