import type { SupportBoundaryAssessment } from '../types/policy';
import type { TerminalOutcomeContract, TerminalOutcomeDefinition } from '../types/outcome';

const TERMINAL_OUTCOME_DEFINITIONS: TerminalOutcomeDefinition[] = [
    {
        id: 'success',
        title: 'Success',
        description: 'A supported candidate reached the success contract and the result is reproducible.'
    },
    {
        id: 'diagnosable-but-not-fixable',
        title: 'Diagnosable but not fixable',
        description: 'The system isolated the failure family or suspect set but has no safe next action left.'
    },
    {
        id: 'not-automatable-within-boundaries',
        title: 'Not automatable within boundaries',
        description: 'The scenario is outside the support boundary or requires an action blocked by trust policy.'
    }
];

function getTerminalOutcomeDefinitions(): TerminalOutcomeDefinition[] {
    return TERMINAL_OUTCOME_DEFINITIONS.map((definition) => ({ ...definition }));
}

function resolveTerminalOutcomeContract({
    supportBoundary,
    policyBlocked = false
}: {
    supportBoundary: SupportBoundaryAssessment;
    policyBlocked?: boolean;
}): TerminalOutcomeContract {
    if (supportBoundary.status === 'unsupported') {
        return {
            scenarioClass: 'outside-support-boundary',
            summary: 'Unsupported scenarios default to not-automatable-within-boundaries.',
            primaryOutcomes: ['not-automatable-within-boundaries'],
            reservedOutcomes: ['diagnosable-but-not-fixable'],
            definitions: getTerminalOutcomeDefinitions()
        };
    }

    if (policyBlocked) {
        return {
            scenarioClass: 'policy-blocked',
            summary: 'When a required step is blocked by trust policy, success is no longer a primary terminal outcome.',
            primaryOutcomes: ['diagnosable-but-not-fixable', 'not-automatable-within-boundaries'],
            reservedOutcomes: ['success'],
            definitions: getTerminalOutcomeDefinitions()
        };
    }

    return {
        scenarioClass: 'supported-path',
        summary: 'Supported Tier A scenarios primarily converge to success or diagnosable-but-not-fixable.',
        primaryOutcomes: ['success', 'diagnosable-but-not-fixable'],
        reservedOutcomes: ['not-automatable-within-boundaries'],
        definitions: getTerminalOutcomeDefinitions()
    };
}

module.exports = {
    getTerminalOutcomeDefinitions,
    resolveTerminalOutcomeContract
};
