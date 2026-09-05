/**
 * Зеркалит публичную форму типов из `../../src/ui-schema.ts` — только
 * декларации (без рантайм-функций, без импорта express/telegraf, чтобы не
 * тащить бэкендовый граф зависимостей во фронтенд-проект). При правке формы
 * в `src/ui-schema.ts` поправить и здесь.
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
  route: string;
  searchParam?: string;
  valueField?: string;
  labelField?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface FieldSchema {
  name: string;
  label?: string;
  type: FieldType;
  required?: boolean;
  placement?: "body" | "path" | "query";
  placeholder?: string;
  options?: FieldOption[];
  lookup?: FieldLookup;
  validation?: FieldValidation;
}

export type RouteUiKind = "form" | "list" | "action";

export interface RouteUi {
  kind?: RouteUiKind;
  label?: string;
  description?: string;
  group?: string;
  fields?: FieldSchema[];
  columns?: string[];
  confirm?: string;
  successMessage?: string;
}

/** Один элемент `customRoutesConfig` из ответа `GET /api/config`. */
export interface CustomRouteConfig extends RouteUi {
  url: string;
  method: "get" | "post" | "put" | "delete" | "patch";
  kind: RouteUiKind; // сервер всегда резолвит kind (resolveRouteUi)
}

export type FeatureName =
  | "broadcast"
  | "subscriptions"
  | "promocodes"
  | "reports"
  | "referral"
  | "payments"
  | "postcontentAd";

/** Ответ `GET /api/config`. */
export type AdminConfigResponse = {
  [K in FeatureName]?: boolean;
} & {
  customRoutesConfig?: CustomRouteConfig[];
};
