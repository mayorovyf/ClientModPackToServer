const PLATFORM_DEPENDENCY_IDS = new Set([
    'minecraft',
    'java',
    'fabricloader',
    'forge',
    'neoforge',
    'quilt_loader'
]);

function normalizeDependencyId(modId: string | null | undefined): string {
    return String(modId || '').trim().toLowerCase();
}

function isPlatformDependency(modId: string | null | undefined): boolean {
    const normalized = normalizeDependencyId(modId);

    if (!normalized) {
        return false;
    }

    return PLATFORM_DEPENDENCY_IDS.has(normalized);
}

module.exports = {
    isPlatformDependency,
    normalizeDependencyId,
    PLATFORM_DEPENDENCY_IDS
};
