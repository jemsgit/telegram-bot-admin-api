import type { ReactNode } from "react";
import { Table, Text } from "@mantine/core";

export interface AutoTableProps {
  data: Record<string, unknown>[];
  /** Если не задано — берутся все примитивные top-level поля первой строки. */
  columns?: string[];
  /** Клик по строке (встроенные экраны — открыть деталь/форму редактирования). */
  onRowClick?: (row: Record<string, unknown>) => void;
  /** Доп. колонка справа с кнопками действий на строку (встроенные экраны). */
  rowActions?: (row: Record<string, unknown>) => ReactNode;
}

function inferColumns(data: Record<string, unknown>[]): string[] {
  const first = data[0];
  if (!first) return [];
  return Object.keys(first).filter((key) => {
    const value = first[key];
    return (
      value === null ||
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  });
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("ru");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Генерик-таблица: `kind: "list"` из `/api/config` (кастомные роуты бота), а
 * также встроенные экраны (`ui/src/screens/`) — там передаются `onRowClick` /
 * `rowActions`, которых кастомным роутам пока не нужно (см.
 * `CUSTOMIZABLE_ADMIN_UI.md`, v1).
 */
export function AutoTable({ data, columns, onRowClick, rowActions }: AutoTableProps) {
  const cols = columns?.length ? columns : inferColumns(data);

  if (!data.length) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        Пусто
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          {cols.map((c) => (
            <Table.Th key={c}>{c}</Table.Th>
          ))}
          {rowActions && <Table.Th />}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((row, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Table.Tr
            key={i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={onRowClick ? { cursor: "pointer" } : undefined}
          >
            {cols.map((c) => (
              <Table.Td key={c}>{formatCell(row[c])}</Table.Td>
            ))}
            {rowActions && (
              <Table.Td onClick={(e) => e.stopPropagation()}>{rowActions(row)}</Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
