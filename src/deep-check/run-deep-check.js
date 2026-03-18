const { finalizeDecision } = require('../build/decision-model');
const { createDeepCheckInput } = require('./input');
const { createEmptyDeepCheckSummary, DEEP_CHECK_STATUSES } = require('./constants');
const { applyDeepCheckResultToDecision, performDeepCheck } = require('./deep-check');
const { evaluateDeepCheckTrigger } = require('./trigger-policy');

function buildDeepCheckStats(decisions, mode) {
    const summary = createEmptyDeepCheckSummary(mode);

    for (const decision of decisions) {
        const deepCheck = decision.deepCheck;

        if (!deepCheck) {
            continue;
        }

        summary.statuses[deepCheck.status] += 1;
        summary.finalDecisions[decision.finalSemanticDecision] += 1;
        summary.confidence[decision.finalConfidence || 'none'] += 1;

        if (deepCheck.status === DEEP_CHECK_STATUSES.skipped) {
            summary.skipped += 1;
        } else {
            summary.triggered += 1;
        }

        if (deepCheck.status === DEEP_CHECK_STATUSES.resolvedKeep || deepCheck.status === DEEP_CHECK_STATUSES.resolvedRemove) {
            summary.resolved += 1;
        }

        if (deepCheck.status === DEEP_CHECK_STATUSES.stillReview || deepCheck.status === DEEP_CHECK_STATUSES.forceManual) {
            summary.unresolved += 1;
        }

        if (deepCheck.status === DEEP_CHECK_STATUSES.failed) {
            summary.failed += 1;
        }

        if (decision.deepCheckChangedDecision) {
            summary.decisionChanged += 1;
        }
    }

    return summary;
}

function createSkippedDeepCheck(trigger) {
    return {
        status: DEEP_CHECK_STATUSES.skipped,
        resolvedDecision: null,
        resolvedConfidence: 'none',
        requiresManualReview: false,
        reason: 'Deep-check was not triggered for this mod',
        reasons: ['Deep-check was not triggered for this mod'],
        evidence: [],
        triggerReasons: trigger.triggerReasons,
        warnings: [],
        errors: [],
        analysis: {
            archiveContent: null,
            entrypoints: null,
            mixins: null
        }
    };
}

function runDeepCheck({ decisions, runContext, record = () => {} }) {
    const updatedDecisions = decisions.map((decision) => {
        const input = createDeepCheckInput({
            decision,
            runContext
        });
        const trigger = evaluateDeepCheckTrigger(input);

        if (!trigger.shouldRun) {
            return finalizeDecision(decision, {
                deepCheck: createSkippedDeepCheck(trigger),
                deepCheckStatus: DEEP_CHECK_STATUSES.skipped,
                deepCheckDecision: null,
                deepCheckConfidence: 'none',
                deepCheckChangedDecision: false
            });
        }

        record('info', 'deep-check', `${decision.fileName}: deep-check started`);

        const result = performDeepCheck(input, trigger.triggerReasons);
        const updates = applyDeepCheckResultToDecision(decision, result, runContext.arbiterProfile);

        if (result.status === DEEP_CHECK_STATUSES.resolvedKeep || result.status === DEEP_CHECK_STATUSES.resolvedRemove) {
            record(
                'info',
                'deep-check',
                `${decision.fileName}: deep-check resolved ${result.resolvedDecision} (${result.resolvedConfidence})`
            );
        } else if (result.status === DEEP_CHECK_STATUSES.failed) {
            record('error', 'deep-check-error', `${decision.fileName}: deep-check failed`);
        } else {
            record('warn', 'deep-check-review', `${decision.fileName}: deep-check left the mod in review`);
        }

        return finalizeDecision(decision, updates);
    });

    return {
        decisions: updatedDecisions,
        report: {
            status: 'ok',
            mode: runContext.deepCheckMode,
            summary: buildDeepCheckStats(updatedDecisions, runContext.deepCheckMode),
            errors: []
        }
    };
}

module.exports = {
    buildDeepCheckStats,
    runDeepCheck
};
