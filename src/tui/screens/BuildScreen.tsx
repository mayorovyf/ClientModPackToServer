import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';

import { useT } from '../i18n/use-t.js';
import { cycleOption } from '../state/app-state.js';
import type { RunFormState, RunSessionState, TuiMode } from '../state/app-state.js';
import {
    DEEP_CHECK_VALUES,
    getRunFieldDefinitions,
    PROFILE_VALUES,
    REGISTRY_VALUES,
    VALIDATION_VALUES
} from '../state/run-fields.js';
import type { RunFieldKey } from '../state/run-fields.js';

type EditableTextField = 'inputPath' | 'outputPath' | 'serverDirName' | 'reportDir';

function formatRunListValue(value: string, maxLength = 24): string {
    if (value.length <= maxLength) {
        return value;
    }

    if (value.includes('\\') || value.includes('/') || value.startsWith('http')) {
        return `...${value.slice(-(maxLength - 3))}`;
    }

    return `${value.slice(0, maxLength - 3)}...`;
}

function getVisibleFieldWindow(total: number, selectedIndex: number, maxVisible: number): { start: number; end: number } {
    if (maxVisible >= total) {
        return { start: 0, end: total };
    }

    const half = Math.floor(maxVisible / 2);
    let start = Math.max(0, selectedIndex - half);
    let end = start + maxVisible;

    if (end > total) {
        end = total;
        start = Math.max(0, end - maxVisible);
    }

    return { start, end };
}

export function BuildScreen({
    form,
    uiMode,
    session,
    fieldKeys,
    onChange,
    onRun,
    onInteractionChange,
    onSelectedFieldChange,
    isFocused,
    compact,
    height
}: {
    form: RunFormState;
    uiMode: TuiMode;
    session: RunSessionState;
    fieldKeys?: RunFieldKey[];
    onChange: (nextForm: RunFormState) => void;
    onRun: () => void;
    onInteractionChange: (isLocked: boolean) => void;
    onSelectedFieldChange: (fieldKey: RunFieldKey) => void;
    isFocused: boolean;
    compact: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [editingField, setEditingField] = useState<EditableTextField | null>(null);
    const [draftValue, setDraftValue] = useState('');
    const fields = getRunFieldDefinitions(form, uiMode, session.status === 'running', t)
        .filter((field) => !fieldKeys || fieldKeys.includes(field.key));
    const selectedField = fields[selectedIndex] || fields[0];

    useEffect(() => {
        onInteractionChange(Boolean(editingField));
    }, [editingField, onInteractionChange]);

    useEffect(() => {
        setSelectedIndex((current) => Math.min(current, Math.max(fields.length - 1, 0)));
    }, [fields.length]);

    useEffect(() => {
        if (selectedField) {
            onSelectedFieldChange(selectedField.key);
        }
    }, [onSelectedFieldChange, selectedField]);

    useInput((_input, key) => {
        if (!isFocused) {
            return;
        }

        if (editingField) {
            if (key.escape) {
                setEditingField(null);
                setDraftValue('');
            }

            return;
        }

        if (key.upArrow) {
            setSelectedIndex((current) => (current <= 0 ? fields.length - 1 : current - 1));
            return;
        }

        if (key.downArrow) {
            setSelectedIndex((current) => (current >= fields.length - 1 ? 0 : current + 1));
            return;
        }

        if (!key.return || !selectedField) {
            return;
        }

        switch (selectedField.key) {
            case 'inputPath':
            case 'outputPath':
            case 'serverDirName':
            case 'reportDir':
                setEditingField(selectedField.key);
                setDraftValue(form[selectedField.key]);
                return;
            case 'dryRun':
                onChange({
                    ...form,
                    dryRun: !form.dryRun
                });
                return;
            case 'profile':
                onChange({
                    ...form,
                    profile: cycleOption(form.profile, PROFILE_VALUES)
                });
                return;
            case 'deepCheckMode':
                onChange({
                    ...form,
                    deepCheckMode: cycleOption(form.deepCheckMode, DEEP_CHECK_VALUES)
                });
                return;
            case 'validationMode':
                onChange({
                    ...form,
                    validationMode: cycleOption(form.validationMode, VALIDATION_VALUES)
                });
                return;
            case 'registryMode':
                onChange({
                    ...form,
                    registryMode: cycleOption(form.registryMode, REGISTRY_VALUES)
                });
                return;
            case 'run':
                if (session.status !== 'running') {
                    onRun();
                }
                return;
            default:
                return;
        }
    });

    const contentLines = Math.max(6, height - 4);
    const headerLines = 3;
    const footerLines = editingField ? 4 : 0;
    const viewportLines = Math.max(2, contentLines - headerLines - footerLines);
    const linesPerField = 2;
    const visibleFieldCount = Math.max(1, Math.floor(viewportLines / linesPerField));
    const windowRange = useMemo(
        () => getVisibleFieldWindow(fields.length, selectedIndex, visibleFieldCount),
        [fields.length, selectedIndex, visibleFieldCount]
    );
    const visibleFields = fields.slice(windowRange.start, windowRange.end);
    const listHeight = visibleFieldCount * linesPerField;

    return (
        <Box
            flexDirection="column"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'yellow'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Text color="yellowBright">{t('screen.build.title')}</Text>
            <Text dimColor wrap="truncate">
                {t('screen.build.range', {
                    start: windowRange.start + 1,
                    end: windowRange.end,
                    total: fields.length
                })}
            </Text>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {visibleFields.map((field, index) => {
                    const actualIndex = windowRange.start + index;
                    const isSelected = actualIndex === selectedIndex;
                    const displayValue = formatRunListValue(field.value);

                    return (
                        <Box key={field.key} flexDirection="column" minWidth={0}>
                            <Box width="100%" minWidth={0}>
                                <Box flexDirection="row" flexGrow={1} minWidth={0}>
                                    <Box width={2} minWidth={2}>
                                        <Text color={isSelected ? 'greenBright' : 'white'}>
                                            {isSelected ? '▸' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text color={isSelected ? 'greenBright' : 'white'} wrap="truncate">
                                            {field.label}
                                        </Text>
                                    </Box>
                                </Box>
                                <Box marginLeft={1} flexShrink={0} minWidth={0}>
                                    <Text color={isSelected ? 'cyanBright' : 'gray'} wrap="truncate">
                                        {displayValue}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{field.description}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            {editingField ? (
                <Box flexDirection="column" minWidth={0}>
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text wrap="truncate">{t('screen.build.editPrompt')}</Text>
                        <TextInput
                            defaultValue={draftValue}
                            placeholder={t('screen.build.editPlaceholder')}
                            onChange={setDraftValue}
                            onSubmit={(value) => {
                                onChange({
                                    ...form,
                                    [editingField]: value
                                });
                                setEditingField(null);
                                setDraftValue('');
                            }}
                        />
                        <Text dimColor wrap="truncate">{t('screen.build.editCancel')}</Text>
                    </Box>
                </Box>
            ) : null}
        </Box>
    );
}
