const fs = require('fs');
const path = require('path');

const { RegistryCacheError } = require('../core/errors');
const { ensureDirectory } = require('../io/history');

function safeUnlink(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function safeCopy(sourcePath, destinationPath) {
    if (!fs.existsSync(sourcePath)) {
        return;
    }

    safeUnlink(destinationPath);
    fs.copyFileSync(sourcePath, destinationPath);
}

function cleanupTempFiles(tempFiles) {
    for (const filePath of tempFiles) {
        try {
            safeUnlink(filePath);
        } catch (error) {
            // ignore cleanup failures
        }
    }
}

function activateRegistryCache(layout, { manifestText, bundleText }) {
    ensureDirectory(layout.rootDir);

    const suffix = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`;
    const tempManifestPath = path.join(layout.rootDir, `.manifest.${suffix}.tmp`);
    const tempBundlePath = path.join(layout.rootDir, `.bundle.${suffix}.tmp`);

    try {
        fs.writeFileSync(tempManifestPath, manifestText, 'utf8');
        fs.writeFileSync(tempBundlePath, bundleText, 'utf8');

        safeCopy(layout.manifestPath, layout.previousManifestPath);
        safeCopy(layout.bundlePath, layout.previousBundlePath);

        safeUnlink(layout.manifestPath);
        safeUnlink(layout.bundlePath);

        fs.renameSync(tempBundlePath, layout.bundlePath);
        fs.renameSync(tempManifestPath, layout.manifestPath);

        return {
            manifestPath: layout.manifestPath,
            bundlePath: layout.bundlePath,
            previousManifestPath: layout.previousManifestPath,
            previousBundlePath: layout.previousBundlePath
        };
    } catch (error) {
        cleanupTempFiles([tempManifestPath, tempBundlePath]);
        throw new RegistryCacheError(`Не удалось активировать новый snapshot реестра в кэше: ${layout.rootDir}`, {
            cause: error
        });
    }
}

module.exports = {
    activateRegistryCache
};
