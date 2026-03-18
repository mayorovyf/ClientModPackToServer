const { RegistryFetchError } = require('../core/errors');
const { DEFAULT_REGISTRY_FETCH_TIMEOUT_MS } = require('./constants');

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_REGISTRY_FETCH_TIMEOUT_MS, headers = {} } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            headers,
            signal: controller.signal
        });

        if (!response.ok) {
            throw new RegistryFetchError(`Запрос к реестру завершился с HTTP ${response.status}: ${url}`);
        }

        return response;
    } catch (error) {
        if (error instanceof RegistryFetchError) {
            throw error;
        }

        if (error.name === 'AbortError') {
            throw new RegistryFetchError(`Таймаут загрузки реестра (${timeoutMs}ms): ${url}`, { cause: error });
        }

        throw new RegistryFetchError(`Не удалось загрузить данные реестра: ${url}`, { cause: error });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchRegistryText(url, options = {}) {
    const response = await fetchWithTimeout(url, options);
    return response.text();
}

async function fetchRegistryBuffer(url, options = {}) {
    const response = await fetchWithTimeout(url, options);
    return Buffer.from(await response.arrayBuffer());
}

module.exports = {
    fetchRegistryBuffer,
    fetchRegistryText
};
