import fs from 'node:fs';
import path from 'node:path';

import type { RunReport } from '../../types/report.js';

export interface ReportHistoryEntry {
    runId: string;
    reportDir: string;
    jsonReportPath: string | null;
    runMetadataPath: string | null;
    summaryPath: string | null;
    eventsLogPath: string | null;
    instancePath: string | null;
    buildDir: string | null;
    serverDirName: string | null;
    startedAt: string | null;
    completedAt: string | null;
    timestampMs: number;
    mode: string | null;
    dryRun: boolean;
    profile: string | null;
    deepCheckMode: string | null;
    validationMode: string | null;
    validationStatus: string | null;
    registryMode: string | null;
    registrySource: string | null;
    totalJarFiles: number;
    kept: number;
    excluded: number;
    review: number;
    warnings: number;
    errors: number;
}

export interface ReportHistoryState {
    reportRootDir: string;
    entries: ReportHistoryEntry[];
    error: string | null;
}

type RunMetadata = RunReport['run'] & {
    completedAt?: string;
};

function readJsonFile<T>(filePath: string): T | null {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
        return null;
    }
}

function parseTimestampMs(value: unknown): number {
    if (typeof value !== 'string' || !value.trim()) {
        return 0;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getExistingFilePath(filePath: string): string | null {
    return fs.existsSync(filePath) ? filePath : null;
}

function readHistoryEntry(reportDir: string): ReportHistoryEntry | null {
    const reportDirectoryName = path.basename(reportDir);
    const runMetadataPath = path.join(reportDir, 'run.json');
    const jsonReportPath = path.join(reportDir, 'report.json');
    const summaryPath = path.join(reportDir, 'summary.md');
    const eventsLogPath = path.join(reportDir, 'events.log');

    const report = readJsonFile<RunReport>(jsonReportPath);
    const runFromReport = report?.run ? (report.run as RunMetadata) : null;
    const run = readJsonFile<RunMetadata>(runMetadataPath) || runFromReport;

    if (!run && !report) {
        return null;
    }

    const startedAt = typeof run?.startedAt === 'string' ? run.startedAt : null;
    const completedAt = typeof run?.completedAt === 'string' ? run.completedAt : null;
    const fileStat = fs.statSync(reportDir);
    const timestampMs = Math.max(
        parseTimestampMs(completedAt),
        parseTimestampMs(startedAt),
        fileStat.mtimeMs
    );

    return {
        runId: typeof run?.runId === 'string' ? run.runId : reportDirectoryName,
        reportDir,
        jsonReportPath: getExistingFilePath(jsonReportPath),
        runMetadataPath: getExistingFilePath(runMetadataPath),
        summaryPath: getExistingFilePath(summaryPath),
        eventsLogPath: getExistingFilePath(eventsLogPath),
        instancePath: typeof run?.instancePath === 'string' ? run.instancePath : null,
        buildDir: typeof run?.buildDir === 'string' ? run.buildDir : null,
        serverDirName: typeof run?.serverDirName === 'string' ? run.serverDirName : null,
        startedAt,
        completedAt,
        timestampMs,
        mode: typeof run?.mode === 'string' ? run.mode : null,
        dryRun: Boolean(run?.dryRun),
        profile: typeof run?.arbiterProfile === 'string' ? run.arbiterProfile : null,
        deepCheckMode: typeof run?.deepCheckMode === 'string' ? run.deepCheckMode : null,
        validationMode: typeof run?.validationMode === 'string' ? run.validationMode : null,
        validationStatus: typeof report?.validation?.status === 'string' ? report.validation.status : null,
        registryMode: typeof run?.registryMode === 'string' ? run.registryMode : null,
        registrySource: typeof report?.registry?.sourceDescription === 'string' ? report.registry.sourceDescription : null,
        totalJarFiles: report?.stats.totalJarFiles ?? 0,
        kept: report?.stats.kept ?? 0,
        excluded: report?.stats.excluded ?? 0,
        review: report?.arbiter?.summary.finalDecisions.review ?? 0,
        warnings: report?.warnings.length ?? 0,
        errors: report?.errors.length ?? 0
    };
}

export function resolveReportRootDir(configuredReportDir: string, latestReportDir: string | null): string {
    if (latestReportDir && latestReportDir.trim()) {
        return path.dirname(path.resolve(latestReportDir));
    }

    if (configuredReportDir.trim()) {
        return path.resolve(configuredReportDir.trim());
    }

    return path.resolve(process.cwd(), 'reports');
}

export function loadReportHistory(reportRootDir: string, limit = 20): ReportHistoryState {
    const resolvedReportRootDir = path.resolve(reportRootDir);

    try {
        if (!fs.existsSync(resolvedReportRootDir)) {
            return {
                reportRootDir: resolvedReportRootDir,
                entries: [],
                error: null
            };
        }

        if (!fs.statSync(resolvedReportRootDir).isDirectory()) {
            return {
                reportRootDir: resolvedReportRootDir,
                entries: [],
                error: 'Указанная папка reports не является директорией'
            };
        }

        const entries = fs.readdirSync(resolvedReportRootDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => readHistoryEntry(path.join(resolvedReportRootDir, entry.name)))
            .filter((entry): entry is ReportHistoryEntry => entry !== null)
            .sort((left, right) => right.timestampMs - left.timestampMs)
            .slice(0, limit);

        return {
            reportRootDir: resolvedReportRootDir,
            entries,
            error: null
        };
    } catch (error) {
        return {
            reportRootDir: resolvedReportRootDir,
            entries: [],
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
