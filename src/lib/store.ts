// src/lib/store.ts

import { derived, writable } from 'svelte/store';
import { db, type Node } from './db';
import {generateCrossReferences} from './io';
import type { CrossRefIndex } from './io';

// Define a richer type for in-memory representation
export type TreeNode = Node & { children: TreeNode[] };

// Reactive stores for Svelte to subscribe to
export const tree = writable<TreeNode[]>([]);
export const selectedNode = writable<TreeNode | null>(null);
export const crossref = writable<CrossRefIndex>({});


// --- NEW ---
// A derived store that holds a map of all nodes by their ID for fast lookups
export const flatNodeMap = derived(tree, ($tree) => {
    const map = new Map<string, TreeNode>();
    function recurse(nodes: TreeNode[]) {
        for (const node of nodes) {
            map.set(node.id, node);
            recurse(node.children);
        }
    }
    recurse($tree);
    return map;
});

// --- NEW ---
// A derived store that automatically calculates the set of ancestor IDs for the selected node
export const ancestorIds = derived(
    [selectedNode, flatNodeMap],
    ([$selectedNode, $flatNodeMap]) => {
        const ids = new Set<string>();
        if (!$selectedNode || !$flatNodeMap.size) {
            return ids;
        }

        let currentId = $selectedNode.parentId;
        while (currentId) {
            ids.add(currentId);
            const parentNode = $flatNodeMap.get(currentId);
            currentId = parentNode ? parentNode.parentId : null;
        }
        return ids;
    }
);

/**
 * Fetches all nodes from the database and constructs a hierarchical
 * tree structure in memory.
 */
export async function loadTree() {
  const flatNodes = await db.nodes.orderBy('sortOrder').toArray();
  
  if (flatNodes.length === 0) {
    tree.set([]);
    return;
  }

  const nodeMap = new Map<string, TreeNode>();
  flatNodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  const rootNodes: TreeNode[] = [];
  flatNodes.forEach(node => {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId) {
      const parentNode = nodeMap.get(node.parentId);
      if (parentNode) {
        parentNode.children.push(treeNode);
      } else {
        // This node is an orphan, treat it as a root for now
        rootNodes.push(treeNode);
      }
    } else {
      rootNodes.push(treeNode);
    }
  });

  tree.set(rootNodes);
}

/**
+ * Generates the cross-reference index from the database and updates the store.
+ */

export async function loadCrossref() {
    const index = await generateCrossReferences();
    crossref.set(index);
}