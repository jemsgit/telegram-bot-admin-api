import type { FieldSchema } from "../types";

/** Значение из формы (Date для date/datetime, string[value] для select) → wire-формат. */
export function serializeFieldValue(field: FieldSchema, raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === "") return undefined;

  if (field.type === "date" && raw instanceof Date) {
    return raw.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (field.type === "datetime" && raw instanceof Date) {
    return raw.toISOString();
  }
  if (field.type === "select" && field.options) {
    // Mantine Select работает со string-значениями — сопоставляем обратно
    // с исходным типом (может быть number).
    const match = field.options.find((o) => String(o.value) === String(raw));
    return match ? match.value : raw;
  }
  return raw;
}

/**
 * Сериализует значения формы в plain-body-объект без раскладки по
 * path/query — используется встроенными экранами (`ui/src/screens/`), у
 * которых путь фиксирован в коде (не описывается `FieldSchema.placement`,
 * как у кастомных роутов бота).
 */
export function serializeFormValues(
  fields: FieldSchema[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const value = serializeFieldValue(field, values[field.name]);
    if (value !== undefined) body[field.name] = value;
  }
  return body;
}

export interface RouteRequest {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}

/** Раскладывает значения формы по url (path-параметры), query и body — по `field.placement`. */
export function buildRouteRequest(
  fields: FieldSchema[] | undefined,
  url: string,
  method: string,
  values: Record<string, unknown>,
): RouteRequest {
  let path = url;
  const body: Record<string, unknown> = {};
  const query = new URLSearchParams();

  for (const field of fields ?? []) {
    const value = serializeFieldValue(field, values[field.name]);
    if (value === undefined) continue;

    if (field.placement === "path") {
      path = path.replace(`:${field.name}`, encodeURIComponent(String(value)));
    } else if (field.placement === "query") {
      query.set(field.name, String(value));
    } else {
      body[field.name] = value;
    }
  }

  const qs = query.toString();
  return {
    url: qs ? `${path}?${qs}` : path,
    method,
    body: Object.keys(body).length ? body : undefined,
  };
}
