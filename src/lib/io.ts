// src/lib/io.ts
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { db, type Node, deleteNodeAndChildren, updateNode } from './db';
import { readText } from '@tauri-apps/plugin-clipboard-manager';

// --- INTERFACES ---
export interface SourceJsonNode {
    ID: string;
    Name: string;
    Type: string;
    Description: string;
    Items: SourceJsonNode[];
}

export interface CrossRefIndex {
    [key: string]: CrossRefLink[];
}

export interface CrossRefLink {
    target_id: string;
    relation: string;
    provenance: string[];
    confidence: number;
}

// --- Patch Operation Interfaces ---
interface BasePatchOperation {
    op: 'add' | 'remove' | 'replace';
}
interface AddOperation extends BasePatchOperation {
    op: 'add';
    parent_uuid: string;
    node: Omit<SourceJsonNode, 'ID' | 'Items'> & { Items?: SourceJsonNode[] };
}
interface RemoveOperation extends BasePatchOperation {
    op: 'remove';
    uuid: string;
}
interface ReplaceOperation extends BasePatchOperation {
    op: 'replace';
    uuid: string;
    field: 'Name' | 'Type' | 'Description';
    value: string;
}
type PatchOperation = AddOperation | RemoveOperation | ReplaceOperation;

// --- CONSTANTS ---
const COMMON_WORD_PERCENTILE_THRESHOLD = 0.10; // Top 10% of words are considered too common
const MIN_SHARED_KEYWORDS_THRESHOLD = 2;      // Require at least 2 shared keywords
const MAX_LINKS_PER_NODE = 7;                 // Limit max outgoing links per node

const BASE_STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'of', 'for', 'to', 'with', 'is', 'was', 'were', 'it', 'that', 'as', 'by', 'from',
    'this', 'at', 'if', 'but', 'not', 'be', 'are', 'has', 'had', 'have', 'do', 'does', 'did', 'its', 'also', 'just', 'made',
    'new', 'like', 'use', 'used', 'using', 'get', 'set', 'make', 'all', 'any', 'most', 'other', 'some', 'such', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'can', 'will', 'should', 'could', 'would', 'must', 'may', 'might',
    'janus', 'kairos', 'codewright',
    // --- Project-specific ---
    'project', 'task', 'node', 'file', 'code', 'script', 'type', 'name', 'description', 'items', 'id', 'uuid',
    // --- Generic technical ---
    'system', 'data', 'information', 'process', 'based', 'via', 'core', 'value', 'user', 'agent', 'self', 'knowledge'
]);


// --- HELPER FUNCTIONS ---

/**
 * A simple keyword extractor. Converts text to lowercase, removes punctuation, 
 * splits by whitespace, and filters out short words.
 */
function _extractInitialKeywords(textContent: string): Set<string> {
    return new Set(
        textContent
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ') // Keep hyphens as part of words
            .split(/\s+/)
            .filter(word => word.length > 2)
    );
}

/**
 * Infers a relationship type based on the source and target node types.
 * This is a placeholder for more complex semantic logic.
 */
function _inferRelationType(sourceType: string, targetType: string): string {
    if (sourceType.includes('Project') && targetType.includes('Task')) {
        return 'contains_task';
    }
    if (sourceType.includes('Learning') && targetType.includes('Concept')) {
        return 'clarifies';
    }
    return 'is_related_to';
}

/**
 * Calculates the intersection of two sets.
 */
function setIntersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    const intersection = new Set<T>();
    for (const elem of setB) {
        if (setA.has(elem)) {
            intersection.add(elem);
        }
    }
    return intersection;
}


/**
 * Recursively traverses the imported JSON tree, generating new UUIDs and
 * creating a flat array of nodes suitable for the database.
 * @param sourceNode The node from the source.json file.
 * @param newParentId The newly generated UUID of this node's parent.
 * @param sortOrder The node's position among its siblings.
 * @param flatNodes The array to push new nodes into.
 */
function processImportedNode(
    sourceNode: SourceJsonNode,
    newParentId: string | null,
    sortOrder: number,
    flatNodes: Node[]
) {
    const newId = sourceNode.ID;

    flatNodes.push({
        id: newId,
        parentId: newParentId,
        name: sourceNode.Name,
        type: sourceNode.Type,
        description: sourceNode.Description,
        sortOrder: sortOrder,
    });

    if (sourceNode.Items && sourceNode.Items.length > 0) {
        sourceNode.Items.forEach((child, index) => {
            processImportedNode(child, newId, index, flatNodes);
        });
    }
}

