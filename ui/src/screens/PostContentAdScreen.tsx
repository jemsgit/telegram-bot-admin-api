import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Drawer, Group, Loader, Title } from "@mantine/core";
import { useApiClient } from "../api/context";
import { ApiError } from "../api/client";
import { AutoTable } from "../components/AutoTable";
import { AutoForm } from "../components/AutoForm";
import { ConfirmButton } from "../components/ConfirmButton";
import { serializeFormValues } from "../components/routeRequest";
import type { FieldSchema } from "../types";

interface PostContentAd {
  _id: string;
  text: string;
  isActive: boolean;
  maxViews: number | null;
  views: number;
  priority: number;
  perUserLimit: number;
  startsAt: string | null;
  endsAt: string | null;
}

// showFor (массив enum) в форме не редактируется — FieldSchema не поддерживает
// multi-select-поля (см. ui-schema.ts); бэкенд принимает частичный body без
// валидации, так что бот может донастроить объявление своим кастомным роутом,
// если это понадобится.
const AD_FIELDS: FieldSchema[] = [
  { name: "text", label: "Текст", type: "textarea", required: true },
  { name: "isActive", label: "Активно", type: "boolean" },
  { name: "priority", label: "Приоритет", type: "number" },
  { name: "maxViews", label: "Макс. показов (пусто — без лимита)", type: "number" },
  { name: "perUserLimit", label: "Лимит на пользователя", type: "number" },
  { name: "startsAt", label: "Старт показа", type: "datetime" },
  { name: "endsAt", label: "Конец показа", type: "datetime" },
];

export function PostContentAdScreen() {
  const client = useApiClient();
  const [data, setData] = useState<PostContentAd[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PostContentAd | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await client.get<PostContentAd[]>("/api/ads"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(values: Record<string, unknown>) {
    await client.post("/api/ads", serializeFormValues(AD_FIELDS, values));
    await load();
  }

  async function handleUpdate(values: Record<string, unknown>) {
    if (!editing) return;
    await client.patch(`/api/ads/${editing._id}`, serializeFormValues(AD_FIELDS, values));
    await load();
  }

  async function handleDelete(id: string) {
    await client.delete(`/api/ads/${id}`);
    setEditing(null);
    await load();
  }

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={4}>📈 Реклама</Title>
        <Button onClick={() => setCreateOpen(true)}>Создать</Button>
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
          data={(data ?? []) as unknown as Record<string, unknown>[]}
          columns={["_id", "text", "isActive", "priority", "views", "maxViews", "perUserLimit"]}
          onRowClick={(row) => setEditing(row as unknown as PostContentAd)}
        />
      )}

      <Drawer opened={createOpen} onClose={() => setCreateOpen(false)} title="Новое объявление" position="right">
        <AutoForm
          fields={AD_FIELDS}
          submitLabel="Создать"
          initialValues={{ isActive: true }}
          onSubmit={handleCreate}
          onSuccess={() => setCreateOpen(false)}
        />
      </Drawer>

      <Drawer opened={!!editing} onClose={() => setEditing(null)} title="Объявление" position="right">
        {editing && (
          <>
            <AutoForm
              key={editing._id}
              fields={AD_FIELDS}
              submitLabel="Сохранить"
              initialValues={{
                ...editing,
                startsAt: editing.startsAt ? new Date(editing.startsAt) : null,
                endsAt: editing.endsAt ? new Date(editing.endsAt) : null,
              }}
              onSubmit={handleUpdate}
              onSuccess={() => setEditing(null)}
            />
            <ConfirmButton
              label="Удалить объявление"
              confirmText="Удалить это объявление?"
              onConfirm={() => handleDelete(editing._id)}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
