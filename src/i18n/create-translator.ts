import { catalogs, type MessageKey } from './catalog.js';
import i18nTypesApi from './types.js';

import type { Locale, TranslationParams, Translator } from './types.js';

const { DEFAULT_LOCALE } = i18nTypesApi;

function formatTemplate(template: string, params: TranslationParams = {}): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = params[key];
        return value === undefined || value === null ? match : String(value);
    });
}

export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translator<MessageKey> {
    const fallbackCatalog = catalogs[DEFAULT_LOCALE];
    const activeCatalog = catalogs[locale] ?? fallbackCatalog;

    return (key, params = {}) => {
        const template = activeCatalog[key] ?? fallbackCatalog[key] ?? String(key);
        return formatTemplate(template, params);
    };
}

const translatorApi = {
    createTranslator
};

export default translatorApi;
