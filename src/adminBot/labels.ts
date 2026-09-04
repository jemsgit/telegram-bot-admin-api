/** Иконки и подписи доменных перечислений для admin-меню. */

const SHOW_FOR: Record<string, { icon: string; text: string }> = {
  image: { icon: "🖼", text: "Изображения" },
  video: { icon: "🎬", text: "Видео" },
  audio: { icon: "🎵", text: "Аудио" },
  text: { icon: "📝", text: "Текст" },
  any: { icon: "🌐", text: "Любой" },
};

export const showForIcon = (type: string): string =>
  SHOW_FOR[type]?.icon ?? "❓";
export const showForText = (type: string): string =>
  SHOW_FOR[type]?.text ?? "Неизвестно";

const BROADCAST_STATUS: Record<string, { icon: string; text: string }> = {
  pending: { icon: "⏳", text: "Ожидает" },
  progress: { icon: "🔄", text: "В процессе" },
  done: { icon: "✅", text: "Завершено" },
  cancelled: { icon: "❌", text: "Отменено" },
};

export const broadcastStatusIcon = (status: string): string =>
  BROADCAST_STATUS[status]?.icon ?? "❓";
export const broadcastStatusText = (status: string): string =>
  BROADCAST_STATUS[status]?.text ?? "Неизвестно";

const BROADCAST_TYPE: Record<string, string> = {
  text: "📝",
  photo: "🖼",
  video: "🎬",
};

export const broadcastTypeIcon = (type: string): string =>
  BROADCAST_TYPE[type] ?? "❓";
