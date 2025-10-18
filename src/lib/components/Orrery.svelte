<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import ForceGraph from "force-graph";
  import { tree, selectedNode, crossref, flatNodeMap } from "$lib/store";
  import type { TreeNode } from "$lib/store";
  import type { CrossRefIndex, CrossRefLink } from "$lib/io";

  let container: HTMLDivElement;
  let Graph: any = null;
  let initialLoad = true;

  let neighborhoodDistance = 1;

  let relatedNodes: (CrossRefLink & {
    name: string;
    type: string;
    direction: "out" | "in";
    sourceName: string;
  })[] = [];

  function findNodeInTree(nodes: TreeNode[], id: string): TreeNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNodeInTree(n.children, id);
      if (found) return found;
    }
    return null;
  }

  function handleSelectRelated(nodeId: string) {
    const fullNode = findNodeInTree($tree, nodeId);
    if (fullNode) {
      selectedNode.set(fullNode);
    }
  }

  $: if (container) {
    if (!Graph) {
      Graph = new ForceGraph(container)
        .nodeId("id")
        .nodeVal(4)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleWidth(1.2)
        .linkColor(() => "rgba(100, 100, 100, 0.5)")
        .linkWidth(0.5)
        .onNodeClick((node) => {
          const fullNode = findNodeInTree($tree, node.id as string);
          if (fullNode) {
            selectedNode.set(fullNode);
          }
        });
    }

    if ($selectedNode && $flatNodeMap.size > 0 && $crossref) {
      const localGraphNodes = new Map<
        string,
        { id: string; name: string; type: string }
      >();
      const localGraphLinks = new Set<string>();

      const queue: { id: string; distance: number }[] = [
        { id: $selectedNode.id, distance: 0 },
      ];
      const visited = new Set<string>([$selectedNode.id]);

      let head = 0;
      while (head < queue.length) {
        const { id: currentId, distance } = queue[head++];
        const nodeData = $flatNodeMap.get(currentId);
        if (nodeData) {
          localGraphNodes.set(currentId, {
            id: nodeData.id,
            name: nodeData.name,
            type: nodeData.type,
          });
        }

        if (distance >= neighborhoodDistance) continue;

        const outbound = $crossref[currentId] || [];
        for (const link of outbound) {
          localGraphLinks.add(
            JSON.stringify({ source: currentId, target: link.target_id }),
          );
          if (!visited.has(link.target_id)) {
            visited.add(link.target_id);
            queue.push({ id: link.target_id, distance: distance + 1 });
          }
        }

        for (const sourceId in $crossref) {
          for (const link of $crossref[sourceId]) {
            if (link.target_id === currentId) {
              localGraphLinks.add(
                JSON.stringify({ source: sourceId, target: currentId }),
              );
              if (!visited.has(sourceId)) {
                visited.add(sourceId);
                queue.push({ id: sourceId, distance: distance + 1 });
              }
            }
          }
        }
      }

      const finalLinks = Array.from(localGraphLinks)
        .map((l) => JSON.parse(l))
        .filter(
          (l) => localGraphNodes.has(l.source) && localGraphNodes.has(l.target),
        );

      Graph.graphData({
        nodes: Array.from(localGraphNodes.values()),
        links: finalLinks,
      });

      Graph.nodeLabel((node: { id: string }) => {
        const fullNode = localGraphNodes.get(node.id as string);
        return fullNode
          ? `<div style="color: #e6edf3; background-color: rgba(13, 17, 23, 0.8); padding: 2px 4px; border-radius: 4px; font-size: 12px;"><b>${fullNode.name}</b> (${fullNode.type})</div>`
          : "";
      });
      Graph.nodeColor((node: { id: string; type: string }) => {
        if ($selectedNode && node.id === $selectedNode.id) return "#e5534b";
        if (node.type.includes("Project")) return "#fdc349";
        if (node.type.includes("Concept")) return "#39c5cf";
        if (node.type.includes("Learning") || node.type.includes("Reflection"))
          return "#8cc37a";
        return "#e6edf3";
      });

      if (initialLoad) {
          setTimeout(() => Graph.zoomToFit(400, 100), 200);
          initialLoad = false;
      }
      setTimeout(() => {
        const graphNodes = Graph.graphData().nodes;
        const targetNode = graphNodes.find(
          (n: { id: string }) => n.id === $selectedNode.id,
        );
        if (targetNode?.x !== undefined && targetNode?.y !== undefined) {
          const currentZoom = Graph.zoom();
          Graph.centerAt(targetNode.x, targetNode.y, 1000);
          Graph.zoom(currentZoom, 1000);
        }
      }, 50);

      const relationsMap = new Map<string, (typeof relatedNodes)[0]>();
      const outboundLinks = $crossref[$selectedNode?.id || ""] || [];
      for (const link of outboundLinks) {
        const target = $flatNodeMap.get(link.target_id);
        if (target)
          relationsMap.set(target.id, {
            ...link,
            name: target.name,
            type: target.type,
            direction: "out",
            sourceName: "",
          });
      }
      for (const sourceId in $crossref) {
        for (const link of $crossref[sourceId]) {
          if (link.target_id === $selectedNode?.id) {
            const source = $flatNodeMap.get(sourceId);
            if (source && !relationsMap.has(source.id)) {
              relationsMap.set(source.id, {
                ...link,
                target_id: source.id,
                name: source.name,
                type: source.type,
                direction: "in",
                sourceName: source.name,
              });
            }
          }
        }
      }
      relatedNodes = Array.from(relationsMap.values()).sort(
        (a, b) => b.confidence - a.confidence,
      );

    } else {
      Graph.graphData({ nodes: [], links: [] });
      relatedNodes = [];
    }
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (Graph && container) {
        Graph.width(container.clientWidth);
        Graph.height(container.clientHeight);
      }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  });

  onDestroy(() => {
    if (Graph && typeof Graph._destructor === "function") {
      Graph._destructor();
    }
  });
