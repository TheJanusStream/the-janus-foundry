<script lang="ts">
    import { slide } from "svelte/transition";
    import { theme } from "$lib/store";
    let isExpanded = false;
</script>

<div class="legend-panel">
    <button class="header" on:click={() => (isExpanded = !isExpanded)}>
        <span>LEGEND</span>
        <span class="toggle-icon">{isExpanded ? "−" : "[+]"}</span>
    </button>
    {#if isExpanded}
        <div class="content" transition:slide={{ duration: 200 }}>
            <div class="section">
                <h4>Nodes</h4>
                <ul>
                    <!-- Iterate over $theme.nodes -->
                    {#each Object.entries($theme.nodes) as [name, color]}
                        <li>
                            <span
                                class="color-swatch"
                                style="background-color: {color};"
                            ></span>
                            {name}
                        </li>
                    {/each}
                </ul>
            </div>
            <div class="section">
                <h4>Relationships</h4>
                <ul>
                    <!-- Iterate over $theme.relationships -->
                    {#each Object.entries($theme.relationships) as [name, color]}
                        <li>
                            <span
                                class="color-swatch link-swatch"
                                style="background-color: {color};"
                            ></span>
                            {name.replace(/_/g, " ")}
                        </li>
                    {/each}
                </ul>
            </div>
        </div>
    {/if}
</div>

<style>
    .legend-panel {
        background-color: rgba(13, 17, 23, 0.7);
        border-bottom: 1px solid #30363d;
        flex-shrink: 0;
        max-height: 40%;
        display: flex;
        flex-direction: column;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        cursor: pointer;
        background: none;
        border: none;
        color: #e6edf3;
        width: 100%;
    }
    .header span {
        color: #39c5cf;
        opacity: 0.7;
        letter-spacing: 2px;
        font-size: 0.8em;
    }
    .header .toggle-icon {
        font-family: monospace;
        font-size: 1.2em;
    }
    .content {
        overflow-y: auto;
        padding: 0 15px 15px 15px;
    }
    .section {
        margin-bottom: 10px;
    }
    h4 {
        font-size: 0.9em;
        margin: 10px 0 5px 0;
        opacity: 0.8;
        border-bottom: 1px solid #21262d;
        padding-bottom: 5px;
    }
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: 0.8em;
    }
    li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
    }
    .color-swatch {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.2);
        flex-shrink: 0;
    }
    .link-swatch {
        border-radius: 0;
        height: 3px;
    }
</style>
