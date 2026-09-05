import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, Loader, TextInput, Title } from "@mantine/core";
import { useApiClient } from "../api/context";
import { ApiError } from "../api/client";
import { AutoTable } from "../components/AutoTable";

interface RefferalCount {
  refLink: string;
  count: number;
}

/** GET /api/referrals — без `query` отдаёт все ссылки, с `query` — счётчик по одной. */
export function ReferralScreen() {
  const client = useApiClient();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<RefferalCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        const path = q ? `/api/referrals?query=${encodeURIComponent(q)}` : "/api/referrals";
        const res = await client.get<RefferalCount[] | RefferalCount | number>(path);
        if (Array.isArray(res)) setData(res);
        else if (typeof res === "number") setData([{ refLink: q, count: res }]);
        else if (res) setData([res]);
        else setData([]);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Не удалось загрузить");
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <div>
      <Title order={4} mb="md">
        🔗 Рефералы
      </Title>
      <Group mb="md">
        <TextInput
          placeholder="Ссылка (оставьте пустым — все)"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button onClick={() => void load(query)} loading={loading}>
          Найти
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
        <AutoTable data={(data ?? []) as unknown as Record<string, unknown>[]} columns={["refLink", "count"]} />
      )}
    </div>
  );
}
