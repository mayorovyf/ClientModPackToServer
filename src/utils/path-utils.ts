function cleanInputPath(inputPath: string | null | undefined): string {
    return String(inputPath || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\\ /g, ' ')
        .trim();
}

module.exports = {
    cleanInputPath
};
