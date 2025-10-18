<script lang="ts">
  import { selectedNode, loadTree, type TreeNode, ancestorIds } from '$lib/store';
  import { createNode, deleteNodeAndChildren } from '$lib/db';

  export let node: TreeNode;
  
  // Explicit state for user-driven expansion
  let expanded = false;

  // --- REFACTORED LOGIC ---
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
    const newId = await createNode(node.id);
    
    // Ensure the parent is expanded to show the new node
    expanded = true; 
    
    await loadTree();
    // In a future step, we can find and select the new node
  }

  async function handleDelete(event: MouseEvent) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to PERMANENTLY DELETE "${node.name}" and all of its children?`)) {
      await deleteNodeAndChildren(node.id);
      selectedNode.set(null);
      await loadTree();
    }
  }

  // --- NEW REACTIVE LOGIC FOR VISIBILITY ---
  $: isActive = $selectedNode && $selectedNode.id === node.id;
  $: isAncestorOfSelected = $ancestorIds.has(node.id);
  $: isOpen = expanded || isAncestorOfSelected;

</script>

<div class="node" class:active={isActive}>
  <div class="row" on:click={handleSelect}>
    <div class="toggler" on:click={handleToggle}>
      {#if node.children.length > 0}
        <span class="icon">{isOpen ? '−' : '+'}</span>
      {:else}
        <span class="icon dot">•</span>
      {/if}
    </div>

    <span class="name">{node.name}</span>
    
    {#if isActive}
      <div class="actions">
        <button class="add" on:click={handleAddChild} title="Add Child Node">+</button>
        <button class="delete" on:click={handleDelete} title="Delete Node & Children">-</button>
      </div>
    {/if}
  </div>

  {#if node.children.length > 0 && isOpen}
    <div class="children">
      {#each node.children as child}
        <!-- --- THIS IS THE FIX --- -->
        <svelte:self node={child} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .node {
    padding-left: 20px; /* Indentation for all nodes */
    position: relative;
  }

  .row {
    display: flex;
    align-items: center;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
  }

  .row:hover {
    background-color: #21262d;
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
  }
  .toggler:hover {
    background-color: #30363d;
  }
  
  .icon {
    font-family: monospace;
    color: #8b949e;
    font-size: 14px;
  }
  .active > .row .icon {
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
    margin-left: 9px; /* Aligns line with the center of the toggler icon */
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-left: auto; /* Pushes actions to the far right */
    padding-left: 10px;
  }
  
  /* Action button styles remain the same */
  .actions button {
    background: #161b22;
    color: #e6edf3;
    border: 1px solid #30363d;
    border-radius: 50%;
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
  .actions button.add { color: #8cc37a; border-color: #538d42; }
  .actions button.add:hover { background-color: #8cc37a; border-color: #8cc37a; }
  .actions button.delete { color: #e5534b; border-color: #b33d36; }
  .actions button.delete:hover { background-color: #e5534b; border-color: #e5534b; }
</style>