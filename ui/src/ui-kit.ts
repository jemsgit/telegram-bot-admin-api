/**
 * Точка входа библиотечной сборки (`telegraf-admin-for-bots/ui-kit`, шаг 4 в
 * `docs/CUSTOMIZABLE_ADMIN_UI.md`). Отдельный build-таргет от standalone-бандла
 * (`vite.config.ts` → `lib/ui`) — тот же `ui/src/`, но без `App.tsx`/`main.tsx`/
 * `TokenGate` (специфика standalone-режима: логин по `ADMIN_API_TOKEN`,
 * единственный бот на странице). Для [[central-panel-gateway]] — своя
 * авторизация операторов и свой `api/client.ts` с `baseUrl: "/gw/<username>"`,
 * компоненты и экраны отсюда просто рендерят то, что он вернёт.
 *
 * React/react-dom/@mantine/* — peerDependencies (см. `vite.config.lib.ts`
 * `rollupOptions.external` + корневой `package.json`), не бандлятся сюда —
 * потребитель (`admin-panel/web`) подключает их сам.
 */

// Типы схемы — тот же публичный контракт, что и `../../src/ui-schema.ts`.
export type {
  FieldType,
  FieldOption,
  FieldLookup,
  FieldValidation,
  FieldSchema,
  RouteUiKind,
  RouteUi,
  CustomRouteConfig,
  FeatureName,
  AdminConfigResponse,
} from "./types";

// API-клиент — тонкая fetch-обёртка с Bearer-токеном; `baseUrl` задаёт
// потребитель (`/gw/<username>` у панели, `""` у standalone-режима).
export { ApiError, createApiClient } from "./api/client";
export type { ApiClient, CreateApiClientOptions } from "./api/client";
export { ApiClientProvider, useApiClient } from "./api/context";

// Генерик-компоненты рендеринга схемы.
export { AutoForm } from "./components/AutoForm";
export type { AutoFormProps } from "./components/AutoForm";
export { AutoTable } from "./components/AutoTable";
export type { AutoTableProps } from "./components/AutoTable";
export { ConfirmButton } from "./components/ConfirmButton";
export type { ConfirmButtonProps } from "./components/ConfirmButton";
export { FieldInput } from "./components/FieldInput";
export { LookupField } from "./components/LookupField";
export { GenericRouteScreen } from "./components/GenericRouteScreen";
export {
  serializeFieldValue,
  serializeFormValues,
  buildRouteRequest,
} from "./components/routeRequest";
export type { RouteRequest } from "./components/routeRequest";

// Встроенные экраны по фичам (шаг 3) — панель их не переписывает, только
// подключает к своему `api/client.ts` (см. `docs/ADMIN_PANEL_APP.md`, шаг 4).
export { UsersScreen } from "./screens/UsersScreen";
export { BroadcastsScreen } from "./screens/BroadcastsScreen";
export { PromocodesScreen } from "./screens/PromocodesScreen";
export { ReportsScreen } from "./screens/ReportsScreen";
export { PaymentsScreen } from "./screens/PaymentsScreen";
export { ReferralScreen } from "./screens/ReferralScreen";
export { PostContentAdScreen } from "./screens/PostContentAdScreen";
