import { useEffect, useState } from "react";
import { Alert, Group, Loader, Paper, SimpleGrid, Text, Title } from "@mantine/core";
import { useApiClient } from "../api/context";
import { ApiError } from "../api/client";
import { AutoTable } from "../components/AutoTable";

interface PaymentStatsBucket {
  totalAmount: number;
  totalIncomeAmount: number;
  count: number;
}

interface PaymentStats {
  currentMonth: PaymentStatsBucket;
  lastMonth: PaymentStatsBucket;
}

interface Payment {
  chatId: string;
  username: string;
  chargeId: string;
  amount: number;
  incomeAmount: number;
  currency: string;
  date: string;
}

function StatCard({ title, bucket }: { title: string; bucket: PaymentStatsBucket }) {
  return (
    <Paper withBorder p="md">
      <Text size="sm" c="dimmed">
        {title}
      </Text>
      <Text size="xl" fw={700}>
        {bucket.totalAmount} ({bucket.count} шт.)
      </Text>
      <Text size="sm" c="dimmed">
        Доход: {bucket.totalIncomeAmount}
      </Text>
    </Paper>
  );
}

/** Только чтение — HTTP API платежей не предоставляет мутирующих операций. */
export function PaymentsScreen() {
  const client = useApiClient();
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      client.get<PaymentStats>("/api/payments/stats"),
      client.get<Payment[]>("/api/payments"),
    ])
      .then(([s, p]) => {
        setStats(s);
        setPayments(p);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить"));
  }, [client]);

  return (
    <div>
      <Title order={4} mb="md">
        💰 Платежи
      </Title>
      {error && (
        <Alert color="red" variant="light" mb="md">
          {error}
        </Alert>
      )}
      {!stats || !payments ? (
        <Loader size="sm" />
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }} mb="lg">
            <StatCard title="Текущий месяц" bucket={stats.currentMonth} />
            <StatCard title="Прошлый месяц" bucket={stats.lastMonth} />
          </SimpleGrid>
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Все платежи</Text>
          </Group>
          <AutoTable
            data={payments as unknown as Record<string, unknown>[]}
            columns={["chatId", "username", "chargeId", "amount", "incomeAmount", "currency", "date"]}
          />
        </>
      )}
    </div>
  );
}
