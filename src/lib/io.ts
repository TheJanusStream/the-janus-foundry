// src/lib/io.ts
import { db, type Node, deleteNodeAndChildren, updateNode } from './db';
import { notify } from "$lib/notifications";
import { isTauri } from './utils';
import { base } from '$app/paths';
import { DEFAULT_NODE_COLORS, DEFAULT_RELATIONSHIP_COLORS } from './colors';

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

export interface CognitiveConfig {
    stopWords: Set<string>;
    relationshipVerbs: string[];
    inverseRelations: { [key: string]: string };
    typeRules: { [key: string]: string };
    systemRelations: { [key: string]: string }; // <-- NEW
    theme: {
        nodes: { [key: string]: string };
        relationships: { [key: string]: string };
    };
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

// --- DEFAULT FALLBACKS (Factory Settings) ---
const COMMON_WORD_PERCENTILE_THRESHOLD = 0.10;
const MIN_SHARED_KEYWORDS_THRESHOLD = 2;
const MAX_LINKS_PER_NODE = 7;

const DEFAULT_STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'of', 'for', 'to', 'with', 'is', 'was', 'were', 'it', 'that', 'as', 'by', 'from',
    'this', 'at', 'if', 'but', 'not', 'be', 'are', 'has', 'had', 'have', 'do', 'does', 'did', 'its', 'also', 'just', 'made',
    'new', 'like', 'use', 'used', 'using', 'get', 'set', 'make', 'all', 'any', 'most', 'other', 'some', 'such', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'can', 'will', 'should', 'could', 'would', 'must', 'may', 'might',
    'janus', 'kairos', 'codewright',
    'project', 'task', 'node', 'file', 'code', 'script', 'type', 'name', 'description', 'items', 'id', 'uuid',
    'system', 'data', 'information', 'process', 'based', 'via', 'core', 'value', 'user', 'agent', 'self', 'knowledge'
]);

const DEFAULT_REL_VERBS = [
    'improves', 'fixes', 'causes', 'relates', 'depends on', 'supports',
    'clarifies', 'constrains', 'expands', 'addresses', 'references',
    'reflects', 'contains', 'requires', 'produces', 'solves', 'alleviates',
    'fulfills', 'distills', 'synthesizes', 'demonstrates', 'safeguards'
];

const DEFAULT_INVERSE_RELATIONS: { [key: string]: string } = {
    'has_child': 'is_child_of',
    'is_child_of': 'has_child',
    'is_descendant_of': 'is_ancestor_of',
    'is_ancestor_of': 'is_descendant_of',
    'points_to': 'is_pointed_to_by',
    'is_pointed_to_by': 'points_to',
    'explicitly_references': 'is_referenced_by',
    'is_referenced_by': 'explicitly_references',
    'reflects_on': 'is_reflected_on_by',
    'is_reflected_on_by': 'reflects_on',
    'derived_from': 'is_source_of',
    'is_source_of': 'derived_from',
    'distills': 'is_distilled_by',
    'is_distilled_by': 'distills',
    'synthesizes': 'is_synthesized_by',
    'is_synthesized_by': 'synthesizes',
    'addresses': 'is_addressed_by',
    'is_addressed_by': 'addresses',
    'fulfills': 'is_fulfilled_by',
    'is_fulfilled_by': 'fulfills',
    'is_task_of': 'contains_task',
    'contains_task': 'is_task_of',
    'marks_progress_for': 'has_progress_marked_by',
    'has_progress_marked_by': 'marks_progress_for',
    'safeguards': 'is_safeguarded_by',
    'is_safeguarded_by': 'safeguards',
    'defines_usage_for': 'has_usage_defined_by',
    'has_usage_defined_by': 'defines_usage_for',
    'is_part_of': 'contains',
    'contains': 'is_part_of',
    'is_concept_in': 'contains_concept',
    'contains_concept': 'is_concept_in',
    'is_strategy_in': 'contains_strategy',
    'contains_strategy': 'is_strategy_in',
    'is_principle_in': 'contains_principle',
    'contains_principle': 'is_principle_in',
    'demonstrates': 'is_demonstrated_by',
    'is_demonstrated_by': 'demonstrates',
    'is_concept_for': 'has_concept',
    'has_concept': 'is_concept_for',
    'is_artifact_of': 'has_artifact',
    'has_artifact': 'is_artifact_of',
    'is_entry_in': 'contains_entry',
    'contains_entry': 'is_entry_in',
    'improves': 'is_improved_by',
    'is_improved_by': 'improves',
    'constrains': 'is_constrained_by',
    'is_constrained_by': 'constrains',
    'expands': 'is_expanded_by',
    'is_expanded_by': 'expands'
};

