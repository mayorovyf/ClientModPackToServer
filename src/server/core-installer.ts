import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { resolveManagedServerEntrypoint } from './entrypoint.js';
import { ensureServerEulaAccepted } from './runtime.js';

import type { ServerCoreInstallRequest, ServerCoreInstallResult } from './types.js';

interface FabricInstallerVersion {
    version: string;
    stable: boolean;
    url: string;
}

interface FabricLoaderVersionEntry {
    loader: {
        version: string;
        stable: boolean;
    };
}

function ensureDirectory(directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Request failed: ${url} (${response.status})`);
    }

    return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Request failed: ${url} (${response.status})`);
    }

    return response.text();
}

async function downloadFile(url: string, filePath: string): Promise<void> {
    const response = await fetch(url);

    if (!response.ok || !response.body) {
        throw new Error(`Download failed: ${url} (${response.status})`);
    }

    ensureDirectory(path.dirname(filePath));
    await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(filePath));
}

function isStableVersion(version: string): boolean {
    return !/(alpha|beta|pre|rc)/i.test(version);
}

export function selectPreferredVersion(versions: string[]): string | null {
    const stableVersion = versions.find((version) => isStableVersion(version));
    return stableVersion || versions[0] || null;
}

export function extractVersionsFromMavenMetadata(xml: string): string[] {
    const matches = [...xml.matchAll(/<version>([^<]+)<\/version>/g)];
    return matches.map((match) => String(match[1] || '').trim()).filter(Boolean).reverse();
}

function requireMinecraftVersion(value: string): string {
    const normalized = String(value || '').trim();

    if (!normalized) {
        throw new Error('Minecraft version is required for core installation');
    }

    return normalized;
}

export async function resolveLatestFabricInstallerVersion(): Promise<string> {
    const installers = await fetchJson<FabricInstallerVersion[]>('https://meta.fabricmc.net/v2/versions/installer');
    const preferredInstaller = installers.find((installer) => installer.stable) || installers[0];

    if (!preferredInstaller?.version) {
        throw new Error('Unable to resolve latest Fabric installer version');
    }

    return preferredInstaller.version;
}

export async function resolveLatestFabricLoaderVersion(minecraftVersion: string): Promise<string> {
    const entries = await fetchJson<FabricLoaderVersionEntry[]>(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(minecraftVersion)}`);
    const preferredEntry = entries.find((entry) => entry.loader?.stable) || entries[0];
    const loaderVersion = preferredEntry?.loader?.version;

    if (!loaderVersion) {
        throw new Error(`Unable to resolve Fabric loader version for Minecraft ${minecraftVersion}`);
    }

    return loaderVersion;
}

async function installFabricCore({
    targetDir,
    minecraftVersion,
    loaderVersion = null,
    acceptEula = false
}: ServerCoreInstallRequest): Promise<ServerCoreInstallResult> {
    const normalizedMinecraftVersion = requireMinecraftVersion(minecraftVersion);
    const resolvedLoaderVersion = loaderVersion && String(loaderVersion).trim()
        ? String(loaderVersion).trim()
        : await resolveLatestFabricLoaderVersion(normalizedMinecraftVersion);
    const installerVersion = await resolveLatestFabricInstallerVersion();
    const artifactPath = path.join(targetDir, 'fabric-server-launch.jar');
    const serverJarUrl = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(normalizedMinecraftVersion)}/${encodeURIComponent(resolvedLoaderVersion)}/${encodeURIComponent(installerVersion)}/server/jar`;

    ensureDirectory(targetDir);
    await downloadFile(serverJarUrl, artifactPath);

    if (acceptEula) {
        ensureServerEulaAccepted(targetDir);
    }

    const entrypoint = resolveManagedServerEntrypoint({
        serverDir: targetDir,
        explicitEntrypointPath: artifactPath
    });

    return {
        coreType: 'fabric',
        targetDir,
        minecraftVersion: normalizedMinecraftVersion,
        loaderVersion: resolvedLoaderVersion,
        entrypointPath: entrypoint?.path || artifactPath,
        downloadedArtifactPath: artifactPath,
        installedAt: new Date().toISOString(),
        notes: [
            `Installed Fabric server bootstrap for Minecraft ${normalizedMinecraftVersion}`,
            `Resolved Fabric loader version: ${resolvedLoaderVersion}`,
            `Resolved Fabric installer version: ${installerVersion}`
        ]
    };
}

export async function resolveLatestForgeVersion(minecraftVersion: string): Promise<string> {
    const metadata = await fetchText('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');
    const versions = extractVersionsFromMavenMetadata(metadata)
        .filter((version) => version.startsWith(`${minecraftVersion}-`));
    const selectedVersion = selectPreferredVersion(versions);

    if (!selectedVersion) {
        throw new Error(`Unable to resolve Forge version for Minecraft ${minecraftVersion}`);
    }

    return selectedVersion;
}

export function toNeoForgePrefix(minecraftVersion: string): string {
    return minecraftVersion.startsWith('1.') ? minecraftVersion.slice(2) : minecraftVersion;
}

export async function resolveLatestNeoForgeVersion(minecraftVersion: string): Promise<string> {
    const metadata = await fetchText('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');
    const prefix = `${toNeoForgePrefix(minecraftVersion)}.`;
    const versions = extractVersionsFromMavenMetadata(metadata)
        .filter((version) => version.startsWith(prefix));
    const selectedVersion = selectPreferredVersion(versions);

    if (!selectedVersion) {
        throw new Error(`Unable to resolve NeoForge version for Minecraft ${minecraftVersion}`);
    }

    return selectedVersion;
}

