// src/lib/colors.ts

export const DEFAULT_NODE_COLORS: { [key: string]: string } = {
    'Selected': '#e5534b',
    'Project': '#fdc349',
    'Concept': '#39c5cf',
    'Learning/Reflection': '#8cc37a',
    'Default': '#e6edf3'
};

export const DEFAULT_RELATIONSHIP_COLORS: { [key: string]: string } = {
    // Structural Links
    'is_child_of': '#6e7681',
    'has_child': '#6e7681',
    'is_sibling_of': '#6e7681',
    'is_ancestor_of': '#8b949e',
    'is_descendant_of': '#8b949e',
    'is_part_of': '#8b949e',
    'contains': '#8b949e',
    // Derivational & Causal
    'derived_from': '#3fb950',
    'is_source_of': '#3fb950',
    'distills': '#a371f7',
    'is_distilled_by': '#a371f7',
    'synthesizes': '#b392f0',
    'is_synthesized_by': '#b392f0',
    'produces': '#a371f7',
    // Project & Goal
    'addresses': '#58a6ff',
    'is_addressed_by': '#58a6ff',
    'fulfills': '#79c0ff',
    'is_fulfilled_by': '#79c0ff',
    'is_task_of': '#58a6ff',
    'contains_task': '#58a6ff',
    'marks_progress_for': '#79c0ff',
    // Conceptual & Definitional
    'is_concept_in': '#db61a2',
    'contains_concept': '#db61a2',
    'is_strategy_in': '#db61a2',
    'contains_strategy': '#db61a2',
    'is_principle_in': '#db61a2',
    'contains_principle': '#db61a2',
    'demonstrates': '#f778ba',
    'is_demonstrated_by': '#f778ba',
    // Influence & Modification
    'improves': '#ffab70',
    'is_improved_by': '#ffab70',
    'fixes': '#ffa270',
    'constrains': '#f85149',
    'is_constrained_by': '#f85149',
    'safeguards': '#3fb950',
    'is_safeguarded_by': '#3fb950',
    // Reference Links
    'references': '#39c5cf',
    'is_referenced_by': '#39c5cf',
    'explicitly_references': '#39c5cf',
    'points_to': '#39c5cf',
    'is_pointed_to_by': '#39c5cf',
    // Default Fallback
    'is_related_to': 'rgba(100, 100, 100, 0.5)'
};