const { detectFailureMarkers } = require('./markers');

import type { ValidationIssue, ValidationParseResult } from '../types/validation';

function toUniqueList(values: unknown[] = []): string[] {
    return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function extractJarHints(text: unknown): string[] {
    return toUniqueList(Array.from(String(text || '').matchAll(/\b([a-z0-9_.-]+\.jar)\b/gi), (match) => match[1]));
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
        /Cannot load class .* in environment type SERVER/ig
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(text);

        while (match) {
            const modId = match[1] || null;
            const evidence = match[0].replace(/\s+/g, ' ').trim();

            issues.push({
                kind: 'side-mismatch',
                message: modId
                    ? `Validation detected a side mismatch for ${modId}`
                    : 'Validation detected a client/server side mismatch',
                evidence,
                modIds: toUniqueList([modId]),
                suspectedModIds: toUniqueList([modId]),
                jarHints: extractJarHints(evidence),
                confidence: modId ? 'high' : 'medium'
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
            const className = match[1] || null;
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
        /Error: LinkageError occurred while loading main class[^\r\n]*/ig
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
        ...parseClassLoadingIssues(normalizedText),
        ...parseJavaRuntimeIssues(normalizedText),
        ...parseLaunchProfileIssues(normalizedText),
        ...parseMixinIssues(normalizedText),
        ...parseEntrypointIssues(normalizedText)
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
