<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { base } from '$app/paths';
  import {
    tree,
    selectedNode,
    loadTree,
    loadCrossref,
    type TreeNode as StoreTreeNode,
  } from "$lib/store";
  import { db, updateNode, createNode } from "$lib/db";
  import TreeNode from "$lib/components/TreeNode.svelte";
  import Orrery from "$lib/components/Orrery.svelte";
  import StatsPanel from "$lib/components/StatsPanel.svelte";
  import Exmarkdown from "svelte-exmarkdown";
  import {
    exportAll,
    importSourceJson,
    applyPatchFromClipboard,
    seedDatabaseWithAgora,
  } from "$lib/io";
  import { isTauri } from "$lib/utils";
  import NotificationDisplay from "$lib/components/NotificationDisplay.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import { notify } from "$lib/notifications";
  import { modalStore } from "$lib/modal";

  let editMode = false;
  let editName = "";
  let editType = "";
  let editText = "";

  let orreryIsMinimized = true;

  selectedNode.subscribe((node) => {
    if (node) {
      editName = node.name;
      editType = node.type;
      editText = node.description;
      editMode = false;
    }
  });

  function toggleOrrery() {
    orreryIsMinimized = !orreryIsMinimized;
  }

  async function handleSave() {
    if (!$selectedNode) return;
    const changes = { name: editName, type: editType, description: editText };
    await updateNode($selectedNode.id, changes);
    await loadTree();
    await loadCrossref();

    const findNode = (
      nodes: StoreTreeNode[],
      id: string,
    ): StoreTreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(node.children, id);
        if (found) return found;
      }
      return null;
    };
    selectedNode.set(findNode($tree, $selectedNode.id));
    editMode = false;
  }

  async function handleAddRootNode() {
    await createNode(null);
    await loadTree();
    await loadCrossref();
  }

  async function handleResetToAgora() {
    try {
      await seedDatabaseWithAgora();
      await loadTree();
      await loadCrossref();
      const rootNodes = get(tree);
      if (rootNodes.length > 0) {
        selectedNode.set(rootNodes[0]);
      } else {
        selectedNode.set(null);
      }
      notify("Memory has been reset to the Agora template.", "success");
    } catch (error) {
      notify("Failed to reset to Agora template.", "error");
    }
  }

  async function handleExport() {
    try {
      const filenames = await exportAll();
      if (filenames.length > 0) {
        notify(
          "Snapshot saved to your browser's default download directory:\n\n- " +
            filenames.join("\n- "),
          "success",
        );
      }
    } catch (error) {
      notify("Export failed.", "error");
    }
  }

  onMount(async () => {
    const count = await db.nodes.count();
    if (count === 0) {
      await seedDatabaseWithAgora();
    }
    await loadTree();
    await loadCrossref();
    const rootNodes = get(tree);
    if (rootNodes.length > 0) {
      selectedNode.set(rootNodes[0]);
    } else {
      selectedNode.set(null);
    }
  });

  async function handleImportCore() {
    try {
      await importSourceJson();
      await loadTree();
      await loadCrossref();
      const rootNodes = get(tree);
      if (rootNodes.length > 0) {
        selectedNode.set(rootNodes[0]);
      } else {
        selectedNode.set(null);
      }
    } catch (error) {
      notify("Import cancelled or failed.", "error");
    }
  }

  async function handleApplyPatch() {
    try {
      await applyPatchFromClipboard();
      await loadTree();
      await loadCrossref();
      selectedNode.set(null);
    } catch (error) {
      notify("Patch application cancelled or failed.", "error");
    }
  }

  async function handleSupportClick() {
    const patreonUrl = "https://www.patreon.com/TheJanusStream";
    if (isTauri()) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(patreonUrl);
    } else {
      window.open(patreonUrl, "_blank");
    }
  }
</script>

<NotificationDisplay />

