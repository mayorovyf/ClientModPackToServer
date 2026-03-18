const { finalizeDecision } = require('../build/decision-model');
const { createArbiterInput } = require('./input');
const { arbitrateDecision } = require('./arbiter');

function runArbiter({ decisions, runContext, record = () => {} }) {
    const updatedDecisions = decisions.map((decision) => {
        const input = createArbiterInput({
            decision,
            runContext
        });
        const arbiter = arbitrateDecision(input);
        const nextBuildDecision = arbiter.recommendedBuildAction === 'exclude' ? 'exclude' : 'keep';

        if (arbiter.finalDecision === 'review') {
            record(
                'warn',
                'arbiter-review',
                `${decision.fileName}: escalated to review (${arbiter.finalConfidence})`
            );
        } else {
            record(
                'info',
                'arbiter',
                `${decision.fileName}: arbiter=${arbiter.finalDecision} (${arbiter.finalConfidence})`
            );
        }

        return finalizeDecision(decision, {
            arbiter,
            arbiterDecision: arbiter.finalDecision,
            arbiterConfidence: arbiter.finalConfidence,
            arbiterReasons: arbiter.reasons,
            arbiterWinningEvidence: arbiter.winningEvidence,
            finalSemanticDecision: arbiter.finalDecision,
            finalConfidence: arbiter.finalConfidence,
            finalDecisionOrigin: `arbiter:${arbiter.decisionOrigin}`,
            finalReasons: arbiter.reasons,
            requiresReview: arbiter.requiresReview,
            requiresDeepCheck: arbiter.requiresDeepCheck,
            decision: nextBuildDecision,
            reason: arbiter.reason,
            decisionOrigin: `arbiter:${arbiter.decisionOrigin}`
        });
    });

    return {
        decisions: updatedDecisions
    };
}

module.exports = {
    runArbiter
};
