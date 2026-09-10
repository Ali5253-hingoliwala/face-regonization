export type NotificationKind = "live" | "scheduled" | "attendance" | "system";

export type NotificationPayload = {
  id?: string;
  title: string;
  text: string;
  kind: NotificationKind;
  createdAt?: number | null;
};

export const NOTIFICATION_EVENT = "va:notification";
export const NOTIFICATION_STORAGE_KEY = "va_notifications";

export function emitNotification(notification: NotificationPayload) {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: notification }));
}
