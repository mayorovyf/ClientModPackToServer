import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
import type { RunPreset } from '../state/presets.js';

function formatValue(value: string, fallback: string): string {
    return value && value.trim() ? value : fallback;
}

export function PresetDetails({
    preset,
    height
}: {
    preset: RunPreset | null;
    height: number;
}): React.JSX.Element {
    const t = useT();

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
                <Text color="blueBright" wrap="wrap">{t('preset.details.title')}</Text>
                {preset ? (
                    <>
                        <Box marginTop={1} flexDirection="column" minWidth={0}>
                            <Text wrap="wrap">{`${t('preset.details.name')}: ${preset.name}`}</Text>
                            <Text wrap="wrap">{`${t('preset.details.updatedAt')}: ${preset.updatedAt}`}</Text>
                        </Box>
                        <Box marginTop={1} flexDirection="column" minWidth={0}>
                            <Text wrap="wrap">{`${t('field.run.inputPath.label')}: ${formatValue(preset.form.inputPath, t('common.placeholder.notSet'))}`}</Text>
                            <Text wrap="wrap">{`${t('field.run.outputPath.label')}: ${formatValue(preset.form.outputPath, t('common.placeholder.default'))}`}</Text>
                            <Text wrap="wrap">{`${t('field.run.reportDir.label')}: ${formatValue(preset.form.reportDir, t('common.placeholder.default'))}`}</Text>
                            <Text wrap="wrap">{`${t('field.run.profile.label')}: ${preset.form.profile}`}</Text>
                            <Text wrap="wrap">{`${t('field.run.deepCheckMode.label')}: ${preset.form.deepCheckMode}`}</Text>
                            <Text wrap="wrap">{`${t('field.run.validationMode.label')}: ${preset.form.validationMode}`}</Text>
                            <Text wrap="wrap">{`${t('field.run.registryMode.label')}: ${preset.form.registryMode}`}</Text>
                            <Text wrap="wrap">{`${t('preset.details.mode')}: ${preset.form.dryRun ? t('screen.presets.summary.dryRun') : t('screen.presets.summary.build')}`}</Text>
                        </Box>
                    </>
                ) : (
                    <Box marginTop={1} minWidth={0}>
                        <Text dimColor wrap="wrap">{t('preset.details.empty')}</Text>
                    </Box>
                )}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('preset.details.actions')}</Text>
                <Text dimColor wrap="wrap">{t('preset.details.action.apply')}</Text>
                <Text dimColor wrap="wrap">{t('preset.details.action.create')}</Text>
                <Text dimColor wrap="wrap">{t('preset.details.action.update')}</Text>
                <Text dimColor wrap="wrap">{t('preset.details.action.delete')}</Text>
            </Box>
        </Box>
    );
}
