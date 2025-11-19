<script lang="ts">
    import {
        isSearchOpen,
        flatNodeMap,
        selectedNode,
        type TreeNode,
    } from "$lib/store";
    import { onMount, tick } from "svelte";
    import { fade } from "svelte/transition";

    let query = "";
    let inputElement: HTMLInputElement;
    let results: TreeNode[] = [];
    let selectedIndex = 0;
    let resultContainer: HTMLDivElement;

    // Search Logic
    $: {
        if (query.trim() === "") {
            results = [];
        } else {
            const q = query.toLowerCase();
            const allNodes = Array.from($flatNodeMap.values());

            // Filter and Rank
            results = allNodes
                .filter(
                    (n) =>
                        n.name.toLowerCase().includes(q) ||
                        n.type.toLowerCase().includes(q) ||
                        (n.description &&
                            n.description.toLowerCase().includes(q)),
                )
                .sort((a, b) => {
                    // Simple ranking heuristic
                    const nameA = a.name.toLowerCase();
                    const nameB = b.name.toLowerCase();

                    // 1. Exact name match
                    if (nameA === q && nameB !== q) return -1;
                    if (nameB === q && nameA !== q) return 1;

                    // 2. Starts with query
                    if (nameA.startsWith(q) && !nameB.startsWith(q)) return -1;
                    if (nameB.startsWith(q) && !nameA.startsWith(q)) return 1;

                    // 3. Match in Name vs Match in Description
                    const aInName = nameA.includes(q);
                    const bInName = nameB.includes(q);
                    if (aInName && !bInName) return -1;
                    if (bInName && !aInName) return 1;

                    return 0;
                })
                .slice(0, 50); // Limit results for performance
        }
        selectedIndex = 0; // Reset selection on new query
    }

    function close() {
        isSearchOpen.set(false);
        query = "";
    }

    function selectResult(index: number) {
        if (results[index]) {
            selectedNode.set(results[index]);
            close();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % results.length;
            scrollToSelected();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIndex =
                (selectedIndex - 1 + results.length) % results.length;
            scrollToSelected();
        } else if (e.key === "Enter") {
            e.preventDefault();
            selectResult(selectedIndex);
        } else if (e.key === "Escape") {
            close();
        }
    }

    async function scrollToSelected() {
        await tick();
        const selectedEl = resultContainer?.querySelector(".selected");
        selectedEl?.scrollIntoView({ block: "nearest" });
    }

    onMount(() => {
        inputElement?.focus();
    });
</script>

<div class="overlay" on:click={close} transition:fade={{ duration: 100 }}>
    <div class="modal" on:click|stopPropagation>
        <div class="input-wrapper">
            <span class="search-icon">🔍</span>
            <input
                bind:this={inputElement}
                bind:value={query}
                on:keydown={handleKeydown}
                placeholder="Search nodes..."
                type="text"
            />
        </div>

        {#if results.length > 0}
            <div class="results" bind:this={resultContainer}>
                {#each results as node, i}
                    <div
                        class="result-item"
                        class:selected={i === selectedIndex}
                        on:click={() => selectResult(i)}
                        on:mouseenter={() => (selectedIndex = i)}
                    >
                        <div class="result-main">
                            <span class="node-name">{node.name}</span>
                            <span class="node-type">{node.type}</span>
                        </div>
                        {#if !node.name
                            .toLowerCase()
                            .includes(query.toLowerCase())}
                            <div class="result-context">
                                ...match in description...
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else if query}
            <div class="no-results">No matches found.</div>
        {/if}

        <div class="footer">
            <span>⇅ to navigate</span>
            <span>↵ to select</span>
            <span>esc to close</span>
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
        background: rgba(0, 0, 0, 0.6);
        z-index: 2000;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 100px;
        backdrop-filter: blur(2px);
    }

    .modal {
        width: 600px;
        max-width: 90%;
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 8px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .input-wrapper {
        display: flex;
        align-items: center;
        padding: 15px;
        border-bottom: 1px solid #30363d;
    }

    .search-icon {
        font-size: 1.2em;
        margin-right: 10px;
        opacity: 0.6;
    }

    input {
        background: transparent;
        border: none;
        color: #e6edf3;
        font-size: 1.2em;
        width: 100%;
        outline: none;
    }

    .results {
        max-height: 400px;
        overflow-y: auto;
    }

    .result-item {
        padding: 10px 15px;
        border-bottom: 1px solid #21262d;
        cursor: pointer;
    }

    .result-item.selected {
        background-color: #39c5cf;
        color: #0d1117;
    }

    .result-main {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
    }

    .node-name {
        font-weight: bold;
    }

    .node-type {
        font-size: 0.8em;
        opacity: 0.7;
        font-style: italic;
    }

    .result-item.selected .node-type {
        opacity: 0.8;
        color: #0d1117;
    }

    .result-context {
        font-size: 0.8em;
        opacity: 0.5;
        margin-top: 2px;
    }

    .no-results {
        padding: 20px;
        text-align: center;
        opacity: 0.5;
        font-style: italic;
    }

    .footer {
        display: flex;
        justify-content: flex-end;
        gap: 15px;
        padding: 8px 15px;
        background: #0d1117;
        border-top: 1px solid #30363d;
        font-size: 0.75em;
        color: #8b949e;
    }
</style>
