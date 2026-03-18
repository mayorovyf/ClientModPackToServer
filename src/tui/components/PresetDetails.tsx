import React from 'react';
import { Box, Text } from 'ink';

import type { RunPreset } from '../state/presets.js';

function formatValue(value: string, fallback = 'default'): string {
    return value && value.trim() ? value : fallback;
}

export function PresetDetails({
    preset,
    height
}: {
    preset: RunPreset | null;
    height: number;
}): React.JSX.Element {
    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="blue"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="blueBright" wrap="wrap">Preset</Text>
                {preset ? (
                    <>
                        <Box marginTop={1} flexDirection="column" minWidth={0}>
                            <Text wrap="wrap">{`Имя: ${preset.name}`}</Text>
                            <Text wrap="wrap">{`Обновлён: ${preset.updatedAt}`}</Text>
                        </Box>
                        <Box marginTop={1} flexDirection="column" minWidth={0}>
                            <Text wrap="wrap">{`Input: ${formatValue(preset.form.inputPath, 'not set')}`}</Text>
                            <Text wrap="wrap">{`Build root: ${formatValue(preset.form.outputPath)}`}</Text>
                            <Text wrap="wrap">{`Reports root: ${formatValue(preset.form.reportDir)}`}</Text>
                            <Text wrap="wrap">{`Profile: ${preset.form.profile}`}</Text>
                            <Text wrap="wrap">{`Deep-check: ${preset.form.deepCheckMode}`}</Text>
                            <Text wrap="wrap">{`Validation: ${preset.form.validationMode}`}</Text>
                            <Text wrap="wrap">{`Registry: ${preset.form.registryMode}`}</Text>
                            <Text wrap="wrap">{`Mode: ${preset.form.dryRun ? 'dry-run' : 'build'}`}</Text>
                        </Box>
                    </>
                ) : (
                    <Box marginTop={1} minWidth={0}>
                        <Text dimColor wrap="wrap">
                            Сохраните текущую форму запуска как preset, чтобы быстро переключаться между режимами работы.
                        </Text>
                    </Box>
                )}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Действия</Text>
                <Text dimColor wrap="wrap">Enter применяет выбранный preset к форме запуска</Text>
                <Text dimColor wrap="wrap">n сохраняет текущую форму как новый preset</Text>
                <Text dimColor wrap="wrap">u обновляет выбранный preset текущей формой</Text>
                <Text dimColor wrap="wrap">d удаляет выбранный preset</Text>
            </Box>
        </Box>
    );
}