const DEFAULT_SYSTEM_RELATIONS: { [key: string]: string } = {
    is_child_of: 'is_child_of',
    has_child: 'has_child',
    is_sibling_of: 'is_sibling_of',
    is_descendant_of: 'is_descendant_of',
    is_ancestor_of: 'is_ancestor_of',
    explicitly_references: 'explicitly_references',
    is_referenced_by: 'is_referenced_by',
    points_to: 'points_to',
    is_pointed_to_by: 'is_pointed_to_by',
    default: 'is_related_to'
};

const DEFAULT_TYPE_RULES: { [key: string]: string } = {
    'ReflectionEntry->SessionSummaryEntry': 'reflects_on',
    'DistilledReflectionSummary->SessionSummaryEntry': 'reflects_on',
    'ReflectionEntry->DistilledSessionSummary': 'reflects_on',
    'DistilledReflectionSummary->DistilledSessionSummary': 'reflects_on',
    'LearningEntry->ReflectionEntry': 'derived_from',
    'DistilledLearningSummary->ReflectionEntry': 'derived_from',
    'LearningEntry->DistilledReflectionSummary': 'derived_from',
    'DistilledLearningSummary->DistilledReflectionSummary': 'derived_from',
    'LearningEntry->SessionSummaryEntry': 'derived_from',
    'DistilledLearningSummary->SessionSummaryEntry': 'derived_from',
    'LearningEntry->DistilledSessionSummary': 'derived_from',
    'DistilledLearningSummary->DistilledSessionSummary': 'derived_from',
    'LearningEntry->KnowledgeDomain': 'expands',
    'DistilledLearningSummary->KnowledgeDomain': 'expands',
    'Insight->ReflectionEntry': 'derived_from',
    'Insight->DistilledReflectionSummary': 'derived_from',
    'Insight->LearningEntry': 'distills',
    'Insight->DistilledLearningSummary': 'distills',
    'Insight->CrossModalLogEntry': 'synthesizes',
    'CooperativeProject->Goal': 'addresses',
    'CooperativeProject->MissionStatement': 'fulfills',
    'TaskEntry->CooperativeProject': 'is_task_of',
    'Milestone->CooperativeProject': 'marks_progress_for',
    'Limitation->Ability': 'constrains',
    'Challenge->CooperativeProject': 'is_challenge_for',
    'SafetyProtocol->Workflow': 'safeguards',
    'UsageProtocol->Tool': 'defines_usage_for',
    'Principle->GuidingPrinciples': 'is_part_of',
    'TheoreticalConcept->KnowledgeDomain': 'is_concept_in',
    'Strategy->KnowledgeDomain': 'is_strategy_in',
    'TechnicalPrinciple->KnowledgeDomain': 'is_principle_in',
    'SoftwareTool->ToolRegistry': 'is_registered_in',
    'Technology->TechnologyStack': 'is_part_of',
    'SystemArchitecture->ProjectKnowledge': 'describes_architecture_of',
    'CodeExample->TechnicalPrinciple': 'demonstrates',
    'CreativeConcept->CooperativeProject': 'is_concept_for',
    'FictionalEntry->CooperativeProject': 'is_artifact_of',
    'BestiaryEntry->FictionalEntry': 'is_entry_in',
};

