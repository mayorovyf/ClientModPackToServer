import { en } from './locales/en.js';
import { ru } from './locales/ru.js';
import type { Locale } from './types.js';

export type MessageKey = keyof typeof en;
type MessageCatalog = Record<MessageKey, string>;

export const catalogs = {
    en,
    ru
} satisfies Record<Locale, MessageCatalog>;
