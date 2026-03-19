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

export interface DecisionReviewState {
    subject: ManualReviewSubject;
    overrideMatch: ManualReviewOverrideMatch | null;
    currentOverrideAction: ManualReviewAction | null;
    lastRunOverrideAction: ManualReviewAction | null;
    isConfirmed: boolean;
    state: ReviewItemState | 'resolved';
}

export interface ReviewItem {
    id: string;
    decision: ReportDecisionSummary;
    subject: ManualReviewSubject;
    overrideMatch: ManualReviewOverrideMatch | null;
    currentOverrideAction: ManualReviewAction | null;
    lastRunOverrideAction: ManualReviewAction | null;
    isConfirmed: boolean;
    state: ReviewItemState;
}

export function requiresManualReview(decision: ReportDecisionSummary): boolean {
    return Boolean(decision.requiresReview || decision.finalSemanticDecision === 'review');
}

export function hasManualReviewHistory(decision: ReportDecisionSummary): boolean {
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

export function createDecisionSubject(decision: ReportDecisionSummary): ManualReviewSubject {
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

export function buildDecisionReviewState(
    decision: ReportDecisionSummary,
    overrides: ManualReviewOverridesFile
): DecisionReviewState {
    const subject = createDecisionSubject(decision);
    const overrideMatch = findManualReviewOverride(overrides, subject);
    const currentOverrideAction = overrideMatch?.entry.action ?? null;
    const lastRunOverrideAction = decision.manualOverrideAction ?? null;
    const isConfirmed = Boolean(overrideMatch?.entry.confirmedAt);
    let state: DecisionReviewState['state'];

    if (currentOverrideAction === 'keep') {
        state = 'keep';
    } else if (currentOverrideAction === 'exclude') {
        state = 'exclude';
    } else if (requiresManualReview(decision)) {
        state = 'review';
    } else if (hasManualReviewHistory(decision)) {
        state = 'history';
    } else {
        state = 'resolved';
    }

    return {
        subject,
        overrideMatch,
        currentOverrideAction,
        lastRunOverrideAction,
        isConfirmed,
        state
    };
}

export function buildReviewItems(
    report: RunReport | null,
    overrides: ManualReviewOverridesFile
): ReviewItem[] {
    const decisions = report?.decisions || [];

    return decisions
        .filter((decision) => requiresManualReview(decision) || hasManualReviewHistory(decision))
        .map((decision) => {
            const reviewState = buildDecisionReviewState(decision, overrides);

            return {
                id: decision.manualReviewKey || reviewState.subject.key,
                decision,
                subject: reviewState.subject,
                overrideMatch: reviewState.overrideMatch,
                currentOverrideAction: reviewState.currentOverrideAction,
                lastRunOverrideAction: reviewState.lastRunOverrideAction,
                isConfirmed: reviewState.isConfirmed,
                state: reviewState.state === 'resolved' ? 'history' : reviewState.state
            };
        });
}
