<script lang="ts">
    import { flatNodeMap, crossref, selectedNode } from "$lib/store";

    let isMinimized = true;
    function toggleMinimize() {
        isMinimized = !isMinimized;
    }

    // --- DERIVED STATISTICS ---

    // Simple counts
    $: totalNodes = $flatNodeMap.size;
    $: totalLinks = Object.values($crossref).flat().length;

    // Calculated metrics
    $: linkDensity =
        totalNodes > 0 ? (totalLinks / totalNodes).toFixed(2) : "0.00";

    // More complex graph analysis
    $: graphAnalysis = (() => {
        if ($flatNodeMap.size === 0) {
            return { knowledgeClusters: 0, orphanNodes: 0 };
        }

        const allNodeIds = new Set($flatNodeMap.keys());
        const adjacencyList = new Map<string, Set<string>>();

        // Build adjacency list for an undirected graph
        for (const sourceId in $crossref) {
            if (!adjacencyList.has(sourceId))
                adjacencyList.set(sourceId, new Set());
            for (const link of $crossref[sourceId]) {
                if (!adjacencyList.has(link.target_id))
                    adjacencyList.set(link.target_id, new Set());
                adjacencyList.get(sourceId)!.add(link.target_id);
                adjacencyList.get(link.target_id)!.add(sourceId);
            }
        }

        // Count Orphan Nodes (nodes with no connections)
        const orphanNodes = Array.from(allNodeIds).filter(
            (id) => !adjacencyList.has(id),
        ).length;

        // Count Knowledge Clusters (connected components)
        let knowledgeClusters = orphanNodes; // Each orphan is its own cluster
        const visited = new Set<string>();

        for (const nodeId of adjacencyList.keys()) {
            if (!visited.has(nodeId)) {
                knowledgeClusters++;
                const stack = [nodeId];
                visited.add(nodeId);
                while (stack.length > 0) {
                    const currentNode = stack.pop()!;
                    const neighbors =
                        adjacencyList.get(currentNode) || new Set();
                    for (const neighbor of neighbors) {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            stack.push(neighbor);
                        }
                    }
                }
            }
        }

        return { knowledgeClusters, orphanNodes };
    })();
</script>

<div class="stats-panel">
    <button class="title" on:click={toggleMinimize} title="Toggle Vital Signs">
        <span>VITAL SIGNS</span>
        <span class="toggle-icon">{isMinimized ? "[+]" : "−"}</span>
    </button>
    {#if !isMinimized}
        <div class="panel-content">
            <div class="stats-grid">
                <div class="stat-label">Concepts</div>
                <div class="stat-value">{totalNodes}</div>

                <div class="stat-label">Connections</div>
                <div class="stat-value">{totalLinks}</div>

                <div class="stat-label">Integration</div>
                <div class="stat-value">{linkDensity} links/concept</div>

                <div class="stat-label">Islands of Thought</div>
                <div class="stat-value">{graphAnalysis.knowledgeClusters}</div>

                <div class="stat-label">Isolated Ideas</div>
                <div class="stat-value">{graphAnalysis.orphanNodes}</div>
            </div>

            {#if $selectedNode}
                <div class="selected-info">
                    <div class="stat-label">Selected Node</div>
                    <div class="uuid-container">
                        <span class="stat-value uuid">{$selectedNode.id}</span>
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .stats-panel {
        border: 1px solid #30363d;
        border-radius: 6px;
        margin-top: 20px;
        padding: 10px 15px;
        background-color: rgba(13, 17, 23, 0.7);
        font-size: 0.9em;
    }
    .title {
        color: #39c5cf;
        opacity: 0.7;
        letter-spacing: 2px;
        font-size: 0.8em;
        margin: 0 0 10px 0;
        text-align: center;
    }

    .toggle-icon {
        font-family: monospace;
        font-size: 1.2em;
    }

    /* When minimized, remove the bottom margin from the title */
    :global(.stats-panel button.title:only-child) {
        margin-bottom: 0;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 8px;
    }
    .stat-label {
        opacity: 0.7;
    }
    .stat-value {
        text-align: right;
        font-weight: bold;
    }
    .selected-info {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid #30363d;
    }
    .uuid-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 5px;
    }
    .uuid {
        color: #39c5cf;
        font-family: monospace;
        font-size: 0.9em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    button {
        background: #161b22;
        color: #8b949e;
        border: 1px solid #30363d;
        border-radius: 4px;
        padding: 2px 6px;
        cursor: pointer;
        margin-left: 10px;
    }
    button:hover {
        border-color: #39c5cf;
    }
</style>
