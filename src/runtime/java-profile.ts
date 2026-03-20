const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

import type { JavaProfileId } from '../types/topology';

export interface ResolvedJavaRuntime {
    requestedProfile: JavaProfileId;
    resolvedProfile: JavaProfileId | null;
    command: string | null;
    source: string;
    majorVersion: number | null;
    available: boolean;
}

const WINDOWS_JAVA_EXECUTABLE = 'java.exe';
const POSIX_JAVA_EXECUTABLE = 'java';
const JAVA_PROFILE_ENV_KEYS: Record<Exclude<JavaProfileId, 'auto'>, string[]> = {
    'java-17': [
        'CLIENT_TO_SERVER_JAVA17_PATH',
        'CLIENT_TO_SERVER_JAVA_17_PATH',
        'JAVA17_HOME',
        'JAVA_17_HOME',
        'JDK17_HOME'
    ],
    'java-21': [
        'CLIENT_TO_SERVER_JAVA21_PATH',
        'CLIENT_TO_SERVER_JAVA_21_PATH',
        'JAVA21_HOME',
        'JAVA_21_HOME',
        'JDK21_HOME'
    ]
};

function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

function getJavaExecutableName(): string {
    return process.platform === 'win32' ? WINDOWS_JAVA_EXECUTABLE : POSIX_JAVA_EXECUTABLE;
}

function normalizeJavaCandidate(value: string | null): string | null {
    const normalized = normalizeString(value);

    if (!normalized) {
        return null;
    }

    if (!path.isAbsolute(normalized)) {
        return normalized;
    }

    if (!fs.existsSync(normalized)) {
        const nestedCandidate = path.join(normalized, 'bin', getJavaExecutableName());
        return fs.existsSync(nestedCandidate) ? nestedCandidate : normalized;
    }

    const stat = fs.statSync(normalized);

    if (stat.isDirectory()) {
        const nestedCandidate = path.join(normalized, 'bin', getJavaExecutableName());
        return fs.existsSync(nestedCandidate) ? nestedCandidate : null;
    }

    return normalized;
}

function parseJavaMajorVersion(output: string): number | null {
    const quotedVersion = output.match(/version \"([^\"]+)\"/i)?.[1] || null;
    const rawVersion = quotedVersion || output.match(/\b(\d+(?:\.\d+)+)\b/)?.[1] || null;

    if (!rawVersion) {
        return null;
    }

    const normalized = rawVersion.trim();

    if (normalized.startsWith('1.')) {
        const legacyMajor = Number(normalized.split('.')[1]);
        return Number.isInteger(legacyMajor) ? legacyMajor : null;
    }

    const major = Number(normalized.split(/[.+-]/)[0]);
    return Number.isInteger(major) ? major : null;
}

function probeJavaRuntime(command: string): { available: boolean; majorVersion: number | null } {
    try {
        const result = spawnSync(command, ['-version'], {
            encoding: 'utf8',
            windowsHide: true
        });
        const output = `${result.stderr || ''}\n${result.stdout || ''}`.trim();

        if (result.error) {
            return {
                available: false,
                majorVersion: null
            };
        }

        return {
            available: true,
            majorVersion: parseJavaMajorVersion(output)
        };
    } catch {
        return {
            available: false,
            majorVersion: null
        };
    }
}

function profileMatchesMajorVersion(profile: JavaProfileId, majorVersion: number | null): boolean {
    if (profile === 'auto') {
        return majorVersion !== null;
    }

    if (profile === 'java-17') {
        return majorVersion === 17;
    }

    if (profile === 'java-21') {
        return majorVersion === 21;
    }

    return false;
}

function getRequestedProfileCandidates(profile: Exclude<JavaProfileId, 'auto'>): string[] {
    const envCandidates = JAVA_PROFILE_ENV_KEYS[profile]
        .map((key) => normalizeJavaCandidate(process.env[key] || null))
        .filter((value): value is string => Boolean(value));
    const defaultJavaCandidate = normalizeJavaCandidate('java');

    return [...new Set([...envCandidates, ...(defaultJavaCandidate ? [defaultJavaCandidate] : [])])];
}

export function resolveJavaRuntimeForProfile(profile: JavaProfileId = 'auto'): ResolvedJavaRuntime {
    if (profile === 'auto') {
        const command = normalizeJavaCandidate(process.env.CLIENT_TO_SERVER_JAVA_PATH || process.env.JAVA_HOME || 'java');
        const probed = command ? probeJavaRuntime(command) : { available: false, majorVersion: null };

        return {
            requestedProfile: profile,
            resolvedProfile: probed.available ? 'auto' : null,
            command: probed.available ? command : null,
            source: command === 'java' ? 'path-java' : 'auto-java-env',
            majorVersion: probed.majorVersion,
            available: probed.available
        };
    }

    for (const candidate of getRequestedProfileCandidates(profile)) {
        const probed = probeJavaRuntime(candidate);

        if (!probed.available || !profileMatchesMajorVersion(profile, probed.majorVersion)) {
            continue;
        }

        return {
            requestedProfile: profile,
            resolvedProfile: profile,
            command: candidate,
            source: candidate === 'java' ? 'path-java' : 'profile-java-env',
            majorVersion: probed.majorVersion,
            available: true
        };
    }

    return {
        requestedProfile: profile,
        resolvedProfile: null,
        command: null,
        source: 'unresolved',
        majorVersion: null,
        available: false
    };
}

module.exports = {
    resolveJavaRuntimeForProfile
};