</script>

<div class="orrery-layout">
  {#if $selectedNode}
    <div class="related-nodes-panel">
      <!-- REMOVED: <h4>Related Concepts (Direct)</h4> -->
      {#if relatedNodes.length > 0}
        <ul>
          {#each relatedNodes as rel}
            <li on:click={() => handleSelectRelated(rel.target_id)}>
              <span class="relation-type" title={`Confidence: ${rel.confidence}`}>
                {#if rel.direction === "out"}
                  {rel.relation.replace(/_/g, " ")}
                {:else}
                  is related to by
                {/if}
              </span>
              <span class="node-name">{rel.name}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="no-relations">No direct relationships found.</p>
      {/if}
    </div>

    <div class="controls">
      <label for="distance">Horizon: {neighborhoodDistance}</label>
      <input type="range" id="distance" min="1" max="5" step="1" bind:value={neighborhoodDistance} />
    </div>
  {/if}

  <div class="orrery-container" bind:this={container}></div>
</div>

<style>
  .orrery-layout {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .orrery-container {
    flex-grow: 1;
    min-height: 0;
  }
  .related-nodes-panel {
    flex-shrink: 0;
    max-height: 250px;
    background-color: rgba(13, 17, 23, 0.7);
    border-bottom: 1px solid #30363d;
    overflow-y: auto;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    display: flex;
    padding: 8px 15px;
    cursor: pointer;
    border-bottom: 1px solid #21262d;
    transition: background-color 0.2s ease-in-out;
    gap: 10px;
  }
  li:hover {
    background-color: #21262d;
  }
  .relation-type {
    color: #fdc349;
    opacity: 0.7;
    font-style: italic;
    flex-shrink: 0;
  }
  .node-name {
    color: #e6edf3;
    font-weight: bold;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 15px;
    background-color: #0d1117;
    border-bottom: 1px solid #30363d;
    flex-shrink: 0;
  }
  .controls label {
    font-size: 0.9em;
    opacity: 0.7;
  }
  .controls input[type="range"] {
    flex-grow: 1;
  }
  .no-relations {
    padding: 10px 15px;
    font-style: italic;
    opacity: 0.6;
  }
</style>