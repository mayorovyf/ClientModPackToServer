function cleanInputPath(inputPath) {
    return String(inputPath || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\\ /g, ' ')
        .trim();
}

module.exports = {
    cleanInputPath
};
