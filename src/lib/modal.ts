// src/lib/modal.ts
import { writable } from 'svelte/store';

interface ModalState {
    isOpen: boolean;
    message: string;
    resolve?: (value: boolean) => void;
}

const { subscribe, update } = writable<ModalState>({
    isOpen: false,
    message: '',
});

export const modalStore = {
    subscribe,
    confirm: (message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            update(() => ({
                isOpen: true,
                message,
                resolve,
            }));
        });
    },
    handleConfirm: () => {
        update(state => {
            state.resolve?.(true);
            return { isOpen: false, message: '' };
        });
    },
    handleCancel: () => {
        update(state => {
            state.resolve?.(false);
            return { isOpen: false, message: '' };
        });
    },
};