import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Drawer, Loader, Stack, Text, Title } from "@mantine/core";
import { useApiClient } from "../api/context";
import { ApiError } from "../api/client";
import { AutoTable } from "../components/AutoTable";
import { AutoForm } from "../components/AutoForm";
import type { FieldSchema } from "../types";

interface UserReport {
  _id: string;
  userId: number;
  message: string;
  adminReply: string;
  done: boolean;
}

const REPLY_FIELDS: FieldSchema[] = [
  { name: "text", label: "Ответ", type: "textarea", required: true },
];

export function ReportsScreen() {
  const client = useApiClient();
  const [data, setData] = useState<UserReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<UserReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await client.get<UserReport[]>("/api/reports"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReply(values: Record<string, unknown>) {
    if (!selected) return;
    await client.post(`/api/reports/${encodeURIComponent(selected._id)}/reply`, {
      text: values.text,
    });
    await load();
  }

  return (
    <div>
      <Title order={4} mb="md">
        📝 Обращения
      </Title>
      {error && (
        <Alert color="red" variant="light" mb="md">
          {error}
        </Alert>
      )}
      {loading && !data ? (
        <Loader size="sm" />
      ) : (
        <AutoTable
          data={(data ?? []) as unknown as Record<string, unknown>[]}
          columns={["_id", "userId", "message", "done"]}
          onRowClick={(row) => setSelected(row as unknown as UserReport)}
        />
      )}

      <Drawer
        opened={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Обращение от ${selected.userId}` : ""}
        position="right"
      >
        {selected && (
          <Stack>
            <Badge color={selected.done ? "green" : "yellow"}>
              {selected.done ? "закрыто" : "открыто"}
            </Badge>
            <Text>{selected.message}</Text>
            {selected.adminReply && (
              <Text c="dimmed" size="sm">
                Текущий ответ: {selected.adminReply}
              </Text>
            )}
            <AutoForm
              key={selected._id}
              fields={REPLY_FIELDS}
              submitLabel="Ответить"
              onSubmit={handleReply}
              onSuccess={() => setSelected(null)}
            />
          </Stack>
        )}
      </Drawer>
    </div>
  );
}
