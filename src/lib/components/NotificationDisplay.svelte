<!-- src/lib/components/NotificationDisplay.svelte -->
<script lang="ts">
    import { notifications, dismissNotification } from "$lib/notifications";
    import { fly, fade } from "svelte/transition";
</script>

<div class="notification-container">
    {#each $notifications as notification (notification.id)}
        <div
            class="toast {notification.type}"
            in:fly={{ y: 20, duration: 300 }}
            out:fade={{ duration: 300 }}
            on:click={() => dismissNotification(notification.id)}
        >
            <p>{notification.message}</p>
        </div>
    {/each}
</div>

<style>
    .notification-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 1000;
    }

    .toast {
        padding: 10px 20px;
        border-radius: 6px;
        color: #e6edf3;
        background-color: #30363d;
        border-left: 4px solid #8b949e;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        min-width: 250px;
    }

    .toast p {
        margin: 0;
    }

    .toast.success {
        background-color: #20332b;
        border-left-color: #39d393;
    }

    .toast.error {
        background-color: #382226;
        border-left-color: #f85149;
    }

    .toast.info {
        background-color: #1e3a4c;
        border-left-color: #39c5cf;
    }
</style>
