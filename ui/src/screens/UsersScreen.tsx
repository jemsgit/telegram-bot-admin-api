import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useApiClient } from "../api/context";
import { ApiError } from "../api/client";
import { AutoTable } from "../components/AutoTable";
import { AutoForm } from "../components/AutoForm";
import { ConfirmButton } from "../components/ConfirmButton";
import type { AdminConfigResponse, FieldSchema } from "../types";

interface AdminUser {
  userId: string | number;
  username?: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
  promoCode?: string;
  subscription?: { activeUntil?: string | null; isTrial?: boolean; trialUsed?: boolean } | null;
}

interface UserReport {
  _id: string;
  message: string;
  adminReply: string;
  done: boolean;
}

const DAYS_FIELD: FieldSchema[] = [
  { name: "days", label: "Дней", type: "number", required: true, validation: { min: 1 } },
];
const PROMOCODE_FIELD: FieldSchema[] = [
  { name: "promoCode", label: "Промокод", type: "text", required: true },
];

interface UsersScreenProps {
  config: AdminConfigResponse;
}

/** Users — core-фича, доступна всегда (в отличие от остальных экранов). */
export function UsersScreen({ config }: UsersScreenProps) {
  const client = useApiClient();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [reports, setReports] = useState<UserReport[] | null>(null);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        setData(await client.get<AdminUser[]>(`/api/users?query=${encodeURIComponent(q)}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const showAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await client.get<AdminUser[]>("/api/users/all"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void showAll();
  }, [showAll]);

  const refreshSelected = useCallback(
    async (userId: string | number) => {
      const fresh = await client.get<AdminUser>(`/api/users/${userId}`);
      setSelected(fresh);
      if (config.reports) {
        setReports(await client.get<UserReport[]>(`/api/users/${userId}/reports`));
      }
    },
    [client, config.reports],
  );

  function openUser(user: AdminUser) {
    setSelected(user);
    setReports(null);
    if (config.reports) {
      void client
        .get<UserReport[]>(`/api/users/${user.userId}/reports`)
        .then(setReports)
        .catch(() => setReports([]));
    }
  }

  const columns = ["userId", "username", "firstName", "lastName", "active"];
  if (config.promocodes) columns.push("promoCode");
  const rows = (data ?? []).map((u) => ({
    ...u,
    ...(config.subscriptions ? { activeUntil: u.subscription?.activeUntil ?? null } : {}),
  }));
  if (config.subscriptions) columns.push("activeUntil");

  return (
    <div>
      <Title order={4} mb="md">
        👤 Пользователи
      </Title>
      <Group mb="md">
        <TextInput
          placeholder="Поиск по имени/username/id"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          style={{ flex: 1 }}
          onKeyDown={(e) => e.key === "Enter" && void search(query)}
        />
        <Button onClick={() => void search(query)} loading={loading}>
          Найти
        </Button>
        <Button variant="default" onClick={() => void showAll()} loading={loading}>
          Показать всех
        </Button>
      </Group>
      {error && (
        <Alert color="red" variant="light" mb="md">
          {error}
        </Alert>
      )}
      {loading && !data ? (
        <Loader size="sm" />
      ) : (
        <AutoTable
          data={rows as unknown as Record<string, unknown>[]}
          columns={columns}
          onRowClick={(row) => openUser(row as unknown as AdminUser)}
        />
      )}

      <Drawer
        opened={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.username ?? `Пользователь ${selected.userId}` : ""}
        position="right"
        size="md"
      >
        {selected && (
          <Stack>
            <Group>
              <Badge color={selected.active ? "green" : "gray"}>
                {selected.active ? "активен" : "неактивен"}
              </Badge>
              {selected.promoCode && <Badge color="grape">промокод: {selected.promoCode}</Badge>}
            </Group>
            <Text size="sm" c="dimmed">
              ID: {selected.userId}
              {selected.firstName ? ` · ${selected.firstName} ${selected.lastName ?? ""}` : ""}
            </Text>

            {config.subscriptions && (
              <>
                <Divider label="Подписка" />
                <Text size="sm">
                  До:{" "}
                  {selected.subscription?.activeUntil
                    ? new Date(selected.subscription.activeUntil).toLocaleString("ru")
                    : "—"}
                  {selected.subscription?.isTrial ? " (пробная)" : ""}
                </Text>
                <AutoForm
                  key={`extend-${selected.userId}`}
                  fields={DAYS_FIELD}
                  submitLabel="Продлить подписку"
                  onSubmit={async (v) => {
                    await client.post(`/api/users/${selected.userId}/extend-subscription`, v);
                  }}
                  onSuccess={() => void refreshSelected(selected.userId)}
                />
                <AutoForm
                  key={`promo-sub-${selected.userId}`}
                  fields={DAYS_FIELD}
                  submitLabel="Активировать промо-подписку"
                  onSubmit={async (v) => {
                    await client.post(`/api/users/${selected.userId}/activate-promo-subscription`, v);
                  }}
                  onSuccess={() => void refreshSelected(selected.userId)}
                />
                <ConfirmButton
                  label="Удалить подписку"
                  confirmText="Удалить подписку у этого пользователя?"
                  onConfirm={async () => {
                    await client.delete(`/api/users/${selected.userId}/subscription`);
                  }}
                  onSuccess={() => void refreshSelected(selected.userId)}
                />
              </>
            )}

            {config.promocodes && (
              <>
                <Divider label="Промокод" />
                <AutoForm
                  key={`promocode-${selected.userId}`}
                  fields={PROMOCODE_FIELD}
                  submitLabel="Выдать промокод"
                  onSubmit={async (v) => {
                    await client.post(`/api/users/${selected.userId}/promocode`, v);
                  }}
                  onSuccess={() => void refreshSelected(selected.userId)}
                />
              </>
            )}

            {config.reports && (
              <>
                <Divider label="Обращения" />
                {reports === null ? (
                  <Loader size="xs" />
                ) : (
                  <AutoTable
                    data={reports as unknown as Record<string, unknown>[]}
                    columns={["message", "adminReply", "done"]}
                  />
                )}
              </>
            )}
          </Stack>
        )}
      </Drawer>
    </div>
  );
}