{#if $modalStore.isOpen}
  <ConfirmModal />
{/if}

<main class:orrery-minimized={orreryIsMinimized}>
  <div class="sidebar">
    <div class="sidebar-content">
      <div class="tree-container">
        {#each $tree as rootNode}
          <TreeNode node={rootNode} />
        {:else}
          <div class="empty-state">
            <p>The memory is empty.</p>
            <button class="reset-button" on:click={handleResetToAgora}
              >Reset to Agora Template</button
            >
          </div>
        {/each}
      </div>
    </div>

    <StatsPanel />

    <div class="core-interactions">
      <button
        class="import-button"
        on:click={handleImportCore}
        title="Load Core"
      >
        <img src="{base}/load_core_icon.png" alt="Load Core" />
      </button>
      <button on:click={handleApplyPatch} title="Apply Patch from Clipboard">
        <img src="{base}/apply_patch_icon.png" alt="Apply Patch" />
      </button>
      <button on:click={handleExport} title="Save Snapshot (Core + Crossref)">
        <img src="{base}/save_core_icon.png" alt="Save Core" />
      </button>
      <button on:click={handleSupportClick} title="Support the Forge">
        <img src="{base}/support_janus_icon.png" alt="Support the Forge" />
      </button>
    </div>
  </div>

  <div class="workbench">
    <div class="workbench-header">
      {#if $selectedNode}
        <div class="toggle-buttons">
          <button class:active={!editMode} on:click={() => (editMode = false)}
            >View</button
          >
          <button class:active={editMode} on:click={() => (editMode = true)}
            >Edit</button
          >
        </div>
      {/if}
      <button
        class="header-toggle-button"
        on:click={toggleOrrery}
        title="Toggle Cross-Reference Panel"
      >
        <span>CROSSREF</span>
        <span class="toggle-icon">{orreryIsMinimized ? "[+]" : "−"}</span>
      </button>
    </div>

    {#if $selectedNode}
      <div class="node-details">
        {#if !editMode}
          <div class="view-mode">
            <h3>{$selectedNode.name}</h3>
            <p class="type-tag">Type: {$selectedNode.type}</p>
            <div class="description-content">
              <Exmarkdown md={$selectedNode.description} />
            </div>
          </div>
        {:else}
          <div class="edit-mode">
            <label for="edit-name">Name</label>
            <input id="edit-name" type="text" bind:value={editName} />

            <label for="edit-type">Type</label>
            <input id="edit-type" type="text" bind:value={editType} />

            <label for="edit-desc">Description</label>
            <textarea id="edit-desc" bind:value={editText}></textarea>
            <button class="save-button" on:click={handleSave}
              >Save Changes</button
            >
          </div>
        {/if}
      </div>
    {:else}
      <p class="placeholder">Select a node to view its details.</p>
    {/if}
  </div>

  <div class="orrery-panel">
    <Orrery />
  </div>
</main>

<style>
  :global(html) {
    box-sizing: border-box;
  }
  :global(*, *:before, *:after) {
    box-sizing: inherit;
  }
  :global(body) {
    background-color: #0d1117;
    color: #e6edf3;
    font-family: sans-serif;
    margin: 0;
  }
  main {
    display: grid;
    grid-template-columns: 30% 40% 30%;
    height: 100vh;
    overflow-x: hidden;
    transition: grid-template-columns 0.3s ease-in-out;
  }

  main.orrery-minimized {
    grid-template-columns: 30% 70% 0fr;
    overflow-x: hidden;
  }

  .sidebar {
    padding: 20px;
    background-color: #161b22;
    border-right: 1px solid #30363d;
    display: flex;
    flex-direction: column;
    background-image: url("/panel_background_left.png");
    background-size: cover;
    background-position: center;
    overflow: hidden;
  }
  .sidebar-content {
    flex-grow: 1;
    overflow-y: auto;
    background-color: rgba(13, 17, 23, 0.5);
    border-radius: 4px;
    padding: 0px;
  }
  .workbench {
    padding: 20px;
    background-color: #161b22;
    display: flex;
    flex-direction: column;
    background-image: url("/panel_background_right.png");
    background-size: cover;
    background-position: center;
    overflow-x: hidden;
    overflow-y: auto;
  }
  .workbench-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: rgba(13, 17, 23, 0.5);
    padding: 0px;
  }
  .orrery-panel {
    background-image: url("/orrery_background.png");
    background-size: cover;
    background-position: center;
    border-left: 1px solid #30363d;
    overflow: hidden;
  }
  h3 {
    color: #39c5cf;
    opacity: 0.9;
    letter-spacing: 2px;
    margin: 0 0 10px 0;
  }
  .tree-container {
    border: 1px solid #30363d;
    border-radius: 6px;
    margin-top: 20px;
    padding: 10px 15px;
    background-color: rgba(13, 17, 23, 0.7);
    font-size: 0.9em;
  }
  .node-details {
    margin-top: 20px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    background-color: rgba(13, 17, 23, 0.7);
    border-radius: 4px;
    padding: 20px;
  }
  .type-tag {
    font-style: italic;
    color: #fdc349;
    opacity: 0.8;
    margin-top: -5px;
    margin-bottom: 15px;
  }
  .description-content {
    background-color: #0d1117;
    border: 1px solid #30363d;
    padding: 1px 15px;
    border-radius: 4px;
  }
  .edit-mode {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    gap: 10px;
  }
  label {
    opacity: 0.7;
    font-size: 0.9em;
    margin-bottom: -5px;
  }
  input,
  textarea {
    background-color: #0d1117;
    color: #e6edf3;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 10px;
    box-sizing: border-box;
    width: 100%;
  }
  textarea {
    flex-grow: 1;
    resize: vertical;
  }
  .toggle-buttons button {
    background: none;
    border: 1px solid #30363d;
    color: #e6edf3;
    padding: 5px 10px;
    cursor: pointer;
  }
  .toggle-buttons button.active {
    background-color: #39c5cf;
    border-color: #39c5cf;
    color: #0d1117;
    font-weight: bold;
  }
  .save-button {
    margin-top: 10px;
    padding: 10px;
    background-color: #fdc349;
    color: #161b22;
    font-weight: bold;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    align-self: flex-end;
  }
  .empty-state {
    text-align: center;
    padding: 20px;
    opacity: 0.7;
  }
  .empty-state button {
    background-color: #38761d;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 4px;
    cursor: pointer;
  }
  .empty-state button:hover {
    background-color: #6aa84f;
  }

  .empty-state button.reset-button {
    background-color: #583915; /* A cautious orange/brown */
    color: #fdc349;
    border: 1px solid #fdc349;
    padding: 10px 15px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
  }
  .empty-state button.reset-button:hover {
    background-color: #fdc349;
    color: #161b22;
  }
  .core-interactions {
    margin-top: auto;
    padding-top: 20px;
    border-top: 0px solid #30363d;
    display: flex;
    gap: 20px;
  }

  .core-interactions button {
    flex-grow: 1;
    padding: 0px;
    background-color: transparent;
    border: 1px solid #30363d;
    border-radius: 4px;
    cursor: pointer;
  }
  .core-interactions button:hover:not(:disabled) {
    border-color: #39c5cf;
  }
  .core-interactions button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .core-interactions button img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 0.8;
  }
  .core-interactions button:hover:not(:disabled) img {
    opacity: 1;
  }
  .header-toggle-button {
    color: #39c5cf;
    opacity: 0.7;
    letter-spacing: 2px;
    font-size: 0.8em;
    background: none;
    border: 1px solid transparent; /* Keeps layout stable */
    padding: 5px 10px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  .header-toggle-button:hover {
    opacity: 1;
    background-color: rgba(48, 54, 61, 0.5);
  }
  .header-toggle-button .toggle-icon {
    font-family: monospace;
    font-size: 1.2em;
    margin-left: 8px;
  }
</style>
