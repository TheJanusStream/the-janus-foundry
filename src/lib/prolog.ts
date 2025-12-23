import { get } from 'svelte/store';
import { flatNodeMap, crossref } from './store';

function escape(str: string): string {
    return "'" + str
        .replace(/\\/g, '\\\\') // Escape backslashes first
        .replace(/'/g, "\\'")   // Escape single quotes
        .replace(/\n/g, '\\n')  // Escape newlines
        .replace(/\r/g, '')     // Remove carriage returns
        .replace(/\0/g, '')     // Remove null bytes
        + "'";
}

export function generatePrologContext(): string[] {
    const nodes = get(flatNodeMap);
    const links = get(crossref);

    const BATCH_SIZE = 50; // Conservative batch size
    const batches: string[] = [];
    let currentBatch: string[] = [];

    // Helper to push and flush
    const addGoal = (goal: string) => {
        currentBatch.push(goal);
        if (currentBatch.length >= BATCH_SIZE) {
            batches.push(currentBatch.join(', ') + ".");
            currentBatch = [];
        }
    };

    // 1. Nodes & Descriptions
    for (const node of nodes.values()) {
        const pId = node.parentId ? escape(node.parentId) : 'null';
        addGoal(`assertz(node(${escape(node.id)}, ${escape(node.name)}, ${escape(node.type)}, ${pId}))`);
        // We assert description separately to isolate potential syntax errors
        addGoal(`assertz(description(${escape(node.id)}, ${escape(node.description)}))`);
    }

    // 2. Links
    for (const [sourceId, targets] of Object.entries(links)) {
        for (const link of targets) {
            addGoal(`assertz(link(${escape(sourceId)}, ${escape(link.target_id)}, ${escape(link.relation)}, ${link.confidence}))`);
        }
    }

    // Flush remaining data facts
    if (currentBatch.length > 0) {
        batches.push(currentBatch.join(', ') + ".");
        currentBatch = [];
    }

    // 3. Helpers (Standard Library) - Sent as a separate final batch
    const helpers = [
        "assertz((node_property(ID, 'Name', Val) :- node(ID, Val, _, _)))",
        "assertz((node_property(ID, 'Type', Val) :- node(ID, _, Val, _)))",
        "assertz((node_property(ID, 'Description', Val) :- description(ID, Val)))",
        "assertz((is_type(ID, Type) :- node(ID, _, Type, _)))",
        "assertz((root_node(ID) :- node(ID, _, _, 'null')))",
        "assertz((semantic_link(A, B) :- link(A, B, Rel, _), Rel \\= 'is_child_of', Rel \\= 'has_child'))"
    ];

    batches.push(helpers.join(', ') + ".");

    return batches;
}
