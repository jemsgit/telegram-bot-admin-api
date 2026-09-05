import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { AutoForm } from "./AutoForm";
import { AutoTable } from "./AutoTable";
import { ConfirmButton } from "./ConfirmButton";
import { buildRouteRequest } from "./routeRequest";
import { useApiClient } from "../api/context";
import { ApiError } from "../api/client";
import type { CustomRouteConfig } from "../types";

interface GenericRouteScreenProps {
  route: CustomRouteConfig;
}

/**
 * Рендерит один пункт `customRoutesConfig` по его `kind` — то, ради чего
 * весь `ui-schema.ts` затевался: бот описывает роут декларативно, здесь
 * ничего специфичного для конкретного бота нет.
 */
export function GenericRouteScreen({ route }: GenericRouteScreenProps) {
  switch (route.kind) {
    case "list":
      return <ListScreen route={route} />;
    case "action":
      return <ActionScreen route={route} />;
    case "form":
    default:
      return <FormScreen route={route} />;
  }
}

function ScreenHeader({ route }: { route: CustomRouteConfig }) {
  return (
    <Stack gap={4} mb="md">
      <Title order={4}>{route.label ?? route.description ?? route.url}</Title>
      {route.description && route.label && (
        <Text size="sm" c="dimmed">
          {route.description}
        </Text>
      )}
    </Stack>
  );
}

function FormScreen({ route }: { route: CustomRouteConfig }) {
  const client = useApiClient();
  const [success, setSuccess] = useState(false);

  async function handleSubmit(values: Record<string, unknown>) {
    const req = buildRouteRequest(route.fields, route.url, route.method, values);
    await client.call(req.method, req.url, req.body);
  }

  return (
    <div>
      <ScreenHeader route={route} />
      {success && (
        <Alert color="green" variant="light" mb="md">
          {route.successMessage ?? "Готово"}
        </Alert>
      )}
      <AutoForm
        fields={route.fields ?? []}
        onSubmit={handleSubmit}
        onSuccess={() => setSuccess(true)}
      />
    </div>
  );
}

function ActionScreen({ route }: { route: CustomRouteConfig }) {
  const client = useApiClient();
  const [success, setSuccess] = useState(false);

  const hasFields = (route.fields?.length ?? 0) > 0;

  async function run(values: Record<string, unknown> = {}) {
    const req = buildRouteRequest(route.fields, route.url, route.method, values);
    await client.call(req.method, req.url, req.body);
  }

  return (
    <div>
      <ScreenHeader route={route} />
      {success && (
        <Alert color="green" variant="light" mb="md">
          {route.successMessage ?? "Готово"}
        </Alert>
      )}
      {hasFields ? (
        <AutoForm
          fields={route.fields ?? []}
          confirmText={route.confirm}
          submitLabel={route.label ?? "Выполнить"}
          onSubmit={run}
          onSuccess={() => setSuccess(true)}
        />
      ) : (
        <ConfirmButton
          label={route.label ?? "Выполнить"}
          confirmText={route.confirm}
          onConfirm={() => run()}
          onSuccess={() => setSuccess(true)}
        />
      )}
    </div>
  );
}

function ListScreen({ route }: { route: CustomRouteConfig }) {
  const client = useApiClient();
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get<unknown>(route.url);
      setData(Array.isArray(res) ? (res as Record<string, unknown>[]) : []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, [client, route.url]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={4}>{route.label ?? route.description ?? route.url}</Title>
          {route.description && route.label && (
            <Text size="sm" c="dimmed">
              {route.description}
            </Text>
          )}
        </div>
        <Button variant="default" size="xs" onClick={() => void load()} loading={loading}>
          Обновить
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
        <AutoTable data={data ?? []} columns={route.columns} />
      )}
    </div>
  );
}
