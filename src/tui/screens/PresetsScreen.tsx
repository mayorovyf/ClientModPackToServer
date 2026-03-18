import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';

import type { RunPreset } from '../state/presets.js';

function getVisibleWindow(total: number, selectedIndex: number, maxVisible: number): { start: number; end: number } {
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

function formatTimestamp(value: string): string {
    if (!value) {
        return 'n/a';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function summarizePreset(preset: RunPreset): string {
    return `${preset.form.profile} | ${preset.form.deepCheckMode} | ${preset.form.validationMode} | ${preset.form.dryRun ? 'dry-run' : 'build'}`;
}

export function PresetsScreen({
    presets,
    selectedPresetId,
    onSelectedPresetIdChange,
    onApplyPreset,
    onCreatePreset,
    onUpdatePreset,
    onDeletePreset,
    onInteractionChange,
    isFocused,
    height
}: {
    presets: RunPreset[];
    selectedPresetId: string;
    onSelectedPresetIdChange: (presetId: string) => void;
    onApplyPreset: () => void;
    onCreatePreset: (name: string) => void;
    onUpdatePreset: () => void;
    onDeletePreset: () => void;
    onInteractionChange: (locked: boolean) => void;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const initialSelectedIndex = Math.max(presets.findIndex((preset) => preset.id === selectedPresetId), 0);
    const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
    const [creatingPreset, setCreatingPreset] = useState(false);
    const [draftName, setDraftName] = useState('');

    useEffect(() => {
        onInteractionChange(creatingPreset);
    }, [creatingPreset, onInteractionChange]);

    useEffect(() => {
        setSelectedIndex(Math.max(presets.findIndex((preset) => preset.id === selectedPresetId), 0));
    }, [presets, selectedPresetId]);

    useEffect(() => {
        const activePreset = presets[selectedIndex] || null;

        if (activePreset && activePreset.id !== selectedPresetId) {
            onSelectedPresetIdChange(activePreset.id);
        }
    }, [onSelectedPresetIdChange, presets, selectedIndex, selectedPresetId]);

    useInput((input, key) => {
        if (!isFocused) {
            return;
        }

        if (creatingPreset) {
            if (key.escape) {
                setCreatingPreset(false);
                setDraftName('');
            }

            return;
        }

        if (presets.length > 1 && key.upArrow) {
            setSelectedIndex((current) => (current <= 0 ? presets.length - 1 : current - 1));
            return;
        }

        if (presets.length > 1 && key.downArrow) {
            setSelectedIndex((current) => (current >= presets.length - 1 ? 0 : current + 1));
            return;
        }

        if (key.return && presets[selectedIndex]) {
            onApplyPreset();
            return;
        }

        if (input.toLowerCase() === 'n') {
            setCreatingPreset(true);
            setDraftName('');
            return;
        }

        if (input.toLowerCase() === 'u' && presets[selectedIndex]) {
            onUpdatePreset();
            return;
        }

        if (input.toLowerCase() === 'd' && presets[selectedIndex]) {
            onDeletePreset();
        }
    });

    const contentLines = Math.max(6, height - 4);
    const headerLines = 4;
    const footerLines = creatingPreset ? 4 : 2;
    const viewportLines = Math.max(2, contentLines - headerLines - footerLines);
    const linesPerPreset = 2;
    const visiblePresetCount = Math.max(1, Math.floor(viewportLines / linesPerPreset));
    const windowRange = useMemo(
        () => getVisibleWindow(presets.length, selectedIndex, visiblePresetCount),
        [presets.length, selectedIndex, visiblePresetCount]
    );
    const visiblePresets = presets.slice(windowRange.start, windowRange.end);
    const listHeight = visiblePresetCount * linesPerPreset;

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'blue'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="blueBright">Presets</Text>
                <Text dimColor wrap="truncate">{presets.length > 0 ? `Сохранено: ${presets.length}` : 'Пресеты пока не созданы'}</Text>
                <Text dimColor wrap="truncate">Enter применяет выбранный preset</Text>
            </Box>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {visiblePresets.map((preset, index) => {
                    const actualIndex = windowRange.start + index;
                    const isSelected = actualIndex === selectedIndex;

                    return (
                        <Box key={preset.id} flexDirection="column" minWidth={0}>
                            <Box width="100%" minWidth={0}>
                                <Box flexDirection="row" flexGrow={1} minWidth={0}>
                                    <Box width={2} minWidth={2}>
                                        <Text color={isSelected ? 'greenBright' : 'white'}>
                                            {isSelected ? '▸' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text color={isSelected ? 'greenBright' : 'white'} wrap="truncate">
                                            {preset.name}
                                        </Text>
                                    </Box>
                                </Box>
                                <Box marginLeft={1} flexShrink={0} minWidth={0}>
                                    <Text color={isSelected ? 'cyanBright' : 'gray'} wrap="truncate">
                                        {formatTimestamp(preset.updatedAt)}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{summarizePreset(preset)}</Text>
                            </Box>
                        </Box>
                    );
                })}
                {presets.length === 0 ? (
                    <Text dimColor wrap="wrap">
                        Нажмите `n`, чтобы сохранить текущую форму запуска как новый preset.
                    </Text>
                ) : null}
            </Box>

            {creatingPreset ? (
                <Box flexDirection="column" minWidth={0}>
                    <Text wrap="truncate">Введите имя нового preset и нажмите Enter:</Text>
                    <TextInput
                        defaultValue={draftName}
                        placeholder="Например: safe-build"
                        onChange={setDraftName}
                        onSubmit={(value) => {
                            onCreatePreset(value);
                            setCreatingPreset(false);
                            setDraftName('');
                        }}
                    />
                    <Text dimColor wrap="truncate">Esc отменяет создание</Text>
                </Box>
            ) : (
                <Box flexDirection="column" minWidth={0}>
                    <Text dimColor wrap="truncate">n новый preset | u обновить выбранный | d удалить</Text>
                </Box>
            )}
        </Box>
    );
}
