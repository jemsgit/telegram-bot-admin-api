import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Drawer, Group, Loader, Title } from "@mantine/core";
import { useApiClient } from "../api/context";
import { ApiError } from "../api/client";
import { AutoTable } from "../components/AutoTable";
import { AutoForm } from "../components/AutoForm";
import { ConfirmButton } from "../components/ConfirmButton";
import { serializeFormValues } from "../components/routeRequest";
import type { FieldSchema } from "../types";

interface Promo {
  code: string;
  description?: string;
  discountPercent: number;
  price?: number;
  activeFrom: string;
  activeTo: string;
  isActive: boolean;
  segments: string[];
}

const CREATE_FIELDS: FieldSchema[] = [
  { name: "code", label: "Код", type: "text", required: true },
  { name: "description", label: "Описание", type: "textarea" },
  {
    name: "discountPercent",
    label: "Скидка, %",
    type: "number",
    required: true,
    validation: { min: 0, max: 100 },
  },
  { name: "price", label: "Цена", type: "number" },
  { name: "activeFrom", label: "Действует с", type: "date", required: true },
  { name: "activeTo", label: "Действует по", type: "date", required: true },
  { name: "isActive", label: "Активен", type: "boolean" },
];

export function PromocodesScreen() {
  const client = useApiClient();
  const [data, setData] = useState<Promo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await client.get<Promo[]>("/api/promocodes"));
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
    await client.post("/api/promocodes", serializeFormValues(CREATE_FIELDS, values));
    await load();
  }

  async function handleDelete(code: string) {
    await client.delete(`/api/promocodes/${encodeURIComponent(code)}`);
    await load();
  }

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={4}>🎁 Промокоды</Title>
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
          columns={["code", "description", "discountPercent", "price", "activeFrom", "activeTo", "isActive"]}
          rowActions={(row) => (
            <ConfirmButton
              label="Удалить"
              confirmText={`Удалить промокод ${row.code}?`}
              onConfirm={() => handleDelete(String(row.code))}
            />
          )}
        />
      )}

      <Drawer opened={createOpen} onClose={() => setCreateOpen(false)} title="Новый промокод" position="right">
        <AutoForm
          fields={CREATE_FIELDS}
          submitLabel="Создать"
          initialValues={{ isActive: true }}
          onSubmit={handleCreate}
          onSuccess={() => setCreateOpen(false)}
        />
      </Drawer>
    </div>
  );
}
