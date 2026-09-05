import {
  Checkbox,
  NumberInput,
  Select,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DatePickerInput, DateTimePicker } from "@mantine/dates";
import type { UseFormReturnType } from "@mantine/form";
import { LookupField } from "./LookupField";
import type { FieldSchema } from "../types";

interface FieldInputProps {
  field: FieldSchema;
  form: UseFormReturnType<Record<string, unknown>>;
}

/** Один инпут формы — маппинг FieldType → Mantine-компонент. */
export function FieldInput({ field, form }: FieldInputProps) {
  const label = field.label ?? field.name;
  const common = form.getInputProps(field.name);

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          {...common}
          label={label}
          placeholder={field.placeholder}
          required={field.required}
          autosize
          minRows={3}
        />
      );

    case "number":
      return (
        <NumberInput
          {...common}
          label={label}
          placeholder={field.placeholder}
          required={field.required}
          min={field.validation?.min}
          max={field.validation?.max}
        />
      );

    case "boolean":
      return (
        <Checkbox
          {...form.getInputProps(field.name, { type: "checkbox" })}
          label={label}
        />
      );

    case "date":
      return (
        <DatePickerInput
          label={label}
          placeholder={field.placeholder}
          required={field.required}
          value={(common.value as Date | null) ?? null}
          onChange={(v) => form.setFieldValue(field.name, v)}
          error={common.error}
        />
      );

    case "datetime":
      return (
        <DateTimePicker
          label={label}
          placeholder={field.placeholder}
          required={field.required}
          value={(common.value as Date | null) ?? null}
          onChange={(v) => form.setFieldValue(field.name, v)}
          error={common.error}
        />
      );

    case "select":
      return (
        <Select
          label={label}
          placeholder={field.placeholder}
          required={field.required}
          data={(field.options ?? []).map((o) => ({
            value: String(o.value),
            label: o.label,
          }))}
          value={(common.value as string | null) ?? null}
          onChange={(v) => form.setFieldValue(field.name, v)}
          error={common.error}
        />
      );

    case "lookup":
      if (!field.lookup) return null;
      return (
        <LookupField
          lookup={field.lookup}
          label={label}
          placeholder={field.placeholder}
          required={field.required}
          value={(common.value as string | null) ?? null}
          onChange={(v) => form.setFieldValue(field.name, v)}
          error={common.error}
        />
      );

    default:
      return (
        <TextInput
          {...common}
          label={label}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
  }
}
