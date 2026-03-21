import type { BackendEvent } from '../../types/events.js';
import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';
import type { BuildLogMode, RunFormState, RunSessionState } from './app-state.js';
import type { RunPreflightSummary } from './run-preflight.js';

export type BuildLogItemStatus = 'pending' | 'running' | 'completed' | 'failed' | 'warning';

export interface BuildLogItem {
    id: string;
    kind: 'plan' | 'event';
    title: string;
    subtitle: string;
    description: string;
    status: BuildLogItemStatus;
    timestamp: string | null;
    sourceLabel: string;
    dataLines: string[];
}

const STAGE_IDS = [
    'preflight',
    'classification',
    'dependency',
    'arbiter',
    'deep-check',
    'probe',
    'build',
    'server-core',
    'validation',
    'report'
] as const;

const TRACKED_EVENT_TYPES = new Set([
    'run.started',
    'registry.loaded',
    'stage.started',
    'stage.completed',
    'stage.activity',
    'mod.parsed',
    'classification.completed',
    'dependency.analysis.completed',
    'arbiter.review-found',
    'deep-check.completed',
    'validation.completed',
    'build.action.completed',
    'convergence.candidate.started',
    'convergence.plan.selected',
    'convergence.candidate.completed',
    'convergence.terminal-outcome',
    'report.written',
    'run.finished',
    'run.failed'
]);

const COMPACT_HIDDEN_EVENT_TYPES = new Set<BackendEvent['type']>([
    'mod.parsed',
    'build.action.completed'
]);

function getStageLabel(stageId: string, t: Translator<MessageKey>): string {
    switch (stageId) {
        case 'preflight':
            return t('buildLog.plan.preflight');
        case 'classification':
            return t('buildLog.plan.classification');
        case 'dependency':
            return t('buildLog.plan.dependency');
        case 'arbiter':
            return t('buildLog.plan.arbiter');
        case 'deep-check':
            return t('buildLog.plan.deepCheck');
        case 'probe':
            return t('buildLog.plan.probe');
        case 'build':
            return t('buildLog.plan.build');
        case 'server-core':
            return t('buildLog.plan.serverCore');
        case 'validation':
            return t('buildLog.plan.validation');
        case 'report':
            return t('buildLog.plan.report');
        default:
            return stageId;
    }
}

function getStageDescription(stageId: string, t: Translator<MessageKey>): string {
    switch (stageId) {
        case 'preflight':
            return t('buildLog.description.preflight');
        case 'classification':
            return t('buildLog.description.classification');
        case 'dependency':
            return t('buildLog.description.dependency');
        case 'arbiter':
            return t('buildLog.description.arbiter');
        case 'deep-check':
            return t('buildLog.description.deepCheck');
        case 'probe':
            return t('buildLog.description.probe');
        case 'build':
            return t('buildLog.description.build');
        case 'server-core':
            return t('buildLog.description.serverCore');
        case 'validation':
            return t('buildLog.description.validation');
        case 'report':
            return t('buildLog.description.report');
        default:
            return t('buildLog.description.default');
    }
}

function formatStatus(status: BuildLogItemStatus, t: Translator<MessageKey>): string {
    switch (status) {
        case 'running':
            return t('buildLog.item.running');
        case 'completed':
            return t('buildLog.item.completed');
        case 'failed':
            return t('buildLog.item.failed');
        case 'warning':
            return t('buildLog.item.warning');
        case 'pending':
        default:
            return t('buildLog.item.pending');
    }
}

function formatTimestamp(value: string | null): string {
    if (!value) {
        return '';
    }

    const normalized = String(value).replace('T', ' ').replace(/\.\d+Z$/, 'Z');
    return normalized;
}

function humanizeKey(key: string): string {
    return key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stringifyValue(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return null;
        }

        const scalarValues = value.filter((item) => ['string', 'number', 'boolean'].includes(typeof item));
        return scalarValues.length === value.length
            ? scalarValues.join(', ')
            : `${value.length}`;
    }

    if (typeof value === 'object') {
        return null;
    }

    return String(value);
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function compactParts(parts: Array<string | null | undefined>): string {
    return parts
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(' | ');
}

