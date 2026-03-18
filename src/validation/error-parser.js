const { detectFailureMarkers } = require('./markers');

function toUniqueList(values = []) {
    return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function extractJarHints(text) {
    return toUniqueList(Array.from(String(text || '').matchAll(/\b([a-z0-9_.-]+\.jar)\b/gi), (match) => match[1]));
}

function parseMissingDependencyIssues(text) {
    const issues = [];
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
                    ? `Validation обнаружил отсутствующую зависимость: ${dependencyModId}`
                    : 'Validation обнаружил отсутствующую обязательную зависимость',
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

function parseSideMismatchIssues(text) {
    const issues = [];
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
                    ? `Validation обнаружил конфликт стороны среды для ${modId}`
                    : 'Validation обнаружил client/server side mismatch',
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

function parseClassLoadingIssues(text) {
    const issues = [];
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
                    ? `Validation обнаружил ошибку загрузки класса: ${className}`
                    : 'Validation обнаружил ошибку загрузки класса',
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

function parseMixinIssues(text) {
    const issues = [];
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
                message: 'Validation обнаружил сбой применения mixin',
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

function parseEntrypointIssues(text) {
    const issues = [];
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
                message: 'Validation обнаружил сбой entrypoint',
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

function parseUnknownCriticalIssue(text, knownIssues) {
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
            message: 'Validation обнаружил критическую ошибку запуска, которую не удалось точно классифицировать',
            evidence: candidate,
            modIds: [],
            suspectedModIds: [],
            jarHints: extractJarHints(candidate),
            confidence: 'low'
        }
    ];
}

function deduplicateIssues(issues) {
    const result = [];
    const seen = new Set();

    for (const issue of issues) {
        const key = [
            issue.kind,
            issue.message,
            issue.evidence,
            (issue.modIds || []).join(','),
            (issue.jarHints || []).join(',')
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

function parseValidationIssues(text) {
    const normalizedText = String(text || '');
    const issues = deduplicateIssues([
        ...parseMissingDependencyIssues(normalizedText),
        ...parseSideMismatchIssues(normalizedText),
        ...parseClassLoadingIssues(normalizedText),
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