// --- COGNITIVE ENGINE LOGIC ---

function extractInitialKeywords(textContent: string): Set<string> {
    return new Set(
        textContent
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2)
    );
}

function setIntersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    const intersection = new Set<T>();
    for (const elem of setB) {
        if (setA.has(elem)) {
            intersection.add(elem);
        }
    }
    return intersection;
}

function isAncestor(childId: string | null, potentialAncestorId: string, nodeMap: Map<string, Node>): boolean {
    let currentId = childId;
    while (currentId) {
        if (currentId === potentialAncestorId) {
            return true;
        }
        const parentNode = nodeMap.get(currentId);
        currentId = parentNode ? parentNode.parentId : null;
    }
    return false;
}

function inferRelationship(
    nodeA: Node,
    nodeB: Node,
    sharedKeywords: string[],
    nodeMap: Map<string, Node>,
    config: CognitiveConfig
): string {
    // 1. Structural Analysis (Intrinsic to DB)
    if (nodeA.parentId === nodeB.id) return config.systemRelations.is_child_of;
    if (nodeB.parentId === nodeA.id) return config.systemRelations.has_child;
    if (nodeA.parentId && nodeA.parentId === nodeB.parentId) return config.systemRelations.is_sibling_of;
    if (isAncestor(nodeA.id, nodeB.id, nodeMap)) return config.systemRelations.is_descendant_of;
    if (isAncestor(nodeB.id, nodeA.id, nodeMap)) return config.systemRelations.is_ancestor_of;

    // 2. Explicit Reference Parsing (Intrinsic to Content)
    if (nodeA.description.includes(nodeB.id)) return config.systemRelations.explicitly_references;
    if (nodeB.description.includes(nodeA.id)) return config.systemRelations.is_referenced_by;
    if (nodeA.type === 'ReferenceValue' && nodeA.description.trim() === nodeB.id) return config.systemRelations.points_to;
    if (nodeB.type === 'ReferenceValue' && nodeB.description.trim() === nodeA.id) return config.systemRelations.is_pointed_to_by;

    // 3. Dynamic Type-to-Type Logic
    const typeRuleKey1 = `${nodeA.type}->${nodeB.type}`;
    if (config.typeRules[typeRuleKey1]) return config.typeRules[typeRuleKey1];

    const typeRuleKey2 = `${nodeB.type}->${nodeA.type}`;
    if (config.typeRules[typeRuleKey2]) {
        const inverse = config.inverseRelations[config.typeRules[typeRuleKey2]];
        if (inverse) return inverse;
    }

    // 4. Dynamic Keyword-Based Verb Extraction
    const textA = (nodeA.name + ' ' + nodeA.description).toLowerCase();
    const sentencesA = textA.split('. ');
    for (const keyword of sharedKeywords) {
        for (const sentence of sentencesA) {
            if (sentence.includes(keyword)) {
                for (const verb of config.relationshipVerbs) {
                    if (sentence.includes(verb)) {
                        // Simple normalization: replace spaces with underscores
                        return verb.replace(/ /g, '_');
                    }
                }
            }
        }
    }

    // 5. Default Fallback
    return config.systemRelations.default;
}

/**
 * Fetches the cognitive configuration from the database nodes.
 * Falls back to hardcoded defaults if nodes are missing or corrupt.
 */