function formatCountPart(label: string, value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${label} ${value}`;
    }

    if (typeof value === 'string' && value.trim()) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
            return `${label} ${value.trim()}`;
        }
    }

    return null;
}

function summarizeDecisionCounts(value: unknown): string | null {
    const counts = readRecord(value);

    if (!counts) {
        return null;
    }

    return compactParts([
        formatCountPart('keep', counts.keep),
        formatCountPart('remove', counts.remove),
        formatCountPart('review', counts.review)
    ]);
}

function summarizeConfidence(value: unknown): string | null {
    const confidence = readRecord(value);

    if (!confidence) {
        return stringifyValue(value);
    }

    const parts = Object.entries(confidence)
        .map(([key, count]) => formatCountPart(key, count))
        .filter((part): part is string => Boolean(part));

    return parts.length > 0 ? parts.join(', ') : null;
}

function getPayloadStatus(payload: Record<string, unknown>): string | null {
    const summary = readRecord(payload.summary);
    return stringifyValue(payload.status) || (summary ? stringifyValue(summary.status) : null);
}

function createDataLinesFromObject(source: Record<string, unknown>, prefix = ''): string[] {
    const lines: string[] = [];

    for (const [key, rawValue] of Object.entries(source)) {
        if (rawValue === null || rawValue === undefined || rawValue === '' || key === 'stage') {
            continue;
        }

        const label = prefix ? `${prefix}.${humanizeKey(key)}` : humanizeKey(key);
        const scalarValue = stringifyValue(rawValue);

        if (scalarValue) {
            lines.push(`${label}: ${scalarValue}`);
            continue;
        }

        if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
            lines.push(...createDataLinesFromObject(rawValue as Record<string, unknown>, label));
        }
    }

    return lines;
}

function getPlanItems({
    form,
    preflight,
    t
}: {
    form: RunFormState;
    preflight: RunPreflightSummary | null;
    t: Translator<MessageKey>;
}): BuildLogItem[] {
    const blockerCount = preflight?.errors ?? 0;
    const warningCount = preflight?.warnings ?? 0;
    const preflightStatus: BuildLogItemStatus = blockerCount > 0
        ? 'failed'
        : warningCount > 0
            ? 'warning'
            : 'completed';

    const items: BuildLogItem[] = [
        {
            id: 'plan:preflight',
            kind: 'plan',
            title: getStageLabel('preflight', t),
            subtitle: t('buildLog.plan.preflightState', { blockers: blockerCount, warnings: warningCount }),
            description: getStageDescription('preflight', t),
            status: preflightStatus,
            timestamp: null,
            sourceLabel: 'preflight',
            dataLines: [
                `input path: ${form.inputPath || '<empty>'}`,
                `output path: ${form.outputPath || '<default>'}`,
                `report dir: ${form.reportDir || '<default>'}`
            ]
        }
    ];

    for (const stageId of STAGE_IDS.slice(1)) {
        const status: BuildLogItemStatus = stageId === 'validation' && form.validationMode === 'off'
            ? 'warning'
            : 'pending';
        const subtitle = stageId === 'validation' && form.validationMode === 'off'
            ? t('buildLog.plan.validationDisabled')
            : t('buildLog.plan.waiting');

        items.push({
            id: `plan:${stageId}`,
            kind: 'plan',
            title: getStageLabel(stageId, t),
            subtitle,
            description: getStageDescription(stageId, t),
            status,
            timestamp: null,
            sourceLabel: stageId,
            dataLines: []
        });
    }

    return items;
}

function createEventItem(event: BackendEvent, t: Translator<MessageKey>): BuildLogItem | null {
    const timestamp = formatTimestamp(event.timestamp);

    switch (event.type) {
        case 'run.started':
            return {
                id: `${event.timestamp}:run.started`,
                kind: 'event',
                title: t('buildLog.event.runStarted'),
                subtitle: timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.runStarted'),
                status: 'completed',
                timestamp,
                sourceLabel: 'run.started',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'registry.loaded':
            return {
                id: `${event.timestamp}:registry.loaded`,
                kind: 'event',
                title: t('buildLog.event.registryLoaded'),
                subtitle: stringifyValue(event.payload.sourceDescription) || stringifyValue(event.payload.source) || timestamp,
                description: t('buildLog.description.registryLoaded'),
                status: 'completed',
                timestamp,
                sourceLabel: 'registry.loaded',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'stage.started': {
            const stageId = typeof event.payload.stage === 'string' ? event.payload.stage : 'unknown';
            return {
                id: `${event.timestamp}:stage.started:${stageId}`,
                kind: 'event',
                title: `${t('buildLog.event.stageStarted')}: ${getStageLabel(stageId, t)}`,
                subtitle: t('buildLog.event.stageStartedSubtitle'),
                description: getStageDescription(stageId, t),
                status: 'running',
                timestamp,
                sourceLabel: 'stage.started',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        }
        case 'stage.completed': {
            const stageId = typeof event.payload.stage === 'string' ? event.payload.stage : 'unknown';
            const hasSkipReason = Boolean(stringifyValue(event.payload.skipReason));
            const failed = String(event.payload.status || '').toLowerCase() === 'failed';
            const status: BuildLogItemStatus = failed ? 'failed' : (hasSkipReason ? 'warning' : 'completed');
            const subtitle = stringifyValue(event.payload.skipReason)
                || stringifyValue((event.payload.summary as Record<string, unknown> | null)?.status)
                || t('buildLog.event.stageCompletedSubtitle');

            return {
                id: `${event.timestamp}:stage.completed:${stageId}`,
                kind: 'event',
                title: `${t('buildLog.event.stageCompleted')}: ${getStageLabel(stageId, t)}`,
                subtitle,
                description: getStageDescription(stageId, t),
                status,
                timestamp,
                sourceLabel: 'stage.completed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        }
        case 'stage.activity': {
            const stageId = typeof event.payload.stage === 'string' ? event.payload.stage : 'unknown';
            const message = stringifyValue(event.payload.message);

            return {
                id: `${event.timestamp}:stage.activity:${stageId}:${message || 'activity'}`,
                kind: 'event',
                title: `${getStageLabel(stageId, t)}: ${t('buildLog.event.stageActivity')}`,
                subtitle: message || timestamp || t('buildLog.item.running'),
                description: t('buildLog.description.stageActivity'),
                status: 'running',
                timestamp,
                sourceLabel: 'stage.activity',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        }
        case 'mod.parsed': {
            const fileName = stringifyValue(event.payload.fileName) || t('buildLog.event.modParsed');
            const hasConflict = Boolean(event.payload.hasConflict);
            const index = stringifyValue(event.payload.index);
            const total = stringifyValue(event.payload.total);
            return {
                id: `${event.timestamp}:mod.parsed:${fileName}`,
                kind: 'event',
                title: `${t('buildLog.event.modParsed')}: ${fileName}`,
                subtitle: compactParts([
                    index && total ? `${index}/${total}` : null,
                    stringifyValue(event.payload.loader),
                    stringifyValue(event.payload.classificationDecision),
                    stringifyValue(event.payload.winningEngine),
                    hasConflict ? 'conflict' : null
                ]) || timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.modParsed'),
                status: hasConflict ? 'warning' : 'completed',
                timestamp,
                sourceLabel: 'mod.parsed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        }
        case 'classification.completed':
            return {
                id: `${event.timestamp}:classification.completed`,
                kind: 'event',
                title: t('buildLog.event.classificationCompleted'),
                subtitle: compactParts([
                    summarizeDecisionCounts(event.payload.finalDecisions),
                    formatCountPart('conflicts', event.payload.conflicts),
                    formatCountPart('fallback', event.payload.fallbackFinalDecisions)
                ]) || timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.classificationCompleted'),
                status: 'completed',
                timestamp,
                sourceLabel: 'classification.completed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'dependency.analysis.completed':
            return {
                id: `${event.timestamp}:dependency.analysis.completed`,
                kind: 'event',
                title: t('buildLog.event.dependencyAnalysisCompleted'),
                subtitle: compactParts([
                    getPayloadStatus(event.payload as Record<string, unknown>),
                    formatCountPart('warnings', readRecord(event.payload.summary)?.warnings),
                    formatCountPart('errors', readRecord(event.payload.summary)?.errors)
                ]) || timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.dependencyAnalysisCompleted'),
                status: getPayloadStatus(event.payload as Record<string, unknown>) === 'failed' ? 'failed' : 'completed',
                timestamp,
                sourceLabel: 'dependency.analysis.completed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'arbiter.review-found':
            return {
                id: `${event.timestamp}:arbiter.review-found`,
                kind: 'event',
                title: t('buildLog.event.arbiterReviewFound'),
                subtitle: compactParts([
                    formatCountPart('review', event.payload.reviewCount),
                    summarizeConfidence(event.payload.confidence)
                ]) || timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.arbiterReviewFound'),
                status: Number(event.payload.reviewCount || 0) > 0 ? 'warning' : 'completed',
                timestamp,
                sourceLabel: 'arbiter.review-found',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'deep-check.completed':
            return {
                id: `${event.timestamp}:deep-check.completed`,
                kind: 'event',
                title: t('buildLog.event.deepCheckCompleted'),
                subtitle: compactParts([
                    getPayloadStatus(event.payload as Record<string, unknown>),
                    formatCountPart('review', readRecord(event.payload.summary)?.review),
                    formatCountPart('changed', readRecord(event.payload.summary)?.changed)
                ]) || timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.deepCheckCompleted'),
                status: getPayloadStatus(event.payload as Record<string, unknown>) === 'failed' ? 'failed' : 'completed',
                timestamp,
                sourceLabel: 'deep-check.completed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'validation.completed': {
            const status = getPayloadStatus(event.payload as Record<string, unknown>);
            const skipReason = stringifyValue(event.payload.skipReason);
            const failed = status === 'failed';
            return {
                id: `${event.timestamp}:validation.completed`,
                kind: 'event',
                title: t('buildLog.event.validationCompleted'),
                subtitle: compactParts([
                    status,
                    skipReason
                ]) || timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.validationCompleted'),
                status: failed ? 'failed' : (skipReason ? 'warning' : 'completed'),
                timestamp,
                sourceLabel: 'validation.completed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        }
        case 'build.action.completed': {
            const fileName = stringifyValue(event.payload.fileName) || t('buildLog.event.buildAction');
            const actionStatus = String(event.payload.actionStatus || '').toLowerCase();
            const status: BuildLogItemStatus = actionStatus === 'error' || Boolean(stringifyValue(event.payload.error))
                ? 'failed'
                : 'completed';
            const decision = compactParts([
                stringifyValue(event.payload.actionStatus),
                stringifyValue(event.payload.decision) || stringifyValue(event.payload.finalSemanticDecision),
                stringifyValue(event.payload.decisionOrigin)
            ]) || t('buildLog.event.buildAction');

            return {
                id: `${event.timestamp}:build.action.completed:${fileName}`,
                kind: 'event',
                title: `${t('buildLog.event.buildAction')}: ${fileName}`,
                subtitle: decision,
                description: t('buildLog.description.buildAction'),
                status,
                timestamp,
                sourceLabel: 'build.action.completed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        }
        case 'convergence.candidate.started':
            return {
                id: `${event.timestamp}:convergence.candidate.started:${stringifyValue(event.payload.candidateId) || 'candidate'}`,
                kind: 'event',
                title: t('buildLog.event.convergenceCandidateStarted'),
                subtitle: compactParts([
                    stringifyValue(event.payload.candidateId),
                    stringifyValue(event.payload.iteration) ? `iter ${stringifyValue(event.payload.iteration)}` : null,
                    stringifyValue(event.payload.loopStage)
                ]) || timestamp || t('buildLog.item.running'),
                description: t('buildLog.description.convergenceCandidateStarted'),
                status: 'running',
                timestamp,
                sourceLabel: 'convergence.candidate.started',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'convergence.plan.selected':
            return {
                id: `${event.timestamp}:convergence.plan.selected:${stringifyValue(event.payload.nextCandidateId) || 'plan'}`,
                kind: 'event',
                title: t('buildLog.event.convergencePlanSelected'),
                subtitle: compactParts([
                    stringifyValue(event.payload.candidateId),
                    stringifyValue(event.payload.nextCandidateId),
                    stringifyValue(event.payload.newlyAppliedFixKinds)
                ]) || timestamp || t('buildLog.item.running'),
                description: t('buildLog.description.convergencePlanSelected'),
                status: 'running',
                timestamp,
                sourceLabel: 'convergence.plan.selected',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'convergence.candidate.completed': {
            const outcomeStatus = stringifyValue(event.payload.outcomeStatus);

            return {
                id: `${event.timestamp}:convergence.candidate.completed:${stringifyValue(event.payload.candidateId) || 'candidate'}`,
                kind: 'event',
                title: t('buildLog.event.convergenceCandidateCompleted'),
                subtitle: compactParts([
                    stringifyValue(event.payload.candidateId),
                    outcomeStatus,
                    stringifyValue(event.payload.failureFamily)
                ]) || timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.convergenceCandidateCompleted'),
                status: outcomeStatus === 'passed' ? 'completed' : 'warning',
                timestamp,
                sourceLabel: 'convergence.candidate.completed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        }
        case 'convergence.terminal-outcome': {
            const terminalOutcomeId = stringifyValue(event.payload.terminalOutcomeId);

            return {
                id: `${event.timestamp}:convergence.terminal-outcome:${terminalOutcomeId || 'terminal-outcome'}`,
                kind: 'event',
                title: t('buildLog.event.convergenceTerminalOutcome'),
                subtitle: compactParts([
                    terminalOutcomeId,
                    formatCountPart('candidates', event.payload.candidateCount)
                ]) || timestamp || t('buildLog.item.completed'),
                description: t('buildLog.description.convergenceTerminalOutcome'),
                status: terminalOutcomeId === 'success' ? 'completed' : 'failed',
                timestamp,
                sourceLabel: 'convergence.terminal-outcome',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        }
        case 'report.written':
            return {
                id: `${event.timestamp}:report.written`,
                kind: 'event',
                title: t('buildLog.event.reportWritten'),
                subtitle: stringifyValue(event.payload.reportDir) || timestamp,
                description: t('buildLog.description.reportWritten'),
                status: 'completed',
                timestamp,
                sourceLabel: 'report.written',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'run.finished':
            return {
                id: `${event.timestamp}:run.finished`,
                kind: 'event',
                title: t('buildLog.event.runFinished'),
                subtitle: compactParts([
                    formatCountPart('keep', event.payload.kept),
                    formatCountPart('exclude', event.payload.excluded),
                    formatCountPart('errors', event.payload.errors)
                ]) || t('buildLog.event.runFinishedSubtitle'),
                description: t('buildLog.description.runFinished'),
                status: 'completed',
                timestamp,
                sourceLabel: 'run.finished',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        case 'run.failed':
            return {
                id: `${event.timestamp}:run.failed`,
                kind: 'event',
                title: t('buildLog.event.runFailed'),
                subtitle: stringifyValue(event.payload.message) || t('buildLog.event.runFailedSubtitle'),
                description: t('buildLog.description.runFailed'),
                status: 'failed',
                timestamp,
                sourceLabel: 'run.failed',
                dataLines: createDataLinesFromObject(event.payload as Record<string, unknown>)
            };
        default:
            return null;
    }
}

interface CompactLogState {
    items: BuildLogItem[];
    itemIndexById: Map<string, number>;
    currentCandidateScopeKey: string | null;
    currentStageItemId: string | null;
    currentStageId: string | null;
    stageSequenceByScope: Map<string, number>;
    latestStageItemIdByStage: Map<string, string>;
    candidateItemIdByCandidateId: Map<string, string>;
    pendingPlanSummaryByCandidateId: Map<string, string>;
}

function createCompactLogState(): CompactLogState {
    return {
        items: [],
        itemIndexById: new Map(),
        currentCandidateScopeKey: null,
        currentStageItemId: null,
        currentStageId: null,
        stageSequenceByScope: new Map(),
        latestStageItemIdByStage: new Map(),
        candidateItemIdByCandidateId: new Map(),
        pendingPlanSummaryByCandidateId: new Map()
    };
}

function appendCompactItem(state: CompactLogState, item: BuildLogItem): void {
    state.itemIndexById.set(item.id, state.items.length);
    state.items.push(item);
}

function upsertCompactItem(
    state: CompactLogState,
    item: BuildLogItem,
    updater?: (current: BuildLogItem) => BuildLogItem
): void {
    const existingIndex = state.itemIndexById.get(item.id);

    if (existingIndex === undefined) {
        appendCompactItem(state, item);
        return;
    }

    state.items[existingIndex] = updater ? updater(state.items[existingIndex]!) : item;
}

function patchCompactItem(
    state: CompactLogState,
    itemId: string | null,
    updater: (current: BuildLogItem) => BuildLogItem
): void {
    if (!itemId) {
        return;
    }

    const existingIndex = state.itemIndexById.get(itemId);

    if (existingIndex === undefined) {
        return;
    }

    state.items[existingIndex] = updater(state.items[existingIndex]!);
}

function formatStageQueueLabel(stageId: string, payload: Record<string, unknown>): string | null {
    switch (stageId) {
        case 'classification':
        case 'dependency':
        case 'arbiter':
        case 'deep-check':
        case 'probe':
            return typeof payload.total === 'number' && Number.isFinite(payload.total)
                ? `${payload.total} mods`
                : null;
        case 'build':
        case 'server-core':
        case 'validation':
            return typeof payload.total === 'number' && Number.isFinite(payload.total)
                ? `${payload.total} actions`
                : null;
        default:
            return null;
    }
}

function createCompactStageStartedSubtitle(stageId: string, payload: Record<string, unknown>): string {
    return compactParts([
        formatStageQueueLabel(stageId, payload),
        stringifyValue(payload.profile) ? `profile ${stringifyValue(payload.profile)}` : null,
        stringifyValue(payload.mode) ? `mode ${stringifyValue(payload.mode)}` : null,
        typeof payload.dryRun === 'boolean' ? (payload.dryRun ? 'dry-run' : 'build output') : null,
        typeof payload.enabled === 'boolean' ? (payload.enabled ? 'enabled' : 'disabled') : null
    ]);
}

function createCompactModActivitySubtitle(payload: Record<string, unknown>): string {
    const index = stringifyValue(payload.index);
    const total = stringifyValue(payload.total);

    return compactParts([
        stringifyValue(payload.fileName),
        index && total ? `${index}/${total}` : null,
        stringifyValue(payload.loader),
        stringifyValue(payload.classificationDecision),
        stringifyValue(payload.winningEngine),
        Boolean(payload.hasConflict) ? 'conflict' : null
    ]);
}

function createCompactBuildActivitySubtitle(payload: Record<string, unknown>): string {
    const index = stringifyValue(payload.index);
    const total = stringifyValue(payload.total);

    return compactParts([
        stringifyValue(payload.fileName),
        index && total ? `${index}/${total}` : null,
        stringifyValue(payload.actionStatus),
        stringifyValue(payload.decision) || stringifyValue(payload.finalSemanticDecision),
        stringifyValue(payload.decisionOrigin)
    ]);
}

function createCompactStageActivitySubtitle(payload: Record<string, unknown>): string | null {
    const fileName = stringifyValue(payload.fileName);
    const index = stringifyValue(payload.index);
    const total = stringifyValue(payload.total);
    const progressPart = fileName && index && total ? `${fileName} (${index}/${total})` : fileName;
    const activityType = stringifyValue(payload.activityType);

    switch (activityType) {
        case 'mod-parse':
            return compactParts([
                'Parsing',
                progressPart
            ]);
        case 'build-copy':
            return compactParts([
                'Copying',
                progressPart
            ]);
        case 'build-reuse':
            return compactParts([
                'Reusing',
                progressPart
            ]);
        case 'build-restore':
            return compactParts([
                'Restoring from stash',
                progressPart
            ]);
        case 'build-exclude':
            return compactParts([
                'Excluding',
                progressPart
            ]);
        case 'build-would-copy':
            return compactParts([
                'Would copy',
                progressPart
            ]);
        case 'build-would-exclude':
            return compactParts([
                'Would exclude',
                progressPart
            ]);
        case 'probe-step':
            return compactParts([
                'Probing',
                progressPart,
                typeof payload.supportCount === 'number' ? `${payload.supportCount} support jars` : null
            ]);
        case 'server-core-install':
        case 'server-core-install-attempt':
            return compactParts([
                stringifyValue(payload.message),
                stringifyValue(payload.coreType),
                stringifyValue(payload.minecraftVersion),
                stringifyValue(payload.loaderVersion)
            ]);
        case 'sandbox':
        case 'entrypoint-resolution':
        case 'process-launch':
        case 'result-analysis':
            return stringifyValue(payload.message);
        default:
            return stringifyValue(payload.message);
    }
}

function createCompactActivityDataLines(payload: Record<string, unknown>, keys: string[]): string[] {
    return keys
        .map((key) => {
            const value = stringifyValue(payload[key]);
            return value ? `${humanizeKey(key)}: ${value}` : null;
        })
        .filter((line): line is string => Boolean(line));
}

function getStageEventStatus(payload: Record<string, unknown>): BuildLogItemStatus {
    const status = String(payload.status || '').toLowerCase();

    if (status === 'failed') {
        return 'failed';
    }

    if (stringifyValue(payload.skipReason)) {
        return 'warning';
    }

    return 'completed';
}

function createCompactStageCompletedSubtitle(stageId: string, payload: Record<string, unknown>, t: Translator<MessageKey>): string {
    const summary = readRecord(payload.summary);
    const status = getPayloadStatus(payload);
    const nonDefaultStatus = status && status !== 'completed' ? status : null;
    const skipReason = stringifyValue(payload.skipReason);

    switch (stageId) {
        case 'classification':
            return compactParts([
                formatCountPart('parsed', summary?.parsed),
                summarizeDecisionCounts(payload.finalDecisions),
                formatCountPart('conflicts', payload.conflicts),
                skipReason
            ]) || t('buildLog.event.stageCompletedSubtitle');
        case 'dependency':
            return compactParts([
                nonDefaultStatus,
                formatCountPart('warnings', summary?.warnings),
                formatCountPart('errors', summary?.errors),
                skipReason
            ]) || t('buildLog.event.stageCompletedSubtitle');
        case 'arbiter':
            return compactParts([
                formatCountPart('review', payload.reviewCount ?? summary?.review),
                summarizeConfidence(payload.confidence),
                nonDefaultStatus,
                skipReason
            ]) || t('buildLog.event.stageCompletedSubtitle');
        case 'deep-check':
            return compactParts([
                nonDefaultStatus,
                formatCountPart('review', summary?.review),
                formatCountPart('changed', summary?.changed),
                skipReason
            ]) || t('buildLog.event.stageCompletedSubtitle');
        case 'build':
            return compactParts([
                formatCountPart('keep', summary?.kept),
                formatCountPart('exclude', summary?.excluded),
                formatCountPart('copied', summary?.copied),
                formatCountPart('linked', summary?.linked),
                formatCountPart('reused', summary?.reused),
                formatCountPart('restored', summary?.restoredFromStash),
                formatCountPart('stashed', summary?.movedToStash),
                formatCountPart('errors', summary?.errors),
                nonDefaultStatus,
                skipReason
            ]) || t('buildLog.event.stageCompletedSubtitle');
        case 'server-core':
            return compactParts([
                stringifyValue(summary?.coreType),
                stringifyValue(summary?.minecraftVersion),
                stringifyValue(summary?.loaderVersion),
                nonDefaultStatus,
                stringifyValue(summary?.reason),
                skipReason
            ]) || t('buildLog.event.stageCompletedSubtitle');
        case 'validation':
            return compactParts([
                nonDefaultStatus,
                formatCountPart('issues', summary?.issues),
                formatCountPart('errors', summary?.errors),
                formatCountPart('warnings', summary?.warnings),
                skipReason
            ]) || t('buildLog.event.stageCompletedSubtitle');
        default:
            return compactParts([
                nonDefaultStatus,
                skipReason
            ]) || t('buildLog.event.stageCompletedSubtitle');
    }
}

function updateLatestStageItem(
    state: CompactLogState,
    stageId: string,
    updater: (current: BuildLogItem) => BuildLogItem
): void {
    patchCompactItem(state, state.latestStageItemIdByStage.get(stageId) || null, updater);
}

function summarizePlanFixes(payload: Record<string, unknown>): string | null {
    return compactParts([
        stringifyValue(payload.newlyAppliedFixKinds),
        stringifyValue(payload.reasonCode)
    ]);
}

function buildCompactRunLogItems({
    form,
    session,
    preflight,
    t
}: {
    form: RunFormState;
    session: RunSessionState;
    preflight: RunPreflightSummary | null;
    t: Translator<MessageKey>;
}): BuildLogItem[] {
    const state = createCompactLogState();

    for (const event of session.events) {
        if (!TRACKED_EVENT_TYPES.has(event.type)) {
            continue;
        }

        const payload = event.payload as Record<string, unknown>;
        const timestamp = formatTimestamp(event.timestamp);

        switch (event.type) {
            case 'run.started':
                appendCompactItem(state, {
                    id: 'compact:run.started',
                    kind: 'event',
                    title: t('buildLog.event.runStarted'),
                    subtitle: stringifyValue(payload.inputPath) || timestamp || t('buildLog.item.completed'),
                    description: t('buildLog.description.runStarted'),
                    status: 'completed',
                    timestamp,
                    sourceLabel: 'run.started',
                    dataLines: createDataLinesFromObject(payload)
                });
                break;
            case 'registry.loaded':
                appendCompactItem(state, {
                    id: 'compact:registry.loaded',
                    kind: 'event',
                    title: t('buildLog.event.registryLoaded'),
                    subtitle: stringifyValue(payload.sourceDescription) || stringifyValue(payload.source) || timestamp,
                    description: t('buildLog.description.registryLoaded'),
                    status: 'completed',
                    timestamp,
                    sourceLabel: 'registry.loaded',
                    dataLines: createDataLinesFromObject(payload)
                });
                break;
            case 'convergence.candidate.started': {
                const candidateId = stringifyValue(payload.candidateId) || `candidate-${stringifyValue(payload.iteration) || state.items.length}`;
                const iteration = Number(payload.iteration);
                const itemId = `compact:candidate:${candidateId}`;
                const plannedSummary = state.pendingPlanSummaryByCandidateId.get(candidateId) || null;

                state.currentCandidateScopeKey = candidateId;
                state.pendingPlanSummaryByCandidateId.delete(candidateId);

                if (Number.isFinite(iteration) && iteration > 0) {
                    state.candidateItemIdByCandidateId.set(candidateId, itemId);

                    upsertCompactItem(state, {
                        id: itemId,
                        kind: 'event',
                        title: `Candidate ${iteration}`,
                        subtitle: compactParts([
                            plannedSummary,
                            stringifyValue(payload.parentCandidateId) ? `from ${stringifyValue(payload.parentCandidateId)}` : null
                        ]) || timestamp || t('buildLog.item.running'),
                        description: t('buildLog.description.convergenceCandidateStarted'),
                        status: 'running',
                        timestamp,
                        sourceLabel: 'convergence.candidate',
                        dataLines: createDataLinesFromObject(payload)
                    });
                }
                break;
            }
            case 'stage.started': {
                const stageId = typeof payload.stage === 'string' ? payload.stage : 'unknown';
                const scopeKey = state.currentCandidateScopeKey || session.runId || 'run';
                const stageKey = `${scopeKey}:${stageId}`;
                const nextSequence = (state.stageSequenceByScope.get(stageKey) || 0) + 1;
                const itemId = `compact:stage:${stageKey}:${nextSequence}`;

                state.stageSequenceByScope.set(stageKey, nextSequence);
                state.currentStageItemId = itemId;
                state.currentStageId = stageId;
                state.latestStageItemIdByStage.set(stageId, itemId);

                appendCompactItem(state, {
                    id: itemId,
                    kind: 'event',
                    title: getStageLabel(stageId, t),
                    subtitle: createCompactStageStartedSubtitle(stageId, payload) || timestamp || t('buildLog.item.running'),
                    description: getStageDescription(stageId, t),
                    status: 'running',
                    timestamp,
                    sourceLabel: `stage.${stageId}`,
                    dataLines: createDataLinesFromObject(payload)
                });
                break;
            }
            case 'stage.activity':
                if (state.currentStageItemId && state.currentStageId === String(payload.stage || state.currentStageId || '')) {
                    patchCompactItem(state, state.currentStageItemId, (current) => ({
                        ...current,
                        subtitle: createCompactStageActivitySubtitle(payload) || current.subtitle,
                        dataLines: createDataLinesFromObject(payload)
                    }));
                }
                break;
            case 'mod.parsed':
                if (state.currentStageItemId && state.currentStageId === 'classification') {
                    patchCompactItem(state, state.currentStageItemId, (current) => ({
                        ...current,
                        subtitle: createCompactModActivitySubtitle(payload) || current.subtitle,
                        dataLines: createCompactActivityDataLines(payload, [
                            'fileName',
                            'index',
                            'total',
                            'loader',
                            'classificationDecision',
                            'winningEngine'
                        ])
                    }));
                }
                break;
            case 'build.action.completed':
                if (state.currentStageItemId && state.currentStageId === 'build') {
                    patchCompactItem(state, state.currentStageItemId, (current) => ({
                        ...current,
                        subtitle: createCompactBuildActivitySubtitle(payload) || current.subtitle,
                        dataLines: createCompactActivityDataLines(payload, [
                            'fileName',
                            'index',
                            'total',
                            'actionStatus',
                            'decision',
                            'finalSemanticDecision',
                            'decisionOrigin'
                        ])
                    }));
                }
                break;
            case 'stage.completed': {
                const stageId = typeof payload.stage === 'string' ? payload.stage : state.currentStageId || 'unknown';

                updateLatestStageItem(state, stageId, (current) => ({
                    ...current,
                    subtitle: createCompactStageCompletedSubtitle(stageId, payload, t),
                    status: getStageEventStatus(payload),
                    dataLines: createDataLinesFromObject(payload)
                }));

                if (state.currentStageId === stageId) {
                    state.currentStageId = null;
                    state.currentStageItemId = null;
                }
                break;
            }
            case 'classification.completed':
                updateLatestStageItem(state, 'classification', (current) => ({
                    ...current,
                    subtitle: compactParts([
                        summarizeDecisionCounts(payload.finalDecisions),
                        formatCountPart('conflicts', payload.conflicts),
                        formatCountPart('fallback', payload.fallbackFinalDecisions)
                    ]) || current.subtitle,
                    status: 'completed',
                    dataLines: createDataLinesFromObject(payload)
                }));
                break;
            case 'dependency.analysis.completed':
                updateLatestStageItem(state, 'dependency', (current) => ({
                    ...current,
                    subtitle: compactParts([
                        getPayloadStatus(payload),
                        formatCountPart('warnings', readRecord(payload.summary)?.warnings),
                        formatCountPart('errors', readRecord(payload.summary)?.errors)
                    ]) || current.subtitle,
                    status: getPayloadStatus(payload) === 'failed' ? 'failed' : 'completed',
                    dataLines: createDataLinesFromObject(payload)
                }));
                break;
            case 'arbiter.review-found':
                updateLatestStageItem(state, 'arbiter', (current) => ({
                    ...current,
                    subtitle: compactParts([
                        formatCountPart('review', payload.reviewCount),
                        summarizeConfidence(payload.confidence)
                    ]) || current.subtitle,
                    status: Number(payload.reviewCount || 0) > 0 ? 'warning' : 'completed',
                    dataLines: createDataLinesFromObject(payload)
                }));
                break;
            case 'deep-check.completed':
                updateLatestStageItem(state, 'deep-check', (current) => ({
                    ...current,
                    subtitle: compactParts([
                        getPayloadStatus(payload),
                        formatCountPart('review', readRecord(payload.summary)?.review),
                        formatCountPart('changed', readRecord(payload.summary)?.changed)
                    ]) || current.subtitle,
                    status: getPayloadStatus(payload) === 'failed' ? 'failed' : 'completed',
                    dataLines: createDataLinesFromObject(payload)
                }));
                break;
            case 'validation.completed': {
                const status = getPayloadStatus(payload);
                const skipReason = stringifyValue(payload.skipReason);
                updateLatestStageItem(state, 'validation', (current) => ({
                    ...current,
                    subtitle: compactParts([
                        status,
                        skipReason
                    ]) || current.subtitle,
                    status: status === 'failed' ? 'failed' : (skipReason ? 'warning' : 'completed'),
                    dataLines: createDataLinesFromObject(payload)
                }));
                break;
            }
            case 'convergence.plan.selected':
                if (typeof payload.nextCandidateId === 'string' && payload.nextCandidateId.trim()) {
                    state.pendingPlanSummaryByCandidateId.set(payload.nextCandidateId, summarizePlanFixes(payload) || timestamp || '');
                }
                break;
            case 'convergence.candidate.completed': {
                const candidateId = stringifyValue(payload.candidateId) || null;
                const itemId = candidateId ? (state.candidateItemIdByCandidateId.get(candidateId) || null) : null;
                const outcomeStatus = stringifyValue(payload.outcomeStatus);

                patchCompactItem(state, itemId, (current) => ({
                    ...current,
                    title: t('buildLog.event.convergenceCandidateCompleted'),
                    subtitle: compactParts([
                        candidateId,
                        outcomeStatus,
                        stringifyValue(payload.failureFamily)
                    ]) || current.subtitle,
                    description: t('buildLog.description.convergenceCandidateCompleted'),
                    status: outcomeStatus === 'passed' ? 'completed' : 'warning',
                    dataLines: createDataLinesFromObject(payload)
                }));
                break;
            }
            case 'convergence.terminal-outcome': {
                const terminalOutcomeId = stringifyValue(payload.terminalOutcomeId);

                appendCompactItem(state, {
                    id: `compact:terminal-outcome:${terminalOutcomeId || event.timestamp}`,
                    kind: 'event',
                    title: t('buildLog.event.convergenceTerminalOutcome'),
                    subtitle: compactParts([
                        terminalOutcomeId,
                        stringifyValue(payload.terminalOutcomeExplanation),
                        formatCountPart('candidates', payload.candidateCount)
                    ]) || timestamp || t('buildLog.item.completed'),
                    description: t('buildLog.description.convergenceTerminalOutcome'),
                    status: terminalOutcomeId === 'success' ? 'completed' : 'failed',
                    timestamp,
                    sourceLabel: 'convergence.terminal-outcome',
                    dataLines: createDataLinesFromObject(payload)
                });
                break;
            }
            case 'report.written':
                appendCompactItem(state, {
                    id: 'compact:report.written',
                    kind: 'event',
                    title: t('buildLog.event.reportWritten'),
                    subtitle: stringifyValue(payload.reportDir) || timestamp || t('buildLog.item.completed'),
                    description: t('buildLog.description.reportWritten'),
                    status: 'completed',
                    timestamp,
                    sourceLabel: 'report.written',
                    dataLines: createDataLinesFromObject(payload)
                });
                break;
            case 'run.finished':
                appendCompactItem(state, {
                    id: 'compact:run.finished',
                    kind: 'event',
                    title: t('buildLog.event.runFinished'),
                    subtitle: compactParts([
                        formatCountPart('keep', payload.kept),
                        formatCountPart('exclude', payload.excluded),
                        formatCountPart('errors', payload.errors)
                    ]) || t('buildLog.event.runFinishedSubtitle'),
                    description: t('buildLog.description.runFinished'),
                    status: 'completed',
                    timestamp,
                    sourceLabel: 'run.finished',
                    dataLines: createDataLinesFromObject(payload)
                });
                break;
            case 'run.failed':
                appendCompactItem(state, {
                    id: 'compact:run.failed',
                    kind: 'event',
                    title: t('buildLog.event.runFailed'),
                    subtitle: stringifyValue(payload.message) || t('buildLog.event.runFailedSubtitle'),
                    description: t('buildLog.description.runFailed'),
                    status: 'failed',
                    timestamp,
                    sourceLabel: 'run.failed',
                    dataLines: createDataLinesFromObject(payload)
                });
                break;
            default:
                break;
        }
    }

    if (state.items.length === 0) {
        return getPlanItems({ form, preflight, t });
    }

    return state.items;
}

export function buildRunLogItems({
    form,
    mode,
    session,
    preflight,
    t
}: {
    form: RunFormState;
    mode: BuildLogMode;
    session: RunSessionState;
    preflight: RunPreflightSummary | null;
    t: Translator<MessageKey>;
}): BuildLogItem[] {
    if (mode === 'compact') {
        return buildCompactRunLogItems({
            form,
            session,
            preflight,
            t
        });
    }

    const trackedEvents = session.events
        .filter((event) => TRACKED_EVENT_TYPES.has(event.type))
        .filter((event) => mode === 'full' || !COMPACT_HIDDEN_EVENT_TYPES.has(event.type))
        .map((event) => createEventItem(event, t))
        .filter((item): item is BuildLogItem => Boolean(item));

    if (trackedEvents.length === 0) {
        return getPlanItems({ form, preflight, t });
    }

    return trackedEvents;
}

export function getBuildLogStatusLabel(status: BuildLogItemStatus, t: Translator<MessageKey>): string {
    return formatStatus(status, t);
}
