import React from 'react';
import { Box, Text } from 'ink';

import type { Locale } from '../../i18n/types.js';
import { useT } from '../i18n/use-t.js';
import type { RunFormState, TuiMode } from '../state/app-state.js';
import { getSettingsFieldDefinitions, getSettingsFieldDetails } from '../state/settings-fields.js';
import type { SettingsFieldKey } from '../state/settings-fields.js';

export function SettingsDetails({
    fieldKey,
    form,
    locale,
    uiMode,
    showHints,
    height
}: {
    fieldKey: SettingsFieldKey;
    form: RunFormState;
    locale: Locale;
    uiMode: TuiMode;
    showHints: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const field = getSettingsFieldDefinitions({ form, locale, uiMode, showHints, t }).find((item) => item.key === fieldKey) || null;
    const details = getSettingsFieldDetails(fieldKey, t);
    const activeOptionId = field?.activeOptionId ?? null;

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="greenBright" wrap="wrap">{details.title}</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="wrap">{details.overview}</Text>
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('details.options')}</Text>
                {details.options.map((option) => {
                    const isActiveOption = activeOptionId === option.id;

                    return (
                        <Box key={option.id} flexDirection="column" minWidth={0}>
                            <Text color={isActiveOption ? 'greenBright' : 'whiteBright'} wrap="wrap">
                                {option.label}
                            </Text>
                            <Text dimColor wrap="wrap">{option.description}</Text>
                        </Box>
                    );
                })}
                {details.note ? (
                    <Box marginTop={1} minWidth={0}>
                        <Text color="yellow" wrap="wrap">{details.note}</Text>
                    </Box>
                ) : null}
            </Box>
        </Box>
    );
}
