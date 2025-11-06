<script lang="ts">
  import {
    selectedNode,
    loadTree,
    loadCrossref,
    type TreeNode,
    ancestorIds,
    flatNodeMap,
  } from "$lib/store";
  import { createNode, deleteNodeAndChildren, reorderNode } from "$lib/db";
  import { copyNodeToClipboard, pasteNodeFromClipboard } from "$lib/io";
  import { modalStore } from "$lib/modal";
  import { get } from "svelte/store";

  export let node: TreeNode;

  let expanded = false;

  let dropIndicator: "before" | "after" | "on" | null = null;
  let isDragging = false;

  function handleSelect(event: MouseEvent) {
    event.stopPropagation();
    selectedNode.set(node);
  }

  function handleToggle(event: MouseEvent) {
    event.stopPropagation();
    expanded = !expanded;
    selectedNode.set(node);
  }

  async function handleAddChild(event: MouseEvent) {
    event.stopPropagation();
    await createNode(node.id);
    expanded = true;
    await loadTree();
    await loadCrossref();
  }

  async function handleDelete(event: MouseEvent) {
    event.stopPropagation();
    const confirmed = await modalStore.confirm(
      `Are you sure you want to PERMANENTLY DELETE "${node.name}" and all of its children?\n\nThis action cannot be undone.`,
    );
    if (confirmed) {
      await deleteNodeAndChildren(node.id);
      if ($selectedNode?.id === node.id) {
        selectedNode.set(null);
      }
      await loadTree();
      await loadCrossref();
    }
  }

  async function handleCopy(event: MouseEvent) {
    event.stopPropagation();
    await copyNodeToClipboard(node.id);
  }

  async function handlePaste(event: MouseEvent) {
    event.stopPropagation();
    await pasteNodeFromClipboard(node.id);
    expanded = true; // Ensure parent is open to show pasted node
    await loadTree();
    await loadCrossref();
  }

  function handleDragStart(event: DragEvent) {
    event.stopPropagation();
    event.dataTransfer!.setData("text/plain", node.id);
    event.dataTransfer!.effectAllowed = "move";
    isDragging = true;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) {
      // Prevent self-drop visual artifacts
    const target = event.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const y = event.clientY - rect.top;
      const height = rect.height;

      if (y < height * 0.25) {
      dropIndicator = "before";
      } else if (y > height * 0.75) {
      dropIndicator = "after";
    } else {
      dropIndicator = "on";
      }
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.stopPropagation();
    dropIndicator = null;
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const sourceId = event.dataTransfer!.getData("text/plain");
    const targetId = node.id;

    // Prevent dropping a node on itself or one of its own children
    const nodeMap = get(flatNodeMap);
    let currentId: string | null = targetId;
    while (currentId) {
      if (currentId === sourceId) {
        console.warn("Cannot drop a node onto itself or its descendant.");
        dropIndicator = null;
        return;
      }
      const parent = nodeMap.get(currentId);
      currentId = parent ? parent.parentId : null;
    }

    let newParentId: string | null;
    let newSortOrder: number;

    if (dropIndicator === "on") {
      newParentId = targetId;
      newSortOrder = node.children.length;
    } else {
      newParentId = node.parentId;
      newSortOrder =
        dropIndicator === "before" ? node.sortOrder : node.sortOrder + 1;
    }

    const finalDropIndicator = dropIndicator;
    dropIndicator = null;

    try {
      if (sourceId === targetId && finalDropIndicator !== "on") return;
      await reorderNode(sourceId, newParentId, newSortOrder);
      await loadTree();
      await loadCrossref();
    } catch (error) {
      console.error("Drag and drop failed:", error);
    }
  }

  function handleDragEnd() {
    isDragging = false;
    dropIndicator = null;
  }

  $: isActive = $selectedNode && $selectedNode.id === node.id;
  $: isAncestorOfSelected = $ancestorIds.has(node.id);
  $: isOpen = expanded || isAncestorOfSelected;
</script>

