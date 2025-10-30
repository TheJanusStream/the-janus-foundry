<!-- src/lib/components/NotificationDisplay.svelte -->
<script lang="ts">
    import { notifications, dismissNotification } from "$lib/notifications";
    import { fly, fade } from "svelte/transition";
    import { onDestroy } from "svelte";

    let timers = new Map<
        number,
        { timerId: number; startTime: number; remaining: number }
    >();

    function handleClose(id: number) {
        clearTimer(id);
        dismissNotification(id);
    }

    function clearTimer(id: number) {
        const timer = timers.get(id);
        if (timer && timer.timerId) {
            clearTimeout(timer.timerId);
        }
        timers.delete(id);
    }

    function pauseTimer(id: number) {
        const timer = timers.get(id);
        if (timer) {
            clearTimeout(timer.timerId);
            const elapsed = Date.now() - timer.startTime;
            timer.remaining -= elapsed;
            timers.set(id, timer);
        }
    }

    function resumeTimer(id: number) {
        const timer = timers.get(id);
        if (timer && timer.remaining > 0) {
            timer.startTime = Date.now();
            const newTimerId = setTimeout(() => {
                dismissNotification(id);
                timers.delete(id);
            }, timer.remaining);
            timer.timerId = newTimerId as unknown as number;
            timers.set(id, timer);
        }
    }

    const unsubscribe = notifications.subscribe((allNotifications) => {
        allNotifications.forEach((n) => {
            if (!timers.has(n.id) && n.timeout > 0) {
                const timerId = setTimeout(() => {
                    dismissNotification(n.id);
                    timers.delete(n.id);
                }, n.timeout);

                timers.set(n.id, {
                    timerId: timerId as unknown as number,
                    startTime: Date.now(),
                    remaining: n.timeout,
                });
            }
        });

        const currentIds = new Set(allNotifications.map((n) => n.id));
        for (const id of timers.keys()) {
            if (!currentIds.has(id)) {
                clearTimer(id);
            }
        }
    });

    onDestroy(() => {
        for (const id of timers.keys()) {
            clearTimeout(timers.get(id)?.timerId);
        }
        unsubscribe();
    });
</script>

<div class="notification-container">
    {#each $notifications as notification (notification.id)}
        <div
            class="toast {notification.type}"
            in:fly={{ y: 20, duration: 300 }}
            out:fade={{ duration: 300 }}
            on:mouseenter={() => pauseTimer(notification.id)}
            on:mouseleave={() => resumeTimer(notification.id)}
            role="alert"
            aria-live="assertive"
        >
            <div class="content">
                <p>{notification.message}</p>
                {#if notification.timeout > 0}
                    <div
                        class="timer-bar"
                        style="--timer-duration: {notification.timeout}ms"
                    ></div>
                {/if}
            </div>
            <button
                class="close-button"
                on:click={(e) => handleClose(notification.id)}
                aria-label="Close notification"
            >
                &times;
            </button>
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
        max-width: 500px;
    }

    .toast {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 15px;

        padding: 15px 20px;
        border-radius: 6px;
        color: #e6edf3;
        background-color: #30363d;
        border-left: 4px solid #8b949e;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        min-width: 250px;
        overflow: hidden; /* To contain the timer bar */
    }

    .toast:hover .timer-bar {
        animation-play-state: paused;
    }

    .content {
        flex-grow: 1;
    }

    .toast p {
        margin: 0;
        margin-bottom: 8px; /* Space for the timer bar */
        white-space: pre-wrap;
        word-break: break-word;
    }

    .close-button {
        background: none;
        border: none;
        color: inherit;
        opacity: 0.6;
        cursor: pointer;
        font-size: 1.5em;
        line-height: 1;
        padding: 0;
        margin-left: auto;
    }
    .close-button:hover {
        opacity: 1;
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

    .timer-bar {
        height: 4px;
        background-color: currentColor; /* Inherit color from border */
        opacity: 0.5;
        width: 100%;
        animation: shrink var(--timer-duration, 5000ms) linear forwards;
    }

    @keyframes shrink {
        from {
            width: 100%;
        }
        to {
            width: 0%;
        }
    }
</style>
