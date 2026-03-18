import manualReviewOverridesApi from '../../review/manual-overrides.js';

import type {
    ManualReviewAction,
    ManualReviewOverrideMatch,
    ManualReviewOverridesFile,
    ManualReviewSubject
} from '../../review/manual-overrides.js';
import type { ReportDecisionSummary, RunReport } from '../../types/report.js';
import type { LoaderKind } from '../../types/metadata.js';

const { createManualReviewSubject, findManualReviewOverride } = manualReviewOverridesApi;

export type ReviewItemState = 'review' | 'keep' | 'exclude' | 'history';

export interface ReviewItem {
    id: string;
    decision: ReportDecisionSummary;
    subject: ManualReviewSubject;
    overrideMatch: ManualReviewOverrideMatch | null;
    currentOverrideAction: ManualReviewAction | null;
    lastRunOverrideAction: ManualReviewAction | null;
    state: ReviewItemState;
}

function requiresManualReview(decision: ReportDecisionSummary): boolean {
    return Boolean(decision.requiresReview || decision.finalSemanticDecision === 'review');
}

function hasManualReviewHistory(decision: ReportDecisionSummary): boolean {
    return Boolean(
        decision.manualOverrideAction
        || decision.finalDecisionOrigin === 'manual-review'
        || decision.decisionOrigin === 'manual-review'
    );
}

function normalizeLoaderKind(value: string | undefined): LoaderKind | undefined {
    return value === 'fabric' || value === 'quilt' || value === 'forge' || value === 'neoforge' || value === 'unknown'
        ? value
        : undefined;
}

function createDecisionSubject(decision: ReportDecisionSummary): ManualReviewSubject {
    const loader = normalizeLoaderKind(decision.descriptor?.loader);

    return createManualReviewSubject({
        fileName: decision.fileName,
        descriptor: {
            modIds: decision.modIds || decision.descriptor?.modIds || [],
            displayName: decision.displayName || decision.descriptor?.displayName || null,
            version: decision.descriptor?.version || null,
            ...(loader ? { loader } : {})
        }
    });
}

export function buildReviewItems(
    report: RunReport | null,
    overrides: ManualReviewOverridesFile
): ReviewItem[] {
    const decisions = report?.decisions || [];

    return decisions
        .filter((decision) => requiresManualReview(decision) || hasManualReviewHistory(decision))
        .map((decision) => {
            const subject = createDecisionSubject(decision);
            const overrideMatch = findManualReviewOverride(overrides, subject);
            const currentOverrideAction = overrideMatch?.entry.action ?? null;
            const lastRunOverrideAction = decision.manualOverrideAction ?? null;
            let state: ReviewItemState;

            if (currentOverrideAction === 'keep') {
                state = 'keep';
            } else if (currentOverrideAction === 'exclude') {
                state = 'exclude';
            } else if (requiresManualReview(decision)) {
                state = 'review';
            } else {
                state = 'history';
            }

            return {
                id: decision.manualReviewKey || subject.key,
                decision,
                subject,
                overrideMatch,
                currentOverrideAction,
                lastRunOverrideAction,
                state
            };
        });
}
