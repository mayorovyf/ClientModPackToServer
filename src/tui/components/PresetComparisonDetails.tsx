import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
import type { RunFormState } from '../state/app-state.js';
import type { RunPreset } from '../state/presets.js';

interface FormDiffRow {
    label: string;
    presetValue: string;
    currentValue: string;
}

function formatValue(value: string | boolean, fallback: string, t: ReturnType<typeof useT>): string {
    if (typeof value === 'boolean') {
        return value ? t('common.value.on') : t('common.value.off');
    }

    return value && value.trim() ? value : fallback;
}

function buildFormDiff(
    preset: RunPreset | null,
    currentForm: RunFormState,
    t: ReturnType<typeof useT>
): FormDiffRow[] {
    if (!preset) {
        return [];
    }

    const fields: Array<{ key: keyof RunFormState; label: string; fallback: string }> = [
        { key: 'inputPath', label: t('field.run.inputPath.label'), fallback: t('common.placeholder.empty') },
        { key: 'outputPath', label: t('field.run.outputPath.label'), fallback: t('common.placeholder.default') },
        { key: 'reportDir', label: t('field.run.reportDir.label'), fallback: t('common.placeholder.default') },
        { key: 'profile', label: t('field.run.profile.label'), fallback: 'balanced' },
        { key: 'deepCheckMode', label: t('field.run.deepCheckMode.label'), fallback: 'auto' },
        { key: 'validationMode', label: t('field.run.validationMode.label'), fallback: 'auto' },
        { key: 'registryMode', label: t('field.run.registryMode.label'), fallback: 'auto' },
        { key: 'dryRun', label: t('field.run.dryRun.label'), fallback: t('common.value.off') }
    ];

    return fields.flatMap(({ key, label, fallback }) => {
        const presetValue = formatValue(preset.form[key], fallback, t);
        const currentValue = formatValue(currentForm[key], fallback, t);

        if (presetValue === currentValue) {
            return [];
        }

        return [{
            label,
            presetValue,
            currentValue
        }];
    });
}

export function PresetComparisonDetails({
    preset,
    currentForm,
    height
}: {
    preset: RunPreset | null;
    currentForm: RunFormState;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const differences = buildFormDiff(preset, currentForm, t);

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
                <Text color="greenBright" wrap="wrap">{t('preset.compare.title')}</Text>
                {preset ? (
                    <Box marginTop={1} minWidth={0}>
                        <Text wrap="wrap">{t('preset.compare.selected', { name: preset.name })}</Text>
                    </Box>
                ) : null}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                {preset ? (
                    differences.length > 0 ? (
                        <>
                            <Text color="yellow" wrap="wrap">{t('preset.compare.diffCount', { count: differences.length })}</Text>
                            {differences.map((diff) => (
                                <Box key={diff.label} marginTop={1} flexDirection="column" minWidth={0}>
                                    <Text color="whiteBright" wrap="wrap">{diff.label}</Text>
                                    <Text dimColor wrap="wrap">{t('preset.compare.presetValue', { value: diff.presetValue })}</Text>
                                    <Text dimColor wrap="wrap">{t('preset.compare.currentValue', { value: diff.currentValue })}</Text>
                                </Box>
                            ))}
                        </>
                    ) : (
                        <Text color="green" wrap="wrap">{t('preset.compare.match')}</Text>
                    )
                ) : (
                    <Text dimColor wrap="wrap">{t('preset.compare.empty')}</Text>
                )}
            </Box>
        </Box>
    );
}