export async function fetchCognitiveConfig(): Promise<CognitiveConfig> {
    const config: CognitiveConfig = {
        stopWords: DEFAULT_STOP_WORDS,
        relationshipVerbs: DEFAULT_REL_VERBS,
        inverseRelations: DEFAULT_INVERSE_RELATIONS,
        typeRules: DEFAULT_TYPE_RULES,
        systemRelations: DEFAULT_SYSTEM_RELATIONS,
        theme: {
            nodes: DEFAULT_NODE_COLORS,
            relationships: DEFAULT_RELATIONSHIP_COLORS
        }
    };

    try {
        const configNodes = await db.nodes
            .where('type')
            .startsWith('SysConfig:')
            .toArray();

        for (const node of configNodes) {
            try {
                const content = JSON.parse(node.description);

                switch (node.type) {
                    case 'SysConfig:StopWords':
                        if (Array.isArray(content)) config.stopWords = new Set([...DEFAULT_STOP_WORDS, ...content]);
                        break;
                    case 'SysConfig:RelVerbs':
                        if (Array.isArray(content)) config.relationshipVerbs = content;
                        break;
                    case 'SysConfig:InverseMap':
                        config.inverseRelations = content;
                        break;
                    case 'SysConfig:TypeRules':
                        config.typeRules = content;
                        break;
                    case 'SysConfig:SystemRelations':
                        config.systemRelations = { ...DEFAULT_SYSTEM_RELATIONS, ...content };
                        break;
                    case 'SysConfig:Theme':
                        if (content.nodes) config.theme.nodes = content.nodes;
                        if (content.relationships) config.theme.relationships = content.relationships;
                        break;
                }
            } catch (parseErr) {
                console.warn(`Failed to parse config node ${node.name} (${node.type}). Using defaults.`, parseErr);
            }
        }
    } catch (err) {
        console.error("Error fetching cognitive config from DB. Using defaults.", err);
    }

    return config;
}

/**
 * Generates cross-references using the dynamic cognitive configuration.
 * Returns both the index and the theme for the store to use.
 */