async function runJavaInstaller({
    javaPath = null,
    installerJarPath,
    targetDir
}: {
    javaPath?: string | null;
    installerJarPath: string;
    targetDir: string;
}): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const javaExecutable = javaPath && String(javaPath).trim() ? String(javaPath).trim() : 'java';

    return new Promise((resolve, reject) => {
        const child = spawn(javaExecutable, ['-jar', installerJarPath, '--installServer', '.'], {
            cwd: targetDir,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8');
        });
        child.stderr?.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8');
        });
        child.on('error', reject);
        child.on('close', (exitCode) => {
            resolve({
                stdout,
                stderr,
                exitCode
            });
        });
    });
}

async function installInstallerBasedCore({
    request,
    artifactUrl,
    artifactFileName,
    notes
}: {
    request: ServerCoreInstallRequest;
    artifactUrl: string;
    artifactFileName: string;
    notes: string[];
}): Promise<ServerCoreInstallResult> {
    const { targetDir, minecraftVersion, loaderVersion = null, javaPath = null, coreType, acceptEula = false } = request;
    const toolsDir = path.join(targetDir, '.cmpts');
    const installerJarPath = path.join(toolsDir, artifactFileName);

    ensureDirectory(targetDir);
    await downloadFile(artifactUrl, installerJarPath);
    const runtime = await runJavaInstaller({
        javaPath,
        installerJarPath,
        targetDir
    });

    if (runtime.exitCode !== 0) {
        const details = [runtime.stderr.trim(), runtime.stdout.trim()].filter(Boolean).join('\n');
        throw new Error(`Failed to install ${coreType} server core${details ? `:\n${details}` : ''}`);
    }

    if (acceptEula) {
        ensureServerEulaAccepted(targetDir);
    }

    const entrypoint = resolveManagedServerEntrypoint({
        serverDir: targetDir
    });

    return {
        coreType,
        targetDir,
        minecraftVersion,
        loaderVersion: loaderVersion || '',
        entrypointPath: entrypoint?.path || null,
        downloadedArtifactPath: installerJarPath,
        installedAt: new Date().toISOString(),
        notes
    };
}

async function installForgeCore(request: ServerCoreInstallRequest): Promise<ServerCoreInstallResult> {
    const normalizedMinecraftVersion = requireMinecraftVersion(request.minecraftVersion);
    const resolvedLoaderVersion = request.loaderVersion && String(request.loaderVersion).trim()
        ? String(request.loaderVersion).trim()
        : await resolveLatestForgeVersion(normalizedMinecraftVersion);
    const artifactUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${encodeURIComponent(resolvedLoaderVersion)}/forge-${encodeURIComponent(resolvedLoaderVersion)}-installer.jar`;

    return installInstallerBasedCore({
        request: {
            ...request,
            minecraftVersion: normalizedMinecraftVersion,
            loaderVersion: resolvedLoaderVersion,
            coreType: 'forge'
        },
        artifactUrl,
        artifactFileName: `forge-${resolvedLoaderVersion}-installer.jar`,
        notes: [
            `Installed Forge server core for Minecraft ${normalizedMinecraftVersion}`,
            `Resolved Forge version: ${resolvedLoaderVersion}`
        ]
    });
}

async function installNeoForgeCore(request: ServerCoreInstallRequest): Promise<ServerCoreInstallResult> {
    const normalizedMinecraftVersion = requireMinecraftVersion(request.minecraftVersion);
    const resolvedLoaderVersion = request.loaderVersion && String(request.loaderVersion).trim()
        ? String(request.loaderVersion).trim()
        : await resolveLatestNeoForgeVersion(normalizedMinecraftVersion);
    const artifactUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${encodeURIComponent(resolvedLoaderVersion)}/neoforge-${encodeURIComponent(resolvedLoaderVersion)}-installer.jar`;

    return installInstallerBasedCore({
        request: {
            ...request,
            minecraftVersion: normalizedMinecraftVersion,
            loaderVersion: resolvedLoaderVersion,
            coreType: 'neoforge'
        },
        artifactUrl,
        artifactFileName: `neoforge-${resolvedLoaderVersion}-installer.jar`,
        notes: [
            `Installed NeoForge server core for Minecraft ${normalizedMinecraftVersion}`,
            `Resolved NeoForge version: ${resolvedLoaderVersion}`
        ]
    });
}

export async function installServerCore(request: ServerCoreInstallRequest): Promise<ServerCoreInstallResult> {
    const normalizedTargetDir = path.resolve(String(request.targetDir || '').trim());

    if (!normalizedTargetDir || normalizedTargetDir === path.resolve('.')) {
        throw new Error('Target server directory is required');
    }

    const normalizedRequest: ServerCoreInstallRequest = {
        ...request,
        targetDir: normalizedTargetDir
    };

    switch (request.coreType) {
        case 'forge':
            return installForgeCore(normalizedRequest);
        case 'neoforge':
            return installNeoForgeCore(normalizedRequest);
        case 'fabric':
        default:
            return installFabricCore(normalizedRequest);
    }
}

const coreInstallerApi = {
    extractVersionsFromMavenMetadata,
    installServerCore,
    resolveLatestFabricInstallerVersion,
    resolveLatestFabricLoaderVersion,
    resolveLatestForgeVersion,
    resolveLatestNeoForgeVersion,
    selectPreferredVersion,
    toNeoForgePrefix
};

export default coreInstallerApi;