/**
 * Opens a file dialog for the user to select a source.json file,
 * processes it with fresh UUIDs, and replaces the entire database content.
 */
export async function importSourceJson(): Promise<void> {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) {
                return reject(new Error("No file selected."));
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const text = e.target?.result as string;
                    const rootSourceNode: SourceJsonNode = JSON.parse(text);

                    const flatNodes: Node[] = [];
                    processImportedNode(rootSourceNode, null, 0, flatNodes);

                    await db.transaction('rw', db.nodes, async () => {
                        await db.nodes.clear();
                        await db.nodes.bulkAdd(flatNodes);
                    });

                    console.log(`Successfully imported ${flatNodes.length} nodes.`);
                    resolve();

                } catch (error) {
                    console.error("Failed to parse or import JSON file:", error);
                    alert("Error: Failed to parse or import the selected JSON file. See console for details.");
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                console.error("File reading error:", error);
                alert("Error: Failed to read the selected file.");
                reject(error);
            };

            reader.readAsText(file);
        };

        input.addEventListener('cancel', () => {
            document.body.removeChild(input);
            console.log("File selection cancelled by user.");
            reject(new Error("File selection cancelled."));
        });

        input.click();
    });
}

export async function generateCrossReferences(): Promise<CrossRefIndex> {
    const allNodes = await db.nodes.toArray();
    if (allNodes.length < 2) return {};

    console.log(`Processing ${allNodes.length} nodes for cross-ref generation.`);

    const nodesKeywords = new Map<string, Set<string>>();
    const uuidToTypeMap = new Map<string, string>();
    const globalKeywordCounts = new Map<string, number>();

    // 1. Global Keyword Census
    for (const node of allNodes) {
        const textContent = `${node.name} ${node.description}`;
        const keywords = _extractInitialKeywords(textContent);
        for (const keyword of keywords) {
            globalKeywordCounts.set(keyword, (globalKeywordCounts.get(keyword) || 0) + 1);
        }
    }

    // 2. Dynamic Stop Word Generation
    const sortedKeywords = Array.from(globalKeywordCounts.entries()).sort((a, b) => b[1] - a[1]);
    const numDynamicStops = Math.floor(sortedKeywords.length * COMMON_WORD_PERCENTILE_THRESHOLD);
    const dynamicStopWords = new Set(sortedKeywords.slice(0, numDynamicStops).map(entry => entry[0]));
    const finalStopWords = new Set([...BASE_STOP_WORDS, ...dynamicStopWords]);

    // 3. Significant Keyword Extraction
    for (const node of allNodes) {
        const textContent = `${node.name} ${node.description}`;
        const initialKeywords = _extractInitialKeywords(textContent);
        const significantKeywords = new Set([...initialKeywords].filter(kw => !finalStopWords.has(kw)));

        if (significantKeywords.size > 0) {
            nodesKeywords.set(node.id, significantKeywords);
        }
        uuidToTypeMap.set(node.id, node.type);
    }

    // 4. Inverted Indexing
    const invertedIndex = new Map<string, Set<string>>();
    for (const [uuid, keywords] of nodesKeywords.entries()) {
        for (const keyword of keywords) {
            if (!invertedIndex.has(keyword)) {
                invertedIndex.set(keyword, new Set());
            }
            invertedIndex.get(keyword)!.add(uuid);
        }
    }

    // 5. Link Generation
    const tempCrossrefs = new Map<string, { target_id: string; weight: number; relation: string; provenance: string[] }[]>();
    const processedPairs = new Set<string>();
    let maxWeight = 0;

    for (const uuids of invertedIndex.values()) {
        if (uuids.size > 1) {
            const uuidList = Array.from(uuids);
            for (let i = 0; i < uuidList.length; i++) {
                for (let j = i + 1; j < uuidList.length; j++) {
                    const [uuid1, uuid2] = [uuidList[i], uuidList[j]].sort();
                    const pairKey = `${uuid1}|${uuid2}`;

                    if (!processedPairs.has(pairKey)) {
                        processedPairs.add(pairKey);

                        const keywords1 = nodesKeywords.get(uuid1) || new Set();
                        const keywords2 = nodesKeywords.get(uuid2) || new Set();
                        const sharedKeywords = setIntersection(keywords1, keywords2);
                        const weight = sharedKeywords.size;

                        if (weight > maxWeight) maxWeight = weight;

                        if (weight >= MIN_SHARED_KEYWORDS_THRESHOLD) {
                            const provenance = Array.from(sharedKeywords).sort();
                            const type1 = uuidToTypeMap.get(uuid1) || "Unknown";
                            const type2 = uuidToTypeMap.get(uuid2) || "Unknown";

                            if (!tempCrossrefs.has(uuid1)) tempCrossrefs.set(uuid1, []);
                            if (!tempCrossrefs.has(uuid2)) tempCrossrefs.set(uuid2, []);

                            tempCrossrefs.get(uuid1)!.push({ target_id: uuid2, weight, relation: _inferRelationType(type1, type2), provenance });
                            tempCrossrefs.get(uuid2)!.push({ target_id: uuid1, weight, relation: _inferRelationType(type2, type1), provenance });
                        }
                    }
                }
            }
        }
    }

    // 6. Normalization & Pruning
    const finalCrossrefIndex: CrossRefIndex = {};
    for (const [uuid, links] of tempCrossrefs.entries()) {
        const processedLinks = links.map(link => {
            let confidence = 0;
            if (maxWeight > 0) {
                // Use Math.log1p for numerical stability (log(1+x))
                confidence = maxWeight > 1 ? Math.log1p(link.weight) / Math.log1p(maxWeight) : 1.0;
            }
            return {
                target_id: link.target_id,
                relation: link.relation,
                provenance: link.provenance,
                confidence: parseFloat(confidence.toFixed(3))
            };
        });

        processedLinks.sort((a, b) => b.confidence - a.confidence);
        finalCrossrefIndex[uuid] = processedLinks.slice(0, MAX_LINKS_PER_NODE);
    }

    console.log(`Generated cross-references for ${Object.keys(finalCrossrefIndex).length} nodes.`);
    return finalCrossrefIndex;
}

