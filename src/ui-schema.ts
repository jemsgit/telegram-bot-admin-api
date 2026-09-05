import type { CustomRoute } from "./types";

/**
 * Декларативная схема кастомных HTTP-роутов для внешней панели (см.
 * `docs/CUSTOMIZABLE_ADMIN_UI.md`, вариант A). Панель получает её через
 * `GET /api/config` (`customRoutesConfig`) и рендерит форму/список/кнопку
 * генериком — бот не пишет никакого фронтенд-кода.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "lookup";

export interface FieldOption {
  value: string | number;
  label: string;
}

export interface FieldLookup {
  /** GET-роут для поиска, напр. "/api/users" — тот же токен, ничего доп. настраивать не нужно. */
  route: string;
  /** Имя query-параметра поиска. По умолчанию "query". */
  searchParam?: string;
  /** Поле результата, которое уходит как значение. По умолчанию "id". */
  valueField?: string;
  /** Поле результата, которое показывается в списке. По умолчанию "name". */
  labelField?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** Источник RegExp, напр. "^\\d+$". */
  pattern?: string;
}

export interface FieldSchema {
  name: string;
  label?: string;
  type: FieldType;
  required?: boolean;
  /** Куда уходит значение при сабмите. По умолчанию "body". */
  placement?: "body" | "path" | "query";
  placeholder?: string;
  /** Обязательно для type: "select". */
  options?: FieldOption[];
  /** Обязательно для type: "lookup". */
  lookup?: FieldLookup;
  validation?: FieldValidation;
}

export type RouteUiKind = "form" | "list" | "action";

export interface RouteUi {
  /** По умолчанию выводится: GET без полей → "list", есть поля → "form", иначе → "action". */
  kind?: RouteUiKind;
  /** Подпись пункта меню/кнопки в панели. По умолчанию берётся из description. */
  label?: string;
  description?: string;
  /** Группировка кастомных пунктов в меню панели. */
  group?: string;
  fields?: FieldSchema[];
  /** Для kind: "list" — какие поля ответа показывать колонками. */
  columns?: string[];
  /** Для kind: "action" — текст подтверждающего диалога. */
  confirm?: string;
  successMessage?: string;
}

export interface CustomRouteWithUi extends CustomRoute {
  ui?: RouteUi;
}

const FIELD_TYPES: readonly FieldType[] = [
  "text",
  "textarea",
  "number",
  "boolean",
  "date",
  "datetime",
  "select",
  "lookup",
];

/** Выводит `kind`, если бот его не указал явно. */
export function resolveRouteUiKind(
  method: CustomRoute["method"],
  fields: FieldSchema[] | undefined,
): RouteUiKind {
  if (fields && fields.length) return "form";
  if (method === "get") return "list";
  return "action";
}

/** `ui` + выведенный `kind` — то, что реально уходит в `/api/config`. */
export function resolveRouteUi(
  route: CustomRouteWithUi,
): (RouteUi & { kind: RouteUiKind }) | undefined {
  if (!route.ui) return undefined;
  return {
    ...route.ui,
    kind: route.ui.kind ?? resolveRouteUiKind(route.method, route.ui.fields),
  };
}

/**
 * Проверяет схемы `ui` кастомных роутов на старте (тот же паттерн, что
 * `validateStore` для сторов) и бросает с полным списком проблем — лучше
 * упасть на старте бота, чем показать панели битую форму.
 */
export function validateRouteUi(routes: CustomRouteWithUi[]): void {
  const problems: string[] = [];

  for (const route of routes) {
    if (!route.ui) continue;
    const where = `${route.method.toUpperCase()} ${route.path}`;
    const seenNames = new Set<string>();

    for (const field of route.ui.fields ?? []) {
      if (!field.name) {
        problems.push(`${where}: поле без name`);
        continue;
      }
      if (seenNames.has(field.name)) {
        problems.push(`${where}: повторяющееся имя поля "${field.name}"`);
      }
      seenNames.add(field.name);

      if (!FIELD_TYPES.includes(field.type)) {
        problems.push(
          `${where}: поле "${field.name}" — неизвестный type "${field.type}" (ожидается одно из: ${FIELD_TYPES.join(", ")})`,
        );
      }
      if (field.type === "select" && !field.options?.length) {
        problems.push(
          `${where}: поле "${field.name}" типа select без options`,
        );
      }
      if (field.type === "lookup" && !field.lookup?.route) {
        problems.push(
          `${where}: поле "${field.name}" типа lookup без lookup.route`,
        );
      }
    }
  }

  if (problems.length) {
    throw new Error(
      `telegraf-admin-for-bots: некорректная UI-схема кастомных роутов:\n  - ${problems.join(
        "\n  - ",
      )}`,
    );
  }
}
