const { parseValidationIssues } = require('../validation/error-parser');

import type { ModDescriptor } from '../types/descriptor';
import type { ProbeOutcome } from '../types/probe';
import type { ValidationProcessRuntime } from '../types/validation';

function inferClientRole(descriptor: ModDescriptor, currentRoleType: ProbeOutcome['roleType']): ProbeOutcome['roleType'] {
    if (currentRoleType && currentRoleType !== 'unknown' && !currentRoleType.startsWith('common-')) {
        return currentRoleType;
    }

    const hintCategories = new Set(descriptor.archiveIndex?.hintCategories || []);
    const signatureKinds = new Set(descriptor.archiveIndex?.clientSignatures?.signatureKinds || []);

    if (hintCategories.has('library') || signatureKinds.has('service-client-adapter')) {
        return 'client-library';
    }

    if (hintCategories.has('visual') || signatureKinds.has('render-api') || signatureKinds.has('mixin-client-target')) {
        return 'client-visual';
    }

    if (hintCategories.has('qol')) {
        return 'client-qol';
    }

    if (hintCategories.has('compat')) {
        return 'compat-client';
    }

    return 'client-ui';
}

function inferCommonRole(descriptor: ModDescriptor, currentRoleType: ProbeOutcome['roleType']): ProbeOutcome['roleType'] {
    if (currentRoleType && currentRoleType.startsWith('common-')) {
        return currentRoleType;
    }

    const hintCategories = new Set(descriptor.archiveIndex?.hintCategories || []);

    if (hintCategories.has('library')) {
        return 'common-library';
    }

    if (hintCategories.has('optimization')) {
        return 'common-optimization';
    }

    return 'common-gameplay';
}

function looksClientClassLoading(text: string, descriptor: ModDescriptor): boolean {
    if (/net\.minecraft\.client|net\/minecraft\/client|net\.minecraftforge\.client|com\.mojang\.blaze3d|net\.neoforged\.neoforge\.client/i.test(text)) {
        return true;
    }

    const bytecode = descriptor.archiveIndex?.bytecode;
    const signatures = descriptor.archiveIndex?.clientSignatures;

    return Boolean(
        (bytecode && bytecode.rootClientReferenceCount > 0)
        || (signatures && (
            signatures.clientApiExtendsCount > 0
            || signatures.clientApiImplementsCount > 0
            || signatures.forgeClientEventHitCount > 0
        ))
    );
}

function buildUnknownOutcome({
    fileName,
    sourcePath,
    requiredSupportFiles,
    reason,
    evidence,
    durationMs,
    timedOut
}: Omit<ProbeOutcome, 'outcome' | 'semanticDecision' | 'roleType' | 'confidence' | 'knowledgeApplied'>): ProbeOutcome {
    return {
        fileName,
        sourcePath,
        requiredSupportFiles,
        outcome: timedOut ? 'late_runtime_failure' : 'inconclusive',
        semanticDecision: 'unknown',
        roleType: 'unknown',
        confidence: 'low',
        reason,
        evidence,
        durationMs,
        timedOut,
        knowledgeApplied: false
    };
}

function analyzeProbeRuntime({
    fileName,
    sourcePath,
    requiredSupportFiles,
    descriptor,
    currentRoleType = 'unknown',
    processRuntime
}: {
    fileName: string;
    sourcePath: string;
    requiredSupportFiles: string[];
    descriptor: ModDescriptor;
    currentRoleType?: ProbeOutcome['roleType'];
    processRuntime: ValidationProcessRuntime;
}): ProbeOutcome {
    const parsed = parseValidationIssues(processRuntime.combinedOutput);
    const issues = parsed.issues;
    const evidence = issues.map((issue: { evidence: string }) => issue.evidence).filter(Boolean).slice(0, 4);
    const commonPayload = {
        fileName,
        sourcePath,
        requiredSupportFiles,
        durationMs: processRuntime.durationMs,
        timedOut: processRuntime.timedOut,
        knowledgeApplied: false
    };

    if (!processRuntime.spawnError && issues.length === 0 && processRuntime.successMarkers.length > 0) {
        return {
            ...commonPayload,
            outcome: 'server_boot_ok',
            semanticDecision: 'keep',
            roleType: inferCommonRole(descriptor, currentRoleType),
            confidence: 'high',
            reason: 'Dedicated server probe reached a success marker with this mod present',
            evidence: processRuntime.successMarkers.map((marker: { label: string }) => marker.label).slice(0, 3)
        };
    }

    if (issues.some((issue: { kind: string }) => issue.kind === 'missing-dependency')) {
        return {
            ...commonPayload,
            outcome: 'missing_required_dependency',
            semanticDecision: 'unknown',
            roleType: currentRoleType || 'unknown',
            confidence: 'low',
            reason: 'Dedicated server probe failed because required dependencies were missing from the probe workspace',
            evidence
        };
    }

    if (issues.some((issue: { kind: string }) => issue.kind === 'side-mismatch')) {
        return {
            ...commonPayload,
            outcome: 'side_only_violation',
            semanticDecision: 'remove',
            roleType: inferClientRole(descriptor, currentRoleType),
            confidence: 'high',
            reason: 'Dedicated server probe detected an explicit client/server side violation',
            evidence
        };
    }

    if (issues.some((issue: { kind: string; evidence: string }) => issue.kind === 'class-loading' && looksClientClassLoading(issue.evidence, descriptor))) {
        return {
            ...commonPayload,
            outcome: 'client_classload_failure',
            semanticDecision: 'remove',
            roleType: inferClientRole(descriptor, currentRoleType),
            confidence: 'high',
            reason: 'Dedicated server probe failed while loading client-only classes',
            evidence
        };
    }

    if (issues.some((issue: { kind: string }) => issue.kind === 'mixin-failure') && looksClientClassLoading(processRuntime.combinedOutput, descriptor)) {
        return {
            ...commonPayload,
            outcome: 'mixin_target_failure',
            semanticDecision: 'remove',
            roleType: inferClientRole(descriptor, currentRoleType),
            confidence: 'medium',
            reason: 'Dedicated server probe failed in mixin application against a client-oriented target',
            evidence
        };
    }

    if (processRuntime.timedOut) {
        return buildUnknownOutcome({
            ...commonPayload,
            reason: 'Dedicated server probe timed out before it could prove the mod as client-only or server-safe',
            evidence: evidence.length > 0 ? evidence : ['Probe timed out']
        });
    }

    if (processRuntime.spawnError) {
        return buildUnknownOutcome({
            ...commonPayload,
            reason: 'Dedicated server probe could not start the validation process',
            evidence: [processRuntime.spawnError.message]
        });
    }

    if (issues.length > 0) {
        return {
            ...commonPayload,
            outcome: 'late_runtime_failure',
            semanticDecision: 'unknown',
            roleType: currentRoleType || 'unknown',
            confidence: 'low',
            reason: 'Dedicated server probe failed, but the failure could not be mapped to a decisive client-only pattern',
            evidence
        };
    }

    return buildUnknownOutcome({
        ...commonPayload,
            reason: 'Dedicated server probe finished without a decisive success or failure signal',
            evidence: processRuntime.combinedOutput
                .split(/\r?\n/)
                .map((line: string) => line.trim())
                .filter(Boolean)
                .slice(-4)
        });
}

module.exports = {
    analyzeProbeRuntime
};
