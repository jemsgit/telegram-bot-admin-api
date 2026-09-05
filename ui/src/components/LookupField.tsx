import { useEffect, useState } from "react";
import { Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useApiClient } from "../api/context";
import type { FieldLookup } from "../types";

interface LookupFieldProps {
  lookup: FieldLookup;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

/** Асинхронный поиск по существующему GET-роуту (`field.lookup.route`), напр. /api/users. */
export function LookupField({
  lookup,
  label,
  placeholder,
  required,
  error,
  value,
  onChange,
}: LookupFieldProps) {
  const client = useApiClient();
  const searchParam = lookup.searchParam ?? "query";
  const valueField = lookup.valueField ?? "id";
  const labelField = lookup.labelField ?? "name";

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [options, setOptions] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = debouncedSearch
      ? `?${searchParam}=${encodeURIComponent(debouncedSearch)}`
      : "";
    client
      .get<unknown>(`${lookup.route}${qs}`)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : [];
        setOptions(
          list.map((item) => {
            const record = item as Record<string, unknown>;
            return {
              value: String(record[valueField]),
              label: String(record[labelField] ?? record[valueField]),
            };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, lookup.route]);

  return (
    <Select
      label={label}
      placeholder={placeholder ?? "Начните вводить для поиска"}
      required={required}
      error={error}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      data={options}
      value={value}
      onChange={onChange}
      nothingFoundMessage={loading ? "Поиск…" : "Ничего не найдено"}
      clearable
    />
  );
}
