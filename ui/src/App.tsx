import { useEffect, useState, type ReactElement } from "react";
import {
  AppShell,
  Alert,
  Center,
  Loader,
  NavLink,
  Text,
  Title,
} from "@mantine/core";
import { useApiClient } from "./api/context";
import { ApiError } from "./api/client";
import { GenericRouteScreen } from "./components/GenericRouteScreen";
import { UsersScreen } from "./screens/UsersScreen";
import { BroadcastsScreen } from "./screens/BroadcastsScreen";
import { PromocodesScreen } from "./screens/PromocodesScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { PaymentsScreen } from "./screens/PaymentsScreen";
import { ReferralScreen } from "./screens/ReferralScreen";
import { PostContentAdScreen } from "./screens/PostContentAdScreen";
import type { AdminConfigResponse, CustomRouteConfig, FeatureName } from "./types";

// Подписи и экраны встроенных фич. `subscriptions` не значится тут — это
// не отдельный пункт меню, а часть детали пользователя (см. UsersScreen).
const BUILT_IN_FEATURES: Partial<Record<FeatureName, { label: string; Screen: () => ReactElement }>> = {
  broadcast: { label: "📢 Рассылки", Screen: BroadcastsScreen },
  promocodes: { label: "🎁 Промокоды", Screen: PromocodesScreen },
  reports: { label: "📝 Обращения", Screen: ReportsScreen },
  referral: { label: "🔗 Рефералы", Screen: ReferralScreen },
  payments: { label: "💰 Платежи", Screen: PaymentsScreen },
  postcontentAd: { label: "📈 Реклама", Screen: PostContentAdScreen },
};

type Selection =
  | { kind: "users" }
  | { kind: "builtin"; feature: FeatureName }
  | { kind: "custom"; route: CustomRouteConfig };

export function App() {
  const client = useApiClient();
  const [config, setConfig] = useState<AdminConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>({ kind: "users" });

  useEffect(() => {
    client
      .get<AdminConfigResponse>("/api/config")
      .then(setConfig)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить конфигурацию"),
      );
  }, [client]);

  if (error) {
    return (
      <Center mih="100vh">
        <Alert color="red" title="Ошибка">
          {error}
        </Alert>
      </Center>
    );
  }

  if (!config) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    );
  }

  const enabledFeatures = (Object.keys(BUILT_IN_FEATURES) as FeatureName[]).filter(
    (f) => config[f] && BUILT_IN_FEATURES[f],
  );
  const customRoutes = config.customRoutesConfig ?? [];

  return (
    <AppShell navbar={{ width: 260, breakpoint: "sm" }} padding="md">
      <AppShell.Navbar p="sm">
        <Title order={5} mb="sm">
          Админка
        </Title>
        <NavLink
          label="👤 Пользователи"
          active={selected.kind === "users"}
          onClick={() => setSelected({ kind: "users" })}
        />
        {enabledFeatures.map((feature) => (
          <NavLink
            key={feature}
            label={BUILT_IN_FEATURES[feature]!.label}
            active={selected.kind === "builtin" && selected.feature === feature}
            onClick={() => setSelected({ kind: "builtin", feature })}
          />
        ))}
        {customRoutes.length > 0 && (
          <Text size="xs" c="dimmed" mt="md" mb={4} tt="uppercase">
            Свои фичи
          </Text>
        )}
        {customRoutes.map((route) => (
          <NavLink
            key={`${route.method}:${route.url}`}
            label={route.label ?? route.description ?? route.url}
            active={selected.kind === "custom" && selected.route.url === route.url}
            onClick={() => setSelected({ kind: "custom", route })}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        {selected.kind === "users" && <UsersScreen config={config} />}
        {selected.kind === "builtin" &&
          (() => {
            const Screen = BUILT_IN_FEATURES[selected.feature]?.Screen;
            return Screen ? <Screen /> : null;
          })()}
        {selected.kind === "custom" && <GenericRouteScreen route={selected.route} />}
      </AppShell.Main>
    </AppShell>
  );
}
