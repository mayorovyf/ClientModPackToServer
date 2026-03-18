import React from 'react';
import { Box, Text } from 'ink';

import { getRunFieldDefinitions, getRunFieldDetails } from '../state/run-fields.js';
import type { RunFormState, TuiMode } from '../state/app-state.js';
import type { RunFieldKey } from '../state/run-fields.js';

function getActiveOptionLabel(fieldKey: RunFieldKey, fieldValue: string | undefined): string | null {
    switch (fieldKey) {
        case 'inputPath':
            return fieldValue === '<не указана>' ? 'Пусто' : 'Путь указан';
        case 'outputPath':
        case 'reportDir':
            return fieldValue === '<по умолчанию>' ? 'Пусто' : 'Свой путь';
        case 'serverDirName':
            return fieldValue === '<авто>' ? 'Авто' : 'Свое имя';
        case 'dryRun':
        case 'profile':
        case 'deepCheckMode':
        case 'validationMode':
        case 'registryMode':
        case 'run':
            return fieldValue || null;
        default:
            return null;
    }
}

export function RunFieldDetails({
    fieldKey,
    form,
    uiMode,
    isRunning,
    isFocused,
    height
}: {
    fieldKey: RunFieldKey;
    form: RunFormState;
    uiMode: TuiMode;
    isRunning: boolean;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const field = getRunFieldDefinitions(form, uiMode, isRunning).find((item) => item.key === fieldKey) || null;
    const details = getRunFieldDetails(fieldKey);
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
