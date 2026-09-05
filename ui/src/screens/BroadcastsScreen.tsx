import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Drawer, Group, Loader, Select, Title } from "@mantine/core";
import { useApiClient } from "../api/context";
import { ApiError } from "../api/client";
import { AutoTable } from "../components/AutoTable";
import { AutoForm } from "../components/AutoForm";
import { ConfirmButton } from "../components/ConfirmButton";
import { serializeFormValues } from "../components/routeRequest";
import type { FieldSchema } from "../types";

interface Broadcast {
  id: string;
  title?: string;
  type: "text" | "photo" | "video";
  text: string;
  mediaUrl?: string;
  scheduledAt?: string;
  status: "pending" | "done" | "progress" | "cancelled";
  excludePaid: boolean;
  sentUsers: string[];
}

// linkButtons (массив {text,url}) в форме не редактируется — FieldSchema не
// поддерживает поля-массивы объектов; заводится через кастомный роут бота,
// если нужно (см. ui-schema.ts).
const BROADCAST_FIELDS: FieldSchema[] = [
  { name: "title", label: "Заголовок", type: "text" },
  {
    name: "type",
    label: "Тип",
    type: "select",
    required: true,
    options: [
      { value: "text", label: "Текст" },
      { value: "photo", label: "Фото" },
      { value: "video", label: "Видео" },
    ],
  },
  { name: "text", label: "Текст сообщения", type: "textarea" },
  { name: "mediaUrl", label: "URL медиа", type: "text", placeholder: "https://..." },
  { name: "scheduledAt", label: "Время отправки", type: "datetime" },
  { name: "excludePaid", label: "Не отправлять оплатившим", type: "boolean" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Все" },
  { value: "pending", label: "Ожидает" },
  { value: "progress", label: "В процессе" },
  { value: "done", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
];

export function BroadcastsScreen() {
  const client = useApiClient();
  const [status, setStatus] = useState("");
  const [data, setData] = useState<Broadcast[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Broadcast | null>(null);

  const load = useCallback(
    async (s: string) => {
      setLoading(true);
      setError(null);
      try {
        const path = s ? `/api/broadcasts?status=${s}` : "/api/broadcasts";
        setData(await client.get<Broadcast[]>(path));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void load(status);
  }, [load, status]);

  async function handleCreate(values: Record<string, unknown>) {
    await client.post("/api/broadcasts", serializeFormValues(BROADCAST_FIELDS, values));
    await load(status);
  }

  async function handleUpdate(values: Record<string, unknown>) {
    if (!editing) return;
    await client.put(`/api/broadcasts/${editing.id}`, serializeFormValues(BROADCAST_FIELDS, values));
    await load(status);
  }

  async function handleDelete(id: string) {
    await client.delete(`/api/broadcasts/${id}`);
    setEditing(null);
    await load(status);
  }

  async function handleSendTest(id: string) {
    await client.post(`/api/broadcasts/${id}/send-test`);
  }

  const rows = (data ?? []).map((b) => ({ ...b, sentUsersCount: b.sentUsers?.length ?? 0 }));

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={4}>📢 Рассылки</Title>
        <Button onClick={() => setCreateOpen(true)}>Создать</Button>
      </Group>
      <Select
        data={STATUS_OPTIONS}
        value={status}
        onChange={(v) => setStatus(v ?? "")}
        allowDeselect={false}
        mb="md"
        w={200}
      />
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
          columns={["id", "title", "type", "status", "scheduledAt", "excludePaid", "sentUsersCount"]}
          onRowClick={(row) => setEditing(row as unknown as Broadcast)}
          rowActions={(row) => (
            <ConfirmButton
              label="Тест"
              confirmText="Отправить тестовую рассылку админам?"
              onConfirm={() => handleSendTest(String(row.id))}
            />
          )}
        />
      )}

      <Drawer opened={createOpen} onClose={() => setCreateOpen(false)} title="Новая рассылка" position="right">
        <AutoForm
          fields={BROADCAST_FIELDS}
          submitLabel="Создать"
          initialValues={{ type: "text", excludePaid: true }}
          onSubmit={handleCreate}
          onSuccess={() => setCreateOpen(false)}
        />
      </Drawer>

      <Drawer
        opened={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.title || "Рассылка"}
        position="right"
      >
        {editing && (
          <>
            <AutoForm
              key={editing.id}
              fields={BROADCAST_FIELDS}
              submitLabel="Сохранить"
              initialValues={{
                ...editing,
                scheduledAt: editing.scheduledAt ? new Date(editing.scheduledAt) : null,
              }}
              onSubmit={handleUpdate}
              onSuccess={() => setEditing(null)}
            />
            <ConfirmButton
              label="Удалить рассылку"
              confirmText="Удалить эту рассылку?"
              onConfirm={() => handleDelete(editing.id)}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
