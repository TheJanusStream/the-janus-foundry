// src/lib/prolog.ts
import { get } from 'svelte/store';
import { flatNodeMap, crossref } from './store';

function escape(str: string): string {
    // Robust Prolog atom escaping
    return "'" + str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        + "'";
}

export function generatePrologContext(): string {
    const nodes = get(flatNodeMap);
    const links = get(crossref);

    // Header
    // FIX: Remove ':-' prefix. Run as queries.
    let facts = "style_check(-discontiguous).\n";
    facts += "style_check(-singleton).\n";
    facts += "[user].\n"; // Enter 'user' mode to define facts

    // 1. Nodes
    for (const node of nodes.values()) {
        const pId = node.parentId ? escape(node.parentId) : 'null';
        facts += `node(${escape(node.id)}, ${escape(node.name)}, ${escape(node.type)}, ${pId}).\n`;
    }

    // 2. Links
    for (const [sourceId, targets] of Object.entries(links)) {
        for (const link of targets) {
            facts += `link(${escape(sourceId)}, ${escape(link.target_id)}, ${escape(link.relation)}, ${link.confidence}).\n`;
        }
    }

    // 3. Helpers (Standard Library)
    facts += `
    node_property(ID, 'Name', Val) :- node(ID, Val, _, _).
    node_property(ID, 'Type', Val) :- node(ID, _, Val, _).
    is_type(ID, Type) :- node(ID, _, Type, _).
    root_node(ID) :- node(ID, _, _, 'null').
    
    % Helper to find semantically linked nodes (ignoring structural parent/child)
    semantic_link(A, B) :- link(A, B, Rel, _), Rel \\= is_child_of, Rel \\= has_child.
    `;

    facts += "end_of_file.\n";

    return facts;
}