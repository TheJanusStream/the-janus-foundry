<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { get } from "svelte/store";
  import { base } from "$app/paths";
  import {
    tree,
    selectedNode,
    loadTree,
    loadCrossref,
    type TreeNode as StoreTreeNode,
    flatNodeMap,
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
  import { isSearchOpen } from "$lib/store";
  import SearchModal from "$lib/components/SearchModal.svelte";

  let editMode = false;
  let editName = "";
  let editType = "";
  let editText = "";

  let orreryIsMinimized = true;

  let sidebarWidth = 30; // Initial width in percent
  let isResizing = false;

  // we automatically swap the stale selectedNode object for the fresh one from the new tree.
  $: if ($flatNodeMap.size > 0 && $selectedNode) {
    const freshNode = $flatNodeMap.get($selectedNode.id);
    // If we found the same ID in the new map, but the object reference is different, update it.
    if (freshNode && freshNode !== $selectedNode) {
      // Keep the edit mode state if we are just refreshing data
      // But update the store so the UI reflects the new tree structure (children, etc)
      selectedNode.set(freshNode);
    }
  }

  function startResize(event: MouseEvent) {
    document.body.classList.add("resizing");
    isResizing = true;
    window.addEventListener("mousemove", doResize);
    window.addEventListener("mouseup", stopResize);
  }

  function doResize(event: MouseEvent) {
    if (isResizing) {
      const newWidth = (event.clientX / window.innerWidth) * 100;
      if (newWidth > 5 && newWidth < 70) {
        // Min/max width constraints
        sidebarWidth = newWidth;
      }
    }
  }

  function stopResize() {
    document.body.classList.remove("resizing");
    isResizing = false;
    window.removeEventListener("mousemove", doResize);
    window.removeEventListener("mouseup", stopResize);
  }

  onDestroy(() => {
    window.removeEventListener("mousemove", doResize);
    window.removeEventListener("mouseup", stopResize);
  });

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

    const savedId = localStorage.getItem("janus_selected_node_id");
    const nodeMap = get(flatNodeMap);

    if (savedId && nodeMap.has(savedId)) {
      selectedNode.set(nodeMap.get(savedId)!);
    } else {
      const rootNodes = get(tree);
      if (rootNodes.length > 0) {
        selectedNode.set(rootNodes[0]);
      } else {
        selectedNode.set(null);
      }
    }
  });

  async function handleImportCore() {
    try {
      await importSourceJson();
      await loadTree();
      await loadCrossref();
      const rootNodes = get(tree);
      if (rootNodes.length > 0) selectedNode.set(rootNodes[0]);
    } catch (error) {
      notify("Import cancelled or failed.", "error");
    }
  }

  async function handleApplyPatch() {
    try {
      await applyPatchFromClipboard();
      await loadTree();
      await loadCrossref();
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

  async function handleExecute() {
    if (!$selectedNode || !isTauri()) return;

    try {
      const { invoke } = await import("@tauri-apps/api/core");

      // Determine Source (Code) and Target (Output) based on context
      let codeNode = $selectedNode;
      let outputNodeId: string | undefined;

      if ($selectedNode.type === "Exec:Output") {
        // Context: Re-running from the Output node itself
        const nodeMap = get(flatNodeMap);
        if (!$selectedNode.parentId || !nodeMap.has($selectedNode.parentId)) {
          throw new Error(
            "Orphaned output node: cannot find parent executable.",
          );
        }
        codeNode = nodeMap.get($selectedNode.parentId)!;
        outputNodeId = $selectedNode.id;
      } else {
        // Context: Running from the Executable node
        const children = $selectedNode.children || [];
        const existingOutput = children.find((c) => c.type === "Exec:Output");
        if (existingOutput) {
          outputNodeId = existingOutput.id;
        }
      }

      notify(`Executing ${codeNode.type.split(":")[1]}...`, "info");

      const output = (await invoke("execute_code", {
        language: codeNode.type,
        code: codeNode.description,
      })) as string;

      if (outputNodeId) {
        await updateNode(outputNodeId, { description: output });
      } else {
        // Create new output node
        const children = codeNode.children || [];
        const newId = crypto.randomUUID();
        await db.nodes.add({
          id: newId,
          parentId: codeNode.id,
          name: "Output",
          type: "Exec:Output",
          description: output,
          sortOrder: children.length,
        });
      }

      await loadTree(); // Refresh UI
      notify("Execution successful.", "success");
    } catch (err) {
      notify(`Execution failed: ${err}`, "error");
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    // Cmd+K or Ctrl+K
    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
      event.preventDefault();
      isSearchOpen.update((v) => !v);
    }
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />
<NotificationDisplay />

{#if $modalStore.isOpen}
  <ConfirmModal />
{/if}

{#if $isSearchOpen}
  <SearchModal />
{/if}
{#if $modalStore.isOpen}
  <ConfirmModal />
{/if}

<main
  class:orrery-minimized={orreryIsMinimized}
  class:resizing={isResizing}
  style="grid-template-columns: {sidebarWidth}% 5px 1fr {orreryIsMinimized
    ? '0px'
    : '30%'};"
>
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

  <div class="divider" on:mousedown={startResize} title="Drag to resize"></div>

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
              {#if $selectedNode.type.startsWith("Exec:") || $selectedNode.type.startsWith("SysConfig:")}
                {#if isTauri() && $selectedNode.type.startsWith("Exec:")}
                  <div class="code-header">
                    <span class="lang-badge"
                      >{$selectedNode.type.split(":")[1]}</span
                    >
                    <button class="run-button" on:click={handleExecute}>
                      {$selectedNode.type === "Exec:Output"
                        ? "▶ Rerun Parent"
                        : "▶ Run"}
                    </button>
                  </div>
                {/if}
                <pre><code>{$selectedNode.description}</code></pre>
              {:else}
                <Exmarkdown md={$selectedNode.description} />
              {/if}
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
  :global(body.resizing) {
    cursor: col-resize !important;
    user-select: none;
    -webkit-user-select: none; /* For Safari */
    -moz-user-select: none; /* For Firefox */
    -ms-user-select: none; /* For Internet Explorer/Edge */
  }
  main {
    display: grid;
    height: 100vh;
    overflow-x: hidden;
    transition: grid-template-columns 0.3s ease-in-out;
  }
  main.resizing {
    transition: none; /* This disables animation during drag */
  }
  main.orrery-minimized {
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
  pre {
    white-space: pre-wrap; /* Wrap text so it doesn't break layout */
    word-wrap: break-word;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
      "Liberation Mono", monospace;
    font-size: 0.9em;
    color: #e6edf3;
    background-color: #161b22; /* Slightly lighter than bg for contrast */
    padding: 15px;
    margin: 10px 0;
    border-radius: 4px;
    overflow-x: auto;
    border: 1px solid #30363d;
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
    max-height: 96px;
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
  .divider {
    width: 5px;
    background-color: #30363d;
    cursor: col-resize;
    transition: background-color 0.2s ease-in-out;
  }
  .divider:hover {
    background-color: #fdc349;
  }
  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 10px;
    background-color: #21262d;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    border: 1px solid #30363d;
    border-bottom: none;
    margin-top: 10px;
  }
  /* Remove top margin from pre to attach to header */
  .code-header + pre {
    margin-top: 0;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
  .lang-badge {
    font-size: 0.8em;
    color: #8b949e;
    text-transform: uppercase;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .run-button {
    background-color: #238636;
    color: #ffffff;
    border: 1px solid rgba(240, 246, 252, 0.1);
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 0.85em;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
  }
  .run-button:hover {
    background-color: #2ea043;
  }
</style>
