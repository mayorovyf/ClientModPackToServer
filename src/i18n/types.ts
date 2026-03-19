export const SUPPORTED_LOCALES = ['ru', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationValue = string | number | boolean | null | undefined;
export type TranslationParams = Record<string, TranslationValue>;
export type Translator<K extends string = string> = (key: K, params?: TranslationParams) => string;

export const DEFAULT_LOCALE: Locale = 'ru';

export function normalizeLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
    return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : fallback;
}

const i18nTypesApi = {
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    normalizeLocale
};

export default i18nTypesApi;
