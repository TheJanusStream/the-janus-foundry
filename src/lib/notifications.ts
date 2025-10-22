// src/lib/notifications.ts
import { writable } from 'svelte/store';

type NotificationType = 'info' | 'success' | 'error';

export interface Notification {
    id: number;
    type: NotificationType;
    message: string;
    timeout: number;
}

export const notifications = writable<Notification[]>([]);

export function notify(message: string, type: NotificationType = 'info', timeout: number = 3000) {
    const id = Date.now();
    notifications.update((all) => [{ id, type, message, timeout }, ...all]);

    setTimeout(() => {
        dismissNotification(id);
    }, timeout);
}

export function dismissNotification(id: number) {
    notifications.update((all) => all.filter((n) => n.id !== id));
}