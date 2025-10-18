// src/lib/db.ts
import Dexie, { type Table } from 'dexie';

export interface Node {
  id: string; // UUID, primary key
  parentId: string | null; // UUID of the parent, or null for the root
  name: string;
  type: string;
  description: string;
  sortOrder: number; // To maintain order of children
}

export class JanusFoundryDB extends Dexie {
  nodes!: Table<Node>; 

  constructor() {
    super('JanusFoundry');
    this.version(1).stores({
      nodes: 'id, parentId, sortOrder'
    });
  }
}

export const db = new JanusFoundryDB();

/**
 * Updates any specified fields for a given node.
 * @param nodeId The ID of the node to update.
 * @param changes An object containing the fields to update (e.g., { name: 'New Name' }).
 */
export async function updateNode(nodeId: string, changes: Partial<Omit<Node, 'id'>>) {
  try {
    const updatedCount = await db.nodes.update(nodeId, changes);
    if (updatedCount > 0) {
      console.log(`Node ${nodeId} updated successfully with changes:`, changes);
    } else {
      console.warn(`Node ${nodeId} not found for update.`);
    }
  } catch (error) {
    console.error(`Failed to update node ${nodeId}:`, error);
    throw error;
  }
}

/**
 * Creates a new node in the database.
 * @param parentId The ID of the parent node, or null to create a root node.
 * @returns The ID of the newly created node.
 */
export async function createNode(parentId: string | null): Promise<string> {
  try {
    const siblingCount = await db.nodes.where({ parentId: parentId }).count();
    const newId = crypto.randomUUID();
    
    const newNode: Node = {
      id: newId,
      parentId: parentId,
      name: 'New Node',
      type: 'Node',
      description: '',
      sortOrder: siblingCount, // Place it last among its siblings
    };
    
    await db.nodes.add(newNode);
    console.log(`Node ${newId} created under parent ${parentId}.`);
    return newId;
  } catch (error) {
    console.error(`Failed to create node:`, error);
    throw error;
  }
}

/**
 * Deletes a node and all of its descendants recursively and atomically.
 * @param nodeId The ID of the root node of the subtree to delete.
 */
export async function deleteNodeAndChildren(nodeId: string) {
  try {
    await db.transaction('rw', db.nodes, async () => {
      const nodesToDelete = new Set<string>();
      const queue: string[] = [nodeId];

      let head = 0;
      while(head < queue.length) {
        const currentId = queue[head++];
        if (!nodesToDelete.has(currentId)) {
          nodesToDelete.add(currentId);
          const children = await db.nodes.where('parentId').equals(currentId).toArray();
          for (const child of children) {
            queue.push(child.id);
          }
        }
      }
      
      const idsToDelete = Array.from(nodesToDelete);
      await db.nodes.bulkDelete(idsToDelete);
      console.log(`Deleted ${idsToDelete.length} nodes starting from ${nodeId}.`);
    });
  } catch (error) {
    console.error(`Failed to delete subtree for node ${nodeId}:`, error);
    throw error;
  }
}