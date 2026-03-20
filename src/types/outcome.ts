export type TerminalOutcomeId =
    | 'success'
    | 'diagnosable-but-not-fixable'
    | 'not-automatable-within-boundaries';

export type TerminalOutcomeScenarioClass =
    | 'supported-path'
    | 'policy-blocked'
    | 'outside-support-boundary';

export interface TerminalOutcomeDefinition {
    id: TerminalOutcomeId;
    title: string;
    description: string;
}

export interface TerminalOutcomeContract {
    scenarioClass: TerminalOutcomeScenarioClass;
    summary: string;
    primaryOutcomes: TerminalOutcomeId[];
    reservedOutcomes: TerminalOutcomeId[];
    definitions: TerminalOutcomeDefinition[];
}
