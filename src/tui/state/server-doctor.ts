import preflightApi from '../../server/preflight.js';

import type {
    ServerPreflightFinding,
    ServerPreflightLevel,
    ServerPreflightResult
} from '../../server/preflight.js';
import type { ServerFormState } from './app-state.js';

const { runServerPreflight } = preflightApi;

export interface ServerDoctorState {
    install: ServerPreflightResult;
    launch: ServerPreflightResult;
}

export interface ServerDoctorSummary {
    ok: boolean;
    errorCount: number;
    warningCount: number;
    infoCount: number;
}

export interface ServerDoctorFinding extends ServerPreflightFinding {
    mode: 'install' | 'launch';
}

export function buildServerDoctorState(form: ServerFormState): ServerDoctorState {
    return {
        install: runServerPreflight({
            mode: 'install',
            targetDir: form.targetDir,
            coreType: form.coreType,
            minecraftVersion: form.minecraftVersion,
            javaPath: form.javaPath,
            explicitEntrypointPath: form.explicitEntrypointPath,
            jvmArgs: form.jvmArgs,
            acceptEula: form.acceptEula
        }),
        launch: runServerPreflight({
            mode: 'launch',
            targetDir: form.targetDir,
            coreType: form.coreType,
            minecraftVersion: form.minecraftVersion,
            javaPath: form.javaPath,
            explicitEntrypointPath: form.explicitEntrypointPath,
            jvmArgs: form.jvmArgs,
            acceptEula: form.acceptEula
        })
    };
}

export function collectServerDoctorFindings(doctor: ServerDoctorState): ServerDoctorFinding[] {
    return [
        ...doctor.install.findings.map((finding) => ({ ...finding, mode: 'install' as const })),
        ...doctor.launch.findings.map((finding) => ({ ...finding, mode: 'launch' as const }))
    ];
}

export function countPreflightFindings(result: ServerPreflightResult, level: ServerPreflightLevel): number {
    return result.findings.filter((finding) => finding.level === level).length;
}

export function summarizeServerDoctorState(doctor: ServerDoctorState): ServerDoctorSummary {
    const findings = collectServerDoctorFindings(doctor);

    return {
        ok: doctor.install.ok && doctor.launch.ok,
        errorCount: findings.filter((finding) => finding.level === 'error').length,
        warningCount: findings.filter((finding) => finding.level === 'warning').length,
        infoCount: findings.filter((finding) => finding.level === 'info').length
    };
}