<div class="node" class:active={isActive} class:is-dragging-node={isDragging}>
  <div
    class="drop-indicator-before"
    class:visible={dropIndicator === "before"}
  ></div>

  <div class="toggler" on:click={handleToggle}>
    {#if node.children.length > 0}
      <span class="icon">{isOpen ? "−" : "+"}</span>
    {:else}
      <span class="icon dot">•</span>
    {/if}
  </div>

  <div
    class="row"
    class:drop-on={dropIndicator === "on"}
    on:click={handleSelect}
    draggable="true"
    on:dragstart={handleDragStart}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    on:dragend={handleDragEnd}
  >
    <!-- Toggler has been moved out -->
    <span class="name">{node.name}</span>

    {#if isActive}
      <div class="actions">
        <button class="copy" on:click={handleCopy} title="Copy Subtree"
          >📋</button
        >
        <button class="paste" on:click={handlePaste} title="Paste as Child"
          >📥</button
        >
        <button class="add" on:click={handleAddChild} title="Add Child Node"
          >+</button
        >
        <button
          class="delete"
          on:click={handleDelete}
          title="Delete Node & Children">-</button
        >
      </div>
    {/if}
  </div>

  <div
    class="drop-indicator-after"
    class:visible={dropIndicator === "after"}
  ></div>

  {#if node.children.length > 0 && isOpen}
    <div class="children">
      {#each node.children as child}
        <svelte:self node={child} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .node {
    padding-left: 10px;
    position: relative;
  }

  .row {
    display: flex;
    align-items: center;
    padding: 5px 8px;
    margin-left: 10px;
    border-radius: 4px;
    cursor: grab;
    position: relative;
  }

  .is-dragging-node > .row {
    opacity: 0.5;
  }

  .row[draggable="true"]:active {
    cursor: grabbing;
  }

  .row::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 4px;
    border: 2px dashed #39c5cf;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    pointer-events: none;
  }

  .row:hover {
    background-color: #21262d;
  }

  .row.drop-on::after {
    opacity: 1;
  }

  .drop-indicator-before,
  .drop-indicator-after {
    position: absolute;
    left: 30px;
    right: 0;
    height: 2px;
    background-color: #fdc349;
    z-index: 1;
    display: none;
    pointer-events: none;
  }
  .drop-indicator-before {
    top: -1px;
  }
  .drop-indicator-after {
    bottom: -1px;
  }
  .drop-indicator-before.visible,
  .drop-indicator-after.visible {
    display: block;
  }

  .active > .row {
    background-color: #39c5cf;
    color: #0d1117;
  }

  .toggler {
    position: absolute;
    left: 0px;
    top: 5px;
    width: 20px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    z-index: 2;
  }
  .toggler:hover {
    background-color: #30363d;
  }

  .icon {
    font-family: monospace;
    color: #8b949e;
    font-size: 14px;
  }
  /* NEW: Simplified rule for icon color within an active node's toggler */
  .active > .toggler .icon {
    color: #8b949e;
  }

  .icon.dot {
    font-size: 18px;
    line-height: 1;
  }

  .name {
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .children {
    border-left: 1px solid #30363d;
    margin-left: 10px;
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
    padding-left: 10px;
  }

  .actions button {
    background: #161b22;
    color: #e6edf3;
    border: 1px solid #30363d;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    cursor: pointer;
    font-weight: bold;
    font-size: 16px;
    transition: all 0.2s ease-in-out;
  }
  .actions button:hover {
    color: #161b22;
  }
  .actions button.add {
    color: #8cc37a;
    border-color: #538d42;
  }
  .actions button.add:hover {
    background-color: #8cc37a;
    border-color: #8cc37a;
  }
  .actions button.delete {
    color: #e5534b;
    border-color: #b33d36;
  }
  .actions button.delete:hover {
    background-color: #e5534b;
    border-color: #e5534b;
  }

  .actions button.copy {
    color: #8884d8;
    border-color: #5854a8;
  }
  .actions button.copy:hover {
    background-color: #8884d8;
    border-color: #8884d8;
  }

  .actions button.paste {
    color: #82ca9d;
    border-color: #529a6d;
  }
  .actions button.paste:hover {
    background-color: #82ca9d;
    border-color: #82ca9d;
  }

  .actions button.add {
    color: #8cc37a;
    border-color: #538d42;
  }
  .actions button.add:hover {
    background-color: #8cc37a;
    border-color: #8cc37a;
  }

  .actions button.delete {
    color: #e5534b;
    border-color: #b33d36;
  }
  .actions button.delete:hover {
    background-color: #e5534b;
    border-color: #e5534b;
  }
</style>