// --- EXPORT FUNCTIONS ---

/**
 * Creates a short SHA-256 hash of a string for filenames.
 * @param message The string to hash.
 * @returns An 8-character hexadecimal hash string.
 */
async function digestMessage(message: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 8);
}

/**
 * Cleans a string to be safe for use as a filename.
 * @param name The string to sanitize.
 */
function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/[^\w-]/g, ''); // Remove all non-word characters except hyphens
}

/**
 * Triggers a browser download for a Blob.
 * @param blob The data blob to download.
 * @param filename The desired filename for the download.
 */
function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Fetches all nodes and reconstructs the hierarchical tree.
 * @returns The root SourceJsonNode or null if the database is empty.
 */
async function getTreeAsSourceJson(): Promise<SourceJsonNode | null> {
    const flatNodes = await db.nodes.orderBy('sortOrder').toArray();
    if (flatNodes.length === 0) {
        return null;
    }

    const nodeMap = new Map<string, SourceJsonNode>();
    flatNodes.forEach(node => {
        nodeMap.set(node.id, {
            ID: node.id,
            Name: node.name,
            Type: node.type,
            Description: node.description,
            Items: [],
        });
    });

    let rootNode: SourceJsonNode | null = null;
    flatNodes.forEach(node => {
        const sourceNode = nodeMap.get(node.id)!;
        if (node.parentId) {
            const parentNode = nodeMap.get(node.parentId);
            if (parentNode) {
                parentNode.Items.push(sourceNode);
            }
        } else {
            rootNode = sourceNode;
        }
    });
    
    return rootNode;
}

/**
 * Generates and triggers a download for both the source.json and the crossref_index.json files.
 * @returns A promise that resolves with an array of the generated filenames.
 */
export async function exportAll(): Promise<string[]> {
    const exportedFilenames: string[] = [];

    // 1. Get the core data structure
    const rootNode = await getTreeAsSourceJson();
    if (!rootNode) {
        alert("Memory is empty. Nothing to export.");
        return []; // Return empty array if nothing was exported
    }

    // 2. Prepare and download the source.json
    const sourceJsonString = JSON.stringify(rootNode);
    const sourceHash = await digestMessage(sourceJsonString);
    const baseName = sanitizeFilename(rootNode.Name);
    const sourceFilename = `${baseName}-${sourceHash}.json`;
    const sourceBlob = new Blob([sourceJsonString], { type: "application/json" });
    triggerDownload(sourceBlob, sourceFilename);
    exportedFilenames.push(sourceFilename);

    // 3. Prepare and download the crossref_index.json
    const crossRefData = await generateCrossReferences();
    if (Object.keys(crossRefData).length > 0) {
        const crossrefJsonString = JSON.stringify(crossRefData);
        const crossrefHash = await digestMessage(crossrefJsonString);
        const crossrefFilename = `${baseName}-${sourceHash}-crossref-${crossrefHash}.json`;
        const crossrefBlob = new Blob([crossrefJsonString], { type: "application/json" });
        triggerDownload(crossrefBlob, crossrefFilename);
        exportedFilenames.push(crossrefFilename);
    } else {
        console.log("Skipping cross-reference export as there is not enough interconnected data.");
    }

    return exportedFilenames;
}

