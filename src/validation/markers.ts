import type { ValidationMarker } from '../types/validation';

const SUCCESS_MARKERS = Object.freeze([
    {
        label: 'minecraft-server-ready',
        pattern: /Done \([\d.,]+s\)!/i
    },
    {
        label: 'minecraft-help-prompt',
        pattern: /For help, type "help"/i
    },
    {
        label: 'generic-server-ready',
        pattern: /\bSERVER_READY\b/i
    },
    {
        label: 'generic-validation-ready',
        pattern: /\bVALIDATION_READY\b/i
    }
]);

const FAILURE_MARKERS = Object.freeze([
    {
        label: 'missing-dependency',
        pattern: /missing or unsupported mandatory dependencies|requires mod |depends on|required mod/i
    },
    {
        label: 'side-mismatch',
        pattern: /environment type server|client-only|dedicated server/i
    },
    {
        label: 'class-loading',
        pattern: /ClassNotFoundException|NoClassDefFoundError/i
    },
    {
        label: 'mixin-failure',
        pattern: /Mixin(?:\s\w+)* failed|MixinTransformerError|Mixin apply failed/i
    },
    {
        label: 'entrypoint-crash',
        pattern: /EntrypointException|Could not execute entrypoint stage/i
    },
    {
        label: 'fatal-startup',
        pattern: /Failed to start the minecraft server|crashed whilst initializing/i
    }
]);

function collectMarkers(
    text: string | null | undefined,
    patterns: ReadonlyArray<{ label: string; pattern: RegExp }>
): ValidationMarker[] {
    if (!text) {
        return [];
    }

    const lines = String(text)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const markers: ValidationMarker[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
        for (const descriptor of patterns) {
            if (!descriptor.pattern.test(line)) {
                continue;
            }

            const key = `${descriptor.label}:${line}`;

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            markers.push({
                label: descriptor.label,
                evidence: line
            });
        }
    }

    return markers;
}

function detectSuccessMarkers(text: string | null | undefined): ValidationMarker[] {
    return collectMarkers(text, SUCCESS_MARKERS);
}

function detectFailureMarkers(text: string | null | undefined): ValidationMarker[] {
    return collectMarkers(text, FAILURE_MARKERS);
}

module.exports = {
    FAILURE_MARKERS,
    SUCCESS_MARKERS,
    detectFailureMarkers,
    detectSuccessMarkers
};
