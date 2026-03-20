import type { ValidationIssueKind } from '../../types/validation.js';
import type { RunReport } from '../../types/report.js';
import type { ResultModItem } from './results-mods.js';

export type ResultProblemKind = 'validation' | 'false-removal' | 'disputed-mod';
export type ResultProblemSeverity = 'blocking' | 'warning';

export interface ResultProblemItem {
    id: string;
    kind: ResultProblemKind;
    severity: ResultProblemSeverity;
    issueKind: ValidationIssueKind | null;
    title: string;
    subtitle: string;
    message: string;
    source: string;
    linkedFileNames: string[];
    linkedModIds: string[];
    suggestedAction: string;
}

export interface ResultProblemsSummary {
    total: number;
    blocking: number;
    warnings: number;
    validation: number;
    falseRemovals: number;
    disputedMods: number;
}

const BLOCKING_VALIDATION_ISSUE_KINDS = new Set<ValidationIssueKind>([
    'missing-dependency',
    'class-loading',
    'java-runtime',
    'launch-profile',
    'mixin-failure',
    'entrypoint-crash',
    'unknown-critical',
    'validation-no-success-marker'
]);

function compareResultProblems(left: ResultProblemItem, right: ResultProblemItem): number {
    const severityRank = left.severity === right.severity
        ? 0
        : left.severity === 'blocking'
            ? -1
            : 1;

    if (severityRank !== 0) {
        return severityRank;
    }

    return left.title.localeCompare(right.title)
        || left.subtitle.localeCompare(right.subtitle)
        || left.id.localeCompare(right.id);
}

function createProblemSubtitle(parts: Array<string | null | undefined>): string {
    const normalizedParts = parts
        .map((part) => String(part || '').trim())
        .filter(Boolean);

    return normalizedParts.join(' | ');
}

function createValidationProblemItems(report: RunReport): ResultProblemItem[] {
    const validationIssues = report.validation?.issues || [];

    return validationIssues.map((issue, index) => {
        const linkedFileNames = issue.linkedDecisions?.map((decision) => decision.fileName).filter(Boolean) || [];
        const linkedModIds = [...new Set([...issue.modIds, ...issue.suspectedModIds])];
        const severity: ResultProblemSeverity = BLOCKING_VALIDATION_ISSUE_KINDS.has(issue.kind) ? 'blocking' : 'warning';

        return {
            id: `validation:${issue.kind}:${index}`,
            kind: 'validation',
            severity,
            issueKind: issue.kind,
            title: issue.kind,
            subtitle: createProblemSubtitle([
                linkedFileNames[0],
                linkedModIds[0],
                issue.confidence
            ]),
            message: issue.message || issue.evidence || issue.kind,
            source: 'validation',
            linkedFileNames,
            linkedModIds,
            suggestedAction: linkedFileNames.length > 0
                ? 'Inspect linked mods and re-check final decisions.'
                : 'Inspect validation logs and linked issue context.'
        };
    });
}

function createFalseRemovalProblemItems(report: RunReport): ResultProblemItem[] {
    const suspectedFalseRemovals = report.validation?.suspectedFalseRemovals || [];

    return suspectedFalseRemovals.map((item, index) => ({
        id: `false-removal:${item.fileName}:${index}`,
        kind: 'false-removal',
        severity: 'warning',
        issueKind: item.issueKind,
        title: item.fileName,
        subtitle: createProblemSubtitle([
            item.issueKind,
            item.buildDecision || item.semanticDecision,
            item.matchedBy
        ]),
        message: item.reason,
        source: 'validation-linker',
        linkedFileNames: [item.fileName],
        linkedModIds: [],
        suggestedAction: 'Re-check this removal against validation output and dependency hints.'
    }));
}

function createDisputedModProblemItems(resultModItems: ResultModItem[]): ResultProblemItem[] {
    return resultModItems
        .filter((item) => item.isDisputed)
        .map((item) => ({
            id: `disputed:${item.id}`,
            kind: 'disputed-mod',
            severity: 'warning' as const,
            issueKind: null,
            title: item.primaryLabel,
            subtitle: createProblemSubtitle([
                item.decision.fileName,
                item.currentOverrideAction ? `draft:${item.currentOverrideAction}` : 'review',
                item.finalOrigin
            ]),
            message: item.decision.reason || 'This mod still requires a final manual decision.',
            source: 'manual-review',
            linkedFileNames: [item.decision.fileName],
            linkedModIds: item.modIds,
            suggestedAction: item.currentOverrideAction
                ? 'Confirm or clear the draft manual decision on the Mods page.'
                : 'Open the Mods page and choose keep or exclude.'
        }));
}

export function buildResultProblems({
    report,
    resultModItems
}: {
    report: RunReport | null;
    resultModItems: ResultModItem[];
}): {
    items: ResultProblemItem[];
    summary: ResultProblemsSummary;
} {
    if (!report) {
        return {
            items: [],
            summary: {
                total: 0,
                blocking: 0,
                warnings: 0,
                validation: 0,
                falseRemovals: 0,
                disputedMods: 0
            }
        };
    }

    const validationItems = createValidationProblemItems(report);
    const falseRemovalItems = createFalseRemovalProblemItems(report);
    const disputedItems = createDisputedModProblemItems(resultModItems);
    const items = [...validationItems, ...falseRemovalItems, ...disputedItems].sort(compareResultProblems);
    const blocking = items.filter((item) => item.severity === 'blocking').length;

    return {
        items,
        summary: {
            total: items.length,
            blocking,
            warnings: items.length - blocking,
            validation: validationItems.length,
            falseRemovals: falseRemovalItems.length,
            disputedMods: disputedItems.length
        }
    };
}