export async function generateCrossReferences(): Promise<{ index: CrossRefIndex, theme: CognitiveConfig['theme'] }> {
    const allNodes = await db.nodes.toArray();
    const config = await fetchCognitiveConfig();

    if (allNodes.length < 2) return { index: {}, theme: config.theme };

    const nodesKeywords = new Map<string, Set<string>>();
    const uuidToNodeMap = new Map<string, Node>();
    const globalKeywordCounts = new Map<string, number>();

    allNodes.forEach(node => uuidToNodeMap.set(node.id, node));

    // 1. Global Keyword Census
    for (const node of allNodes) {
        const textContent = `${node.name} ${node.description}`;
        const keywords = extractInitialKeywords(textContent);
        for (const keyword of keywords) {
            globalKeywordCounts.set(keyword, (globalKeywordCounts.get(keyword) || 0) + 1);
        }
    }

    // 2. Dynamic Stop Word Generation
    const sortedKeywords = Array.from(globalKeywordCounts.entries()).sort((a, b) => b[1] - a[1]);
    const numDynamicStops = Math.floor(sortedKeywords.length * COMMON_WORD_PERCENTILE_THRESHOLD);
    const dynamicStopWords = new Set(sortedKeywords.slice(0, numDynamicStops).map(entry => entry[0]));
    // Merge dynamic stops with the Configured stop words
    const finalStopWords = new Set([...config.stopWords, ...dynamicStopWords]);

    // 3. Significant Keyword Extraction
    for (const node of allNodes) {
        const textContent = `${node.name} ${node.description}`;
        const initialKeywords = extractInitialKeywords(textContent);
        const significantKeywords = new Set([...initialKeywords].filter(kw => !finalStopWords.has(kw)));

        if (significantKeywords.size > 0) {
            nodesKeywords.set(node.id, significantKeywords);
        }
    }

    // 4. Inverted Indexing & Link Generation
    const tempCrossrefs = new Map<string, { target_id: string; weight: number; relation: string; provenance: string[] }[]>();
    const processedPairs = new Set<string>();
    let maxWeight = 0;

    const invertedIndex = new Map<string, Set<string>>();
    for (const [uuid, keywords] of nodesKeywords.entries()) {
        for (const keyword of keywords) {
            if (!invertedIndex.has(keyword)) {
                invertedIndex.set(keyword, new Set());
            }
            invertedIndex.get(keyword)!.add(uuid);
        }
    }

    for (const [uuid, keywords] of nodesKeywords.entries()) {
        const relatedDocs = new Set<string>();
        keywords.forEach(kw => {
            const docs = [...(invertedIndex.get(kw) || [])];
            docs.forEach(docId => relatedDocs.add(docId));
        });

        for (const otherUuid of relatedDocs) {
            if (uuid === otherUuid) continue;

            const [uuid1, uuid2] = [uuid, otherUuid].sort();
            const pairKey = `${uuid1}|${uuid2}`;
            if (processedPairs.has(pairKey)) continue;
            processedPairs.add(pairKey);

            const keywords1 = nodesKeywords.get(uuid1);
            const keywords2 = nodesKeywords.get(uuid2);

            if (keywords1 && keywords2) {
                const sharedKeywords = setIntersection(keywords1, keywords2);
                const weight = sharedKeywords.size;

                if (weight > maxWeight) maxWeight = weight;

                if (weight >= MIN_SHARED_KEYWORDS_THRESHOLD) {
                    const node1 = uuidToNodeMap.get(uuid1)!;
                    const node2 = uuidToNodeMap.get(uuid2)!;
                    const provenance = Array.from(sharedKeywords).sort();

                    // PASS CONFIG HERE
                    const relation = inferRelationship(node1, node2, provenance, uuidToNodeMap, config);

                    // Use Configured Inverse Map
                    const inverse = config.inverseRelations[relation] || relation;

                    if (!tempCrossrefs.has(uuid1)) tempCrossrefs.set(uuid1, []);
                    if (!tempCrossrefs.has(uuid2)) tempCrossrefs.set(uuid2, []);

                    tempCrossrefs.get(uuid1)!.push({ target_id: uuid2, weight, relation: relation, provenance });
                    tempCrossrefs.get(uuid2)!.push({ target_id: uuid1, weight, relation: inverse, provenance });
                }
            }
        }
    }

    // 5. Normalization & Pruning
    const finalCrossrefIndex: CrossRefIndex = {};
    for (const [uuid, links] of tempCrossrefs.entries()) {
        const processedLinks = links.map(link => {
            let confidence = 0;
            if (maxWeight > 0) {
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

    // Return BOTH the index and the loaded theme
    return { index: finalCrossrefIndex, theme: config.theme };
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
                    resolve();

                } catch (error) {
                    notify("Failed to parse or import the selected JSON file.", "error");
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                notify("Failed to read the selected file.", "error");
                reject(error);
            };

            reader.readAsText(file);
        };

        input.addEventListener('cancel', () => {
            document.body.removeChild(input);
            reject(new Error("File selection cancelled."));
        });

        input.click();
    });
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
        notify("Memory is empty. Nothing to export.", "error");
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
        notify("Skipping cross-reference export as there is not enough interconnected data.", "info");
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
 * This function is now environment-aware.
 */
export async function applyPatchFromClipboard(): Promise<void> {
    try {
        let clipboardText: string;

        if (isTauri()) {
            // Use Tauri's clipboard plugin when available
            const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
            clipboardText = await readText();
        } else {
            // Use the standard Web Clipboard API as a fallback
            clipboardText = await navigator.clipboard.readText();
        }

        const patchData = JSON.parse(clipboardText);

        if (validatePatch(patchData)) {
            await db.transaction('rw', db.nodes, async () => {
                for (const op of patchData) {
                    switch (op.op) {
                        case 'add':
                            const addSiblings = await db.nodes.where({ parentId: op.parent_uuid }).toArray();
                            const maxSortOrderAdd = addSiblings.reduce((max, node) => node.sortOrder > max ? node.sortOrder : max, -1);
                            const newSortOrderAdd = maxSortOrderAdd + 1;
                            await recursiveAddNode(op.node, op.parent_uuid, newSortOrderAdd);
                            break;
                        case 'remove':
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
            notify(`Successfully applied ${patchData.length} operations from the patch.`, "success");
        }
    } catch (error) {
        notify(`Failed to apply patch: ${error instanceof Error ? error.message : String(error)}`, "error");
        throw error;
    }
}

/**
 * Fetches the default Agora.json from the static folder, processes it,
 * and replaces the entire database content. Used for initial seeding and resetting.
 */
export async function seedDatabaseWithAgora(): Promise<void> {
    try {
        const response = await fetch(`${base}/Agora.json`);
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
    } catch (error) {
        notify("Could not load the default Agora template.", "error");
        throw error;
    }
}

/**
 * Helper to recursively build a hierarchical SourceJsonNode tree from a flat list of nodes.
 * @param nodeId The root ID of the subtree to build.
 * @param allNodesMap A map of all nodes in the subtree for efficient lookup.
 * @returns The constructed SourceJsonNode.
 */
function buildSourceTree(nodeId: string, allNodesMap: Map<string, Node>): SourceJsonNode {
    const node = allNodesMap.get(nodeId)!;
    const children = Array.from(allNodesMap.values())
        .filter(n => n.parentId === nodeId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    return {
        ID: node.id,
        Name: node.name,
        Type: node.type,
        Description: node.description,
        Items: children.map(child => buildSourceTree(child.id, allNodesMap))
    };
}

/**
 * Copies a node and its entire subtree to the clipboard in the SourceJsonNode format.
 * @param nodeId The ID of the node to copy.
 */
export async function copyNodeToClipboard(nodeId: string): Promise<void> {
    try {
        const subtreeNodes = new Map<string, Node>();
        const queue: string[] = [nodeId];
        const visited = new Set<string>([nodeId]);

        let head = 0;
        while (head < queue.length) {
            const currentId = queue[head++];
            const node = await db.nodes.get(currentId);
            if (node) {
                subtreeNodes.set(currentId, node);
                const children = await db.nodes.where('parentId').equals(currentId).toArray();
                for (const child of children) {
                    if (!visited.has(child.id)) {
                        visited.add(child.id);
                        queue.push(child.id);
                    }
                }
            }
        }

        if (subtreeNodes.size === 0) {
            throw new Error("Node not found in database.");
        }

        const sourceTree = buildSourceTree(nodeId, subtreeNodes);
        const jsonString = JSON.stringify(sourceTree, null, 2);

        if (isTauri()) {
            const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
            await writeText(jsonString);
        } else {
            await navigator.clipboard.writeText(jsonString);
        }

        notify(`Copied "${sourceTree.Name}" and its ${subtreeNodes.size - 1} children to clipboard.`, 'success');

    } catch (error) {
        notify(`Failed to copy node: ${error instanceof Error ? error.message : String(error)}`, "error");
        console.error(error);
    }
}

/**
 * Pastes a node structure from the clipboard as a child of the specified parent node.
 * @param parentId The ID of the node to paste under.
 */
export async function pasteNodeFromClipboard(parentId: string): Promise<void> {
    try {
        let clipboardText: string;
        if (isTauri()) {
            const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
            clipboardText = await readText();
        } else {
            clipboardText = await navigator.clipboard.readText();
        }

        if (!clipboardText) {
            throw new Error("Clipboard is empty.");
        }

        const nodeData: SourceJsonNode = JSON.parse(clipboardText);

        // Basic validation
        if (!nodeData.Name || !nodeData.Type || nodeData.Description === undefined || !nodeData.Items) {
            throw new Error("Clipboard content is not a valid node structure.");
        }

        await db.transaction('rw', db.nodes, async () => {
            const pasteSiblings = await db.nodes.where({ parentId: parentId }).toArray();
            const maxSortOrderPaste = pasteSiblings.reduce((max, node) => node.sortOrder > max ? node.sortOrder : max, -1);
            const newSortOrderPaste = maxSortOrderPaste + 1;
            await recursiveAddNode(nodeData, parentId, newSortOrderPaste);
        });

        notify(`Pasted "${nodeData.Name}" as a new child node.`, "success");

    } catch (error) {
        notify(`Failed to paste: ${error instanceof Error ? error.message : String(error)}`, "error");
        console.error(error);
    }
}