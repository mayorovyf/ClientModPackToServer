import { useContext } from 'react';

import { I18nContext } from './I18nContext.js';

export function useT() {
    return useContext(I18nContext);
}
