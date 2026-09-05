import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { FieldInput } from "./FieldInput";
import { ApiError } from "../api/client";
import type { FieldSchema } from "../types";

export interface AutoFormProps {
  fields: FieldSchema[];
  submitLabel?: string;
  /** Текст подтверждающего диалога перед сабмитом (RouteUi.confirm). Без него сабмит сразу. */
  confirmText?: string;
  /**
   * Значения для предзаполнения (редактирование существующей записи —
   * встроенные экраны Broadcasts/PostContentAd). Без неё — пустая форма.
   */
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
  onSuccess?: () => void;
}

function initialValueFor(field: FieldSchema, initialValues?: Record<string, unknown>): unknown {
  if (initialValues && field.name in initialValues) return initialValues[field.name];
  if (field.type === "boolean") return false;
  if (
    field.type === "date" ||
    field.type === "datetime" ||
    field.type === "select" ||
    field.type === "lookup"
  ) {
    return null;
  }
  return "";
}

function buildValidator(fields: FieldSchema[]) {
  return (values: Record<string, unknown>) => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const value = values[field.name];
      const empty = value === undefined || value === null || value === "";

      if (field.required && empty) {
        errors[field.name] = "Обязательное поле";
        continue;
      }
      if (empty) continue;

      const v = field.validation;
      if (!v) continue;
      if (typeof value === "number") {
        if (v.min !== undefined && value < v.min) errors[field.name] = `Минимум ${v.min}`;
        if (v.max !== undefined && value > v.max) errors[field.name] = `Максимум ${v.max}`;
      }
      if (typeof value === "string") {
        if (v.minLength !== undefined && value.length < v.minLength)
          errors[field.name] = `Минимум ${v.minLength} символов`;
        if (v.maxLength !== undefined && value.length > v.maxLength)
          errors[field.name] = `Максимум ${v.maxLength} символов`;
        if (v.pattern && !new RegExp(v.pattern).test(value))
          errors[field.name] = "Некорректный формат";
      }
    }
    return errors;
  };
}

/** Генерик-форма: FieldSchema[] → Mantine-инпуты + валидация + сабмит. */
export function AutoForm({
  fields,
  submitLabel = "Сохранить",
  confirmText,
  initialValues,
  onSubmit,
  onSuccess,
}: AutoFormProps) {
  const form = useForm<Record<string, unknown>>({
    initialValues: Object.fromEntries(
      fields.map((f) => [f.name, initialValueFor(f, initialValues)]),
    ),
    validate: buildValidator(fields),
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] =
    useState<Record<string, unknown> | null>(null);

  async function doSubmit(values: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  function handleValidatedSubmit(values: Record<string, unknown>) {
    if (confirmText) {
      setPendingValues(values);
      setConfirmOpen(true);
      return;
    }
    void doSubmit(values);
  }

  return (
    <>
      <form onSubmit={form.onSubmit(handleValidatedSubmit)}>
        <Stack>
          {fields.map((field) => (
            <FieldInput key={field.name} field={field} form={form} />
          ))}
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="submit" loading={submitting}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Подтверждение"
      >
        <Text>{confirmText}</Text>
        {error && (
          <Alert color="red" variant="light" mt="sm">
            {error}
          </Alert>
        )}
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={() => setConfirmOpen(false)}>
            Отмена
          </Button>
          <Button
            color="red"
            loading={submitting}
            onClick={() => pendingValues && doSubmit(pendingValues)}
          >
            Подтвердить
          </Button>
        </Group>
      </Modal>
    </>
  );
}
