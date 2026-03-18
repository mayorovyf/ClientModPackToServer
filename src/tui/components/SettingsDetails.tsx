import React from 'react';
import { Box, Text } from 'ink';

import type { RunFormState, TuiMode } from '../state/app-state.js';
import { getSettingsFieldDefinitions, getSettingsFieldDetails } from '../state/settings-fields.js';
import type { SettingsFieldKey } from '../state/settings-fields.js';

function getActiveOptionLabel(fieldKey: SettingsFieldKey, fieldValue: string | undefined): string | null {
    switch (fieldKey) {
        case 'uiMode':
        case 'profile':
        case 'deepCheckMode':
        case 'validationMode':
        case 'registryMode':
            return fieldValue || null;
        case 'showHints':
        case 'validationSaveArtifacts':
            return fieldValue === 'on' ? 'on' : 'off';
        case 'outputPath':
        case 'reportDir':
            return fieldValue === '<по умолчанию>' ? 'По умолчанию' : 'Свой путь';
        case 'serverDirName':
            return fieldValue === '<авто>' ? 'Авто' : 'Свое имя';
        case 'validationEntrypointPath':
            return fieldValue === '<авто>' ? 'Авто' : 'Свой путь';
        case 'runIdPrefix':
            return fieldValue === '<по умолчанию>' ? 'По умолчанию' : 'Свой префикс';
        case 'validationTimeoutMs':
            return fieldValue === '<по умолчанию>' ? 'По умолчанию' : 'Свое значение';
        case 'registryManifestUrl':
        case 'registryBundleUrl':
            return fieldValue === '<не задано>' ? 'Не задано' : 'Указано';
        case 'registryFilePath':
        case 'registryOverridesPath':
            return fieldValue === '<по умолчанию>' ? 'Не задано' : 'Указано';
        case 'enabledEngineNames':
            return fieldValue === '<по умолчанию>' ? 'По умолчанию' : 'Свой список';
        case 'disabledEngineNames':
            return fieldValue === '<пусто>' ? 'Пусто' : 'Свой список';
        default:
            return null;
    }
}

export function SettingsDetails({
    fieldKey,
    form,
    uiMode,
    showHints,
    height
}: {
    fieldKey: SettingsFieldKey;
    form: RunFormState;
    uiMode: TuiMode;
    showHints: boolean;
    height: number;
}): React.JSX.Element {
    const field = getSettingsFieldDefinitions({ form, uiMode, showHints }).find((item) => item.key === fieldKey) || null;
    const details = getSettingsFieldDetails(fieldKey);
    const activeOptionLabel = getActiveOptionLabel(fieldKey, field?.value);

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
                <Text color="cyan" wrap="wrap">Варианты</Text>
                {details.options.map((option) => {
                    const isActiveOption = activeOptionLabel === option.label;

                    return (
                        <Box key={option.label} flexDirection="column" minWidth={0}>
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
