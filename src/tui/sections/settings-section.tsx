import React from 'react';

import { AuthorsDetails } from '../components/AuthorsDetails.js';
import { RunSummary } from '../components/RunSummary.js';
import { SettingsDetails } from '../components/SettingsDetails.js';
import { AuthorsScreen } from '../screens/AuthorsScreen.js';
import { RegistryScreen } from '../screens/RegistryScreen.js';
import { SettingsScreen } from '../screens/SettingsScreen.js';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Locale, Translator } from '../../i18n/types.js';
import type { RunFormState, RunSessionState, TuiMode } from '../state/app-state.js';
import type { SettingsFieldKey } from '../state/settings-fields.js';
import type { SectionDefinition } from './types.js';

export function createSettingsSection({
    t,
    locale,
    form,
    setForm,
    uiMode,
    setLocale,
    setUiMode,
    showHints,
    setShowHints,
    session,
    compact,
    selectedSettingsField,
    onSelectedSettingsFieldChange,
    selectedAuthorId,
    onSelectedAuthorIdChange,
    onInteractionChange
}: {
    t: Translator<MessageKey>;
    locale: Locale;
    form: RunFormState;
    setForm: (nextForm: RunFormState) => void;
    uiMode: TuiMode;
    setLocale: (nextLocale: Locale) => void;
    setUiMode: (nextMode: TuiMode) => void;
    showHints: boolean;
    setShowHints: (nextValue: boolean) => void;
    session: RunSessionState;
    compact: boolean;
    selectedSettingsField: SettingsFieldKey;
    onSelectedSettingsFieldChange: (fieldKey: SettingsFieldKey) => void;
    selectedAuthorId: string;
    onSelectedAuthorIdChange: (authorId: string) => void;
    onInteractionChange: (locked: boolean) => void;
}): SectionDefinition<'settings'> {
    return {
        id: 'settings',
        label: t('nav.settings.label'),
        defaultPage: 'general',
        pages: [
            {
                id: 'general',
                label: t('page.settings.general'),
                chromeColor: 'gray',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <SettingsScreen
                        form={form}
                        locale={locale}
                        uiMode={uiMode}
                        showHints={showHints}
                        onChange={setForm}
                        onLocaleChange={setLocale}
                        onUiModeChange={setUiMode}
                        onShowHintsChange={setShowHints}
                        onInteractionChange={onInteractionChange}
                        onSelectedFieldChange={onSelectedSettingsFieldChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => (
                    <SettingsDetails
                        fieldKey={selectedSettingsField}
                        form={form}
                        locale={locale}
                        uiMode={uiMode}
                        showHints={showHints}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => showHints
                    ? t('section.settings.status.hintsVisible', { mode: uiMode === 'simple' ? t('mode.simple') : t('mode.expert') })
                    : t('section.settings.status.hintsHidden', { mode: uiMode === 'simple' ? t('mode.simple') : t('mode.expert') })
            },
            {
                id: 'registry',
                label: t('page.settings.registry'),
                chromeColor: 'blue',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <RegistryScreen
                        form={form}
                        session={session}
                        compact={compact}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <RunSummary
                        session={session}
                        compact={compact}
                        eventLimit={8}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => session.registrySnapshot
                    ? t('section.registry.status.loaded')
                    : form.registryMode === 'offline'
                        ? t('section.registry.status.offline')
                        : t('section.registry.status.reviewSources')
            },
            {
                id: 'about',
                label: t('page.settings.about'),
                chromeColor: 'gray',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <AuthorsScreen
                        selectedAuthorId={selectedAuthorId}
                        onSelectedAuthorChange={onSelectedAuthorIdChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <AuthorsDetails
                        selectedAuthorId={selectedAuthorId}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => t('section.authors.status.browse')
            }
        ]
    };
}
