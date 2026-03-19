import React from 'react';

import i18nApi from '../../i18n/create-translator.js';

const { createTranslator } = i18nApi;

export const I18nContext = React.createContext(createTranslator());
