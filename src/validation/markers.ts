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
    },
    {
        label: 'joinability-ready',
        pattern: /\b(CLIENT_JOIN_OK|JOINABILITY_OK)\b/i
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
        label: 'java-runtime',
        pattern: /UnsupportedClassVersionError|unsupported class file major version|compiled by a more recent version of the Java Runtime|Could not create the Java Virtual Machine|A JNI error has occurred|Invalid maximum heap size|Unsupported major\.minor version/i
    },
    {
        label: 'launch-profile',
        pattern: /Could not find or load main class|Unable to access jarfile|no main manifest attribute|entrypoint was not found/i
    },
    {
        label: 'runtime-topology',
        pattern: /wrong runtime topology|runtime topology mismatch|not compatible with selected runtime topology|requires runtime topology/i
    },
    {
        label: 'connector-layer',
        pattern: /sinytra connector|connector bootstrap failed|failed to initialize connector|connector layer incompatible/i
    },
    {
        label: 'topology-incompatible-artifact',
        pattern: /topology-incompatible artifact|kept incompatible artifact|runtime topology rejected kept jar/i
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
    },
    {
        label: 'joinability-failure',
        pattern: /\b(CLIENT_JOIN_FAILED|JOINABILITY_FAILED)\b|joinability check failed|client-server joinability failed|mismatched mod list/i
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

function detectJoinabilitySuccessMarkers(text: string | null | undefined): ValidationMarker[] {
    return collectMarkers(text, SUCCESS_MARKERS.filter((marker) => marker.label === 'joinability-ready'));
}

function detectJoinabilityFailureMarkers(text: string | null | undefined): ValidationMarker[] {
    return collectMarkers(text, FAILURE_MARKERS.filter((marker) => marker.label === 'joinability-failure'));
}

module.exports = {
    FAILURE_MARKERS,
    SUCCESS_MARKERS,
    detectFailureMarkers,
    detectJoinabilityFailureMarkers,
    detectJoinabilitySuccessMarkers,
    detectSuccessMarkers
};
