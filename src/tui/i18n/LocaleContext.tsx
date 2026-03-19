import React from 'react';

import i18nTypesApi from '../../i18n/types.js';

const { DEFAULT_LOCALE } = i18nTypesApi;

export const LocaleContext = React.createContext(DEFAULT_LOCALE);
