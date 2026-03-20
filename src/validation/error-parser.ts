const { detectFailureMarkers } = require('./markers');

import type { ValidationIssue, ValidationParseResult } from '../types/validation';

function toUniqueList(values: unknown[] = []): string[] {
    return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function extractJarHints(text: unknown): string[] {
    return toUniqueList(Array.from(String(text || '').matchAll(/\b([a-z0-9_.-]+\.jar)\b/gi), (match) => match[1]));
}

function normalizeClassName(className: unknown): string {
    return String(className || '').trim().replace(/\//g, '.');
}

function normalizeModIdToken(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\.jar$/i, '')
        .replace(/[^a-z0-9_.-]+/g, '');
}

function classNameLooksClientOnly(className: unknown): boolean {
    const normalized = normalizeClassName(className).toLowerCase();

    return /net\.minecraft\.client|com\.mojang\.blaze3d|mezz\.jei|journeymap|xaero|keyboardinput|mousehandler|iteminhandrenderer|humanoidarmorlayer|inventoryeffectrendererguihandler|craftingscreen|screen|renderer|camera|posestack|inputconstants/.test(normalized);
}

function deriveMixinOwnerHints(configName: unknown): string[] {
    const suffixTokens = new Set(['common', 'client', 'server', 'forge', 'fabric', 'neoforge', 'quilt', 'compat', 'integration']);
    const normalized = String(configName || '')
        .trim()
        .toLowerCase()
        .replace(/\.mixins?\.json$/i, '');

    if (!normalized) {
        return [];
    }

    const segments = normalized.split('.').filter(Boolean);
    const strippedSegments = [...segments];

    while (strippedSegments.length > 1 && suffixTokens.has(strippedSegments[strippedSegments.length - 1] || '')) {
        strippedSegments.pop();
    }

    return toUniqueList([
        normalizeModIdToken(normalized),
        normalizeModIdToken(segments[0]),
        normalizeModIdToken(strippedSegments.join('.')),
        normalizeModIdToken(strippedSegments[0])
    ]);
}

function parseMissingDependencyIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /mod ['"]?([a-z0-9_.-]+)['"]?.{0,160}requires(?:.+?)['"]?([a-z0-9_.-]+)['"]?/ig,
        /missing or unsupported mandatory dependencies:[\s\S]{0,240}?mod id: ['"]?([a-z0-9_.-]+)['"]?/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const ownerModId = match[1] || null;
            const dependencyModId = match[2] || match[1] || null;
            const evidence = match[0].replace(/\s+/g, ' ').trim();
            const suspectedModIds = dependencyModId ? [dependencyModId] : [];
            const modIds = toUniqueList([ownerModId, dependencyModId]);

            issues.push({
                kind: 'missing-dependency',
                message: dependencyModId
                    ? `Validation detected a missing dependency: ${dependencyModId}`
                    : 'Validation detected a missing required dependency',
                evidence,
                modIds,
                suspectedModIds,
                jarHints: extractJarHints(evidence),
                confidence: dependencyModId ? 'high' : 'medium'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseSideMismatchIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /mod ['"]?([a-z0-9_.-]+)['"]?.{0,160}(cannot load|can't load).{0,160}environment type server/ig,
        /([a-z0-9_.-]+).{0,120}client-only/ig,
        /Cannot load class .* in environment type SERVER/ig,
        /Attempted to load class\s+([a-z0-9_.$/]+)\s+for invalid dist DEDICATED_SERVER/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const rawToken = match[1] || null;
            const modId = rawToken && !/[/.]/.test(rawToken) ? rawToken : null;
            const evidence = match[0].replace(/\s+/g, ' ').trim();
            const clientClass = rawToken && /[/.]/.test(rawToken) ? normalizeClassName(rawToken) : null;
            const suspectedModIds = toUniqueList([modId]);

            issues.push({
                kind: 'side-mismatch',
                message: modId
                    ? `Validation detected a side mismatch for ${modId}`
                    : clientClass
                        ? `Validation detected a dedicated-server load of client class ${clientClass}`
                    : 'Validation detected a client/server side mismatch',
                evidence,
                modIds: toUniqueList([modId]),
                suspectedModIds,
                jarHints: extractJarHints(evidence),
                confidence: modId || clientClass ? 'high' : 'medium'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseClassLoadingIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /ClassNotFoundException:\s*([a-z0-9_.$/]+)/ig,
        /NoClassDefFoundError:\s*([a-z0-9_.$/]+)/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const className = normalizeClassName(match[1] || null);
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'class-loading',
                message: className
                    ? `Validation detected a class loading failure: ${className}`
                    : 'Validation detected a class loading failure',
                evidence,
                modIds: [],
                suspectedModIds: [],
                jarHints: extractJarHints(evidence),
                confidence: 'medium'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseMixinTargetIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        const match = line.match(/@Mixin target\s+([a-z0-9_.$/]+)\s+was not found\s+([a-z0-9_.-]+\.mixins?\.json):([a-z0-9_.$/]+)/i);

        if (!match) {
            continue;
        }

        const targetClass = normalizeClassName(match[1] || null);
        const mixinConfig = match[2] || '';
        const ownerHints = deriveMixinOwnerHints(mixinConfig);
        const clientOnly = classNameLooksClientOnly(targetClass);
        const evidence = line.replace(/\s+/g, ' ').trim();

        issues.push({
            kind: clientOnly ? 'side-mismatch' : 'class-loading',
            message: clientOnly
                ? `Validation linked a client-only mixin target to ${mixinConfig}`
                : `Validation linked a class loading failure to ${mixinConfig}`,
            evidence,
            modIds: ownerHints,
            suspectedModIds: ownerHints,
            jarHints: toUniqueList([
                ...extractJarHints(evidence),
                ...ownerHints
            ]),
            confidence: clientOnly ? 'high' : 'medium'
        });
    }

    return issues;
}

function parseJavaRuntimeIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /UnsupportedClassVersionError[^\r\n]*/ig,
        /unsupported class file major version[^\r\n]*/ig,
        /compiled by a more recent version of the Java Runtime[^\r\n]*/ig,
        /Unsupported major\.minor version[^\r\n]*/ig,
        /Could not create the Java Virtual Machine[^\r\n]*/ig,
        /A JNI error has occurred[^\r\n]*/ig,
        /Invalid maximum heap size[^\r\n]*/ig,
        /Could not reserve enough space[^\r\n]*/ig,
        /Error: LinkageError occurred while loading main class[^\r\n]*/ig,
        /Requested Java profile .* is not available[^\r\n]*/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'java-runtime',
                message: 'Validation detected a Java runtime mismatch or bootstrap failure',
                evidence,
                modIds: [],
                suspectedModIds: [],
                jarHints: extractJarHints(evidence),
                confidence: 'high'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseLaunchProfileIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /Could not find or load main class[^\r\n]*/ig,
        /Unable to access jarfile[^\r\n]*/ig,
        /no main manifest attribute[^\r\n]*/ig,
        /entrypoint was not found[^\r\n]*/ig,
        /Could not resolve main class[^\r\n]*/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'launch-profile',
                message: 'Validation detected a launch profile or entrypoint bootstrap mismatch',
                evidence,
                modIds: [],
                suspectedModIds: [],
                jarHints: extractJarHints(evidence),
                confidence: 'high'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseRuntimeTopologyIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /wrong runtime topology[^\r\n]*/ig,
        /runtime topology mismatch[^\r\n]*/ig,
        /not compatible with selected runtime topology[^\r\n]*/ig,
        /requires runtime topology[^\r\n]*/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'runtime-topology',
                message: 'Validation detected a runtime topology mismatch',
                evidence,
                modIds: [],
                suspectedModIds: [],
                jarHints: extractJarHints(evidence),
                confidence: 'high'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseConnectorLayerIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /sinytra(?:\s+connector)?[^\r\n]*(?:failed|error|incompatible|missing)/ig,
        /connector bootstrap failed[^\r\n]*/ig,
        /failed to initialize connector[^\r\n]*/ig,
        /connector layer incompatible[^\r\n]*/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'connector-layer',
                message: 'Validation detected a connector-layer incompatibility',
                evidence,
                modIds: [],
                suspectedModIds: toUniqueList([
                    /sinytra/i.test(evidence) ? 'sinytra_connector' : null
                ]),
                jarHints: extractJarHints(evidence),
                confidence: 'high'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseTopologyIncompatibleArtifactIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /topology-incompatible artifact[^\r\n]*/ig,
        /kept incompatible artifact[^\r\n]*/ig,
        /runtime topology rejected kept jar[^\r\n]*/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'topology-incompatible-artifact',
                message: 'Validation detected a kept topology-incompatible artifact',
                evidence,
                modIds: [],
                suspectedModIds: [],
                jarHints: extractJarHints(evidence),
                confidence: 'high'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseMixinIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /Mixin(?:\s\w+)* failed[^\r\n]*/ig,
        /MixinTransformerError[^\r\n]*/ig,
        /Mixin apply failed[^\r\n]*/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'mixin-failure',
                message: 'Validation detected a mixin application failure',
                evidence,
                modIds: [],
                suspectedModIds: [],
                jarHints: extractJarHints(evidence),
                confidence: 'medium'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseEntrypointIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /EntrypointException[^\r\n]*/ig,
        /Could not execute entrypoint stage[^\r\n]*/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'entrypoint-crash',
                message: 'Validation detected an entrypoint crash',
                evidence,
                modIds: [],
                suspectedModIds: [],
                jarHints: extractJarHints(evidence),
                confidence: 'medium'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseJoinabilityIssues(text: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patterns = [
        /\bCLIENT_JOIN_FAILED\b[^\r\n]*/ig,
        /\bJOINABILITY_FAILED\b[^\r\n]*/ig,
        /joinability check failed[^\r\n]*/ig,
        /client-server joinability failed[^\r\n]*/ig,
        /mismatched mod list[^\r\n]*/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'joinability-failure',
                message: 'Validation detected a client/server joinability failure',
                evidence,
                modIds: [],
                suspectedModIds: [],
                jarHints: extractJarHints(evidence),
                confidence: /mismatched mod list|CLIENT_JOIN_FAILED|JOINABILITY_FAILED/i.test(evidence) ? 'high' : 'medium'
            });

            match = pattern.exec(text);
        }
    }

    return issues;
}

function parseUnknownCriticalIssue(text: string, knownIssues: ValidationIssue[]): ValidationIssue[] {
    if (knownIssues.length > 0) {
        return [];
    }

    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const candidate = lines.find((line) => /(Exception|ERROR|Failed to start the minecraft server|crashed whilst initializing)/i.test(line));

    if (!candidate) {
        return [];
    }

    return [
        {
            kind: 'unknown-critical',
            message: 'Validation detected a critical startup failure that could not be classified precisely',
            evidence: candidate,
            modIds: [],
            suspectedModIds: [],
            jarHints: extractJarHints(candidate),
            confidence: 'low'
        }
    ];
}

function deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
    const result: ValidationIssue[] = [];
    const seen = new Set<string>();

    for (const issue of issues) {
        const key = [
            issue.kind,
            issue.message,
            issue.evidence,
            issue.modIds.join(','),
            issue.jarHints.join(',')
        ].join('|');

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push({
            ...issue,
            modIds: toUniqueList(issue.modIds),
            suspectedModIds: toUniqueList(issue.suspectedModIds),
            jarHints: toUniqueList(issue.jarHints)
        });
    }

    return result;
}

function parseValidationIssues(text: string | null | undefined): ValidationParseResult {
    const normalizedText = String(text || '');
    const issues = deduplicateIssues([
        ...parseMissingDependencyIssues(normalizedText),
        ...parseSideMismatchIssues(normalizedText),
        ...parseMixinTargetIssues(normalizedText),
        ...parseClassLoadingIssues(normalizedText),
        ...parseJavaRuntimeIssues(normalizedText),
        ...parseLaunchProfileIssues(normalizedText),
        ...parseRuntimeTopologyIssues(normalizedText),
        ...parseConnectorLayerIssues(normalizedText),
        ...parseTopologyIncompatibleArtifactIssues(normalizedText),
        ...parseMixinIssues(normalizedText),
        ...parseEntrypointIssues(normalizedText),
        ...parseJoinabilityIssues(normalizedText)
    ]);
    const fallbackIssues = parseUnknownCriticalIssue(normalizedText, issues);
    const failureMarkers = detectFailureMarkers(normalizedText);

    return {
        issues: deduplicateIssues([...issues, ...fallbackIssues]),
        failureMarkers
    };
}

module.exports = {
    extractJarHints,
    parseValidationIssues
};
