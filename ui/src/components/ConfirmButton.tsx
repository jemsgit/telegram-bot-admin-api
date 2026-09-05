import { useState } from "react";
import { Alert, Button, Group, Modal, Text } from "@mantine/core";
import { ApiError } from "../api/client";

export interface ConfirmButtonProps {
  label: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
  onSuccess?: () => void;
}

/** kind: "action" без полей — кнопка с подтверждающим диалогом (RouteUi.confirm). */
export function ConfirmButton({
  label,
  confirmText,
  onConfirm,
  onSuccess,
}: ConfirmButtonProps) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      setOpened(false);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось выполнить");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button color="red" variant="light" onClick={() => setOpened(true)}>
        {label}
      </Button>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Подтверждение"
      >
        <Text>{confirmText ?? "Вы уверены?"}</Text>
        {error && (
          <Alert color="red" variant="light" mt="sm">
            {error}
          </Alert>
        )}
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={() => setOpened(false)}>
            Отмена
          </Button>
          <Button color="red" loading={loading} onClick={handleConfirm}>
            Подтвердить
          </Button>
        </Group>
      </Modal>
    </>
  );
}
