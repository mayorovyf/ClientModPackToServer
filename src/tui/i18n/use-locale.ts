import { useContext } from 'react';

import { LocaleContext } from './LocaleContext.js';

export function useLocale() {
    return useContext(LocaleContext);
}