/**
 * Validates that the parsed data is a valid array of patch operations.
 */
function validatePatch(data: any): data is PatchOperation[] {
    if (!Array.isArray(data)) {
        throw new Error("Patch must be an array of operations.");
    }
    for (const op of data) {
        if (!op || typeof op !== 'object') throw new Error("Invalid operation format.");
        if (!['add', 'remove', 'replace'].includes(op.op)) throw new Error(`Invalid operation 'op': ${op.op}`);
        if (op.op === 'add' && (!op.parent_uuid || !op.node)) throw new Error("Add operation missing 'parent_uuid' or 'node'.");
        if (op.op === 'remove' && !op.uuid) throw new Error("Remove operation missing 'uuid'.");
        if (op.op === 'replace' && (!op.uuid || !op.field || op.value === undefined)) throw new Error("Replace operation missing 'uuid', 'field', or 'value'.");
    }
    return true;
}

/**
 * Recursively adds a node and its children from a patch object to the database.
 * @param nodeData The node data from the patch operation.
 * @param parentId The database ID of the parent for this new node.
 * @param sortOrder The sort order among its siblings.
 */
async function recursiveAddNode(
    nodeData: Omit<SourceJsonNode, 'ID' | 'Items'> & { Items?: SourceJsonNode[] },
    parentId: string | null,
    sortOrder: number
): Promise<void> {
    const newId = crypto.randomUUID();

    // 1. Create and add the current node
    await db.nodes.add({
        id: newId,
        parentId: parentId,
        name: nodeData.Name,
        type: nodeData.Type,
        description: nodeData.Description,
        sortOrder: sortOrder
    });

    // 2. If there are children, recursively call this function for each of them
    if (nodeData.Items && nodeData.Items.length > 0) {
        for (let i = 0; i < nodeData.Items.length; i++) {
            const child = nodeData.Items[i];
            await recursiveAddNode(child, newId, i);
        }
    }
}

/**
 * Reads a patch from the clipboard, validates it, and applies it to the database.
 */
export async function applyPatchFromClipboard(): Promise<void> {
    try {
        const clipboardText = await readText();
        const patchData = JSON.parse(clipboardText);

        if (validatePatch(patchData)) {
            await db.transaction('rw', db.nodes, async () => {
                for (const op of patchData) {
                    switch (op.op) {
                        case 'add':
                            const siblingCount = await db.nodes.where({ parentId: op.parent_uuid }).count();
                            await recursiveAddNode(op.node, op.parent_uuid, siblingCount);
                            break;
                        case 'remove':
                            // We use our existing recursive delete to ensure the whole subtree is removed
                            await deleteNodeAndChildren(op.uuid);
                            break;
                        case 'replace':
                            const fieldMapping = {
                                'Name': 'name',
                                'Type': 'type',
                                'Description': 'description'
                            };
                            const dbField = fieldMapping[op.field] as keyof Node;
                            if (!dbField) throw new Error(`Invalid field to replace: ${op.field}`);
                            await updateNode(op.uuid, { [dbField]: op.value });
                            break;
                    }
                }
            });
            alert(`Successfully applied ${patchData.length} operations from the patch.`);
        }
    } catch (error) {
        console.error("Failed to apply patch:", error);
        alert(`Failed to apply patch: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Fetches the default Agora.json from the static folder, processes it,
 * and replaces the entire database content. Used for initial seeding and resetting.
 */
export async function seedDatabaseWithAgora(): Promise<void> {
    try {
        const response = await fetch('/Agora.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch Agora.json: ${response.statusText}`);
        }
        const rootSourceNode: SourceJsonNode = await response.json();

        const flatNodes: Node[] = [];
        // Use the same robust processing function as import
        processImportedNode(rootSourceNode, null, 0, flatNodes);

        await db.transaction('rw', db.nodes, async () => {
            await db.nodes.clear();
            await db.nodes.bulkAdd(flatNodes);
        });

        console.log(`Successfully seeded database with ${flatNodes.length} nodes from Agora.json.`);

    } catch (error) {
        console.error("Failed to seed database from Agora.json:", error);
        alert("Error: Could not load the default Agora template. Make sure 'Agora.json' is in the /static folder.");
        throw error;
    }
}