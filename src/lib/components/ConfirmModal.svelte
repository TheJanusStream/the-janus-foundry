<!-- src/lib/components/ConfirmModal.svelte -->
<script lang="ts">
    import { modalStore } from "$lib/modal";
    import { fade } from "svelte/transition";
    import { onMount, onDestroy } from "svelte";

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            modalStore.handleCancel();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });
</script>

<div
    class="overlay"
    transition:fade={{ duration: 150 }}
    on:click={modalStore.handleCancel}
>
    <div
        class="modal-box"
        transition:fade={{ duration: 150 }}
        on:click|stopPropagation
    >
        <p>{$modalStore.message}</p>
        <div class="buttons">
            <button class="cancel-button" on:click={modalStore.handleCancel}
                >Cancel</button
            >
            <button class="confirm-button" on:click={modalStore.handleConfirm}
                >Confirm Delete</button
            >
        </div>
    </div>
</div>

<style>
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    }
    .modal-box {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 25px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    p {
        margin: 0 0 20px 0;
        line-height: 1.5;
        white-space: pre-wrap;
    }
    .buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }
    button {
        border-radius: 6px;
        padding: 10px 15px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }
    .cancel-button {
        background-color: #30363d;
        color: #e6edf3;
        border: 1px solid #484f58;
    }
    .cancel-button:hover {
        background-color: #484f58;
    }
    .confirm-button {
        background-color: #da3633;
        color: #ffffff;
        border: 1px solid #f85149;
    }
    .confirm-button:hover {
        background-color: #f85149;
    }
</style>
