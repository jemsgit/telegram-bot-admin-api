import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { createApiClient } from "../api/client";
import { ApiClientProvider } from "../api/context";

/**
 * Экран логина standalone-UI. Режим (`GET /ui/config`):
 * - `"token"` — одно поле, вход по `http.token`;
 * - `"password"` — логин + пароль (`http.ui.auth`), сравниваются оба поля
 *   на сервере (constant-time, с троттлингом неудачных попыток).
 *
 * В обоих случаях `POST /ui/login` при успехе возвращает `http.token`, дальше
 * запросы к `/api/*` идут с ним (`Authorization: Bearer`). Токен живёт только
 * в памяти компонента (React state) — НЕ в localStorage/sessionStorage; при
 * F5 логиниться заново. Осознанный trade-off, см.
 * docs/CENTRAL_PANEL_GATEWAY.md "Авторизация операторов".
 */
export function TokenGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"token" | "password" | null>(null);
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState(""); // токен или пароль
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/ui/config")
      .then((r) => (r.ok ? r.json() : { loginMode: "token" }))
      .then((c) => setMode(c.loginMode === "password" ? "password" : "token"))
      .catch(() => setMode("token"));
  }, []);

  if (token) {
    const client = createApiClient({ getToken: () => token });
    return <ApiClientProvider value={client}>{children}</ApiClientProvider>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body =
      mode === "password"
        ? { username: username.trim(), password: secret }
        : { token: secret.trim() };
    if (mode === "password" ? !username.trim() || !secret : !secret.trim()) return;

    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/ui/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && typeof payload.token === "string") {
        setToken(payload.token);
        return;
      }
      if (res.status === 429) {
        setError(
          `Слишком много попыток входа. Подождите ${payload.retryAfter ?? "несколько"} сек.`,
        );
      } else if (res.status === 401) {
        setError(mode === "password" ? "Неверный логин или пароль" : "Неверный токен");
      } else {
        setError("Не удалось связаться с сервером");
      }
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setChecking(false);
    }
  }

  if (!mode) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Center mih="100vh">
      <Paper withBorder shadow="sm" p="xl" radius="md" w={360}>
        <form onSubmit={handleSubmit}>
          <Stack>
            <Title order={3}>Админка</Title>
            {mode === "password" ? (
              <>
                <TextInput
                  label="Логин"
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                  autoFocus
                  data-autofocus
                />
                <PasswordInput
                  label="Пароль"
                  value={secret}
                  onChange={(e) => setSecret(e.currentTarget.value)}
                />
              </>
            ) : (
              <>
                <Text size="sm" c="dimmed">
                  Введите ADMIN_API_TOKEN этого бота
                </Text>
                <PasswordInput
                  placeholder="Токен"
                  value={secret}
                  onChange={(e) => setSecret(e.currentTarget.value)}
                  autoFocus
                  data-autofocus
                />
              </>
            )}
            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}
            <Button
              type="submit"
              loading={checking}
              disabled={mode === "password" ? !username.trim() || !secret : !secret.trim()}
            >
              Войти
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
