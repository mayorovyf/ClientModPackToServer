import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';

import { cycleOption } from '../state/app-state.js';
import type { RunFormState, RunSessionState, TuiMode } from '../state/app-state.js';

type EditableField =
    | 'inputPath'
    | 'outputPath'
    | 'reportDir'
    | 'dryRun'
    | 'profile'
    | 'deepCheckMode'
    | 'validationMode'
    | 'registryMode'
    | 'run';

interface FieldDefinition {
    key: EditableField;
    label: string;
    value: string;
    kind: 'text' | 'toggle' | 'enum' | 'action';
    description: string;
}

const PROFILE_VALUES = ['safe', 'balanced', 'aggressive'] as const;
const DEEP_CHECK_VALUES = ['auto', 'off', 'force'] as const;
const VALIDATION_VALUES = ['off', 'auto', 'require', 'force'] as const;
const REGISTRY_VALUES = ['auto', 'offline', 'refresh', 'pinned'] as const;

function buildFields(form: RunFormState, uiMode: TuiMode, isRunning: boolean): FieldDefinition[] {
    const baseFields: FieldDefinition[] = [
        {
            key: 'inputPath',
            label: 'Папка mods',
            value: form.inputPath || '<не указана>',
            kind: 'text',
            description: 'Главная входная директория с модами'
        },
        {
            key: 'outputPath',
            label: 'Папка build',
            value: form.outputPath || '<по умолчанию>',
            kind: 'text',
            description: 'Куда писать серверную сборку'
        },
        {
            key: 'reportDir',
            label: 'Папка reports',
            value: form.reportDir || '<по умолчанию>',
            kind: 'text',
            description: 'Куда писать отчёты run'
        },
        {
            key: 'dryRun',
            label: 'Dry-run',
            value: form.dryRun ? 'on' : 'off',
            kind: 'toggle',
            description: 'Только анализ без создания build output'
        }
    ];

    if (uiMode === 'expert') {
        baseFields.push(
            {
                key: 'profile',
                label: 'Arbiter profile',
                value: form.profile,
                kind: 'enum',
                description: 'safe / balanced / aggressive'
            },
            {
                key: 'deepCheckMode',
                label: 'Deep-check',
                value: form.deepCheckMode,
                kind: 'enum',
                description: 'auto / off / force'
            },
            {
                key: 'validationMode',
                label: 'Validation',
                value: form.validationMode,
                kind: 'enum',
                description: 'off / auto / require / force'
            },
            {
                key: 'registryMode',
                label: 'Registry mode',
                value: form.registryMode,
                kind: 'enum',
                description: 'auto / offline / refresh / pinned'
            }
        );
    }

    baseFields.push({
        key: 'run',
        label: isRunning ? 'Pipeline выполняется' : 'Запустить pipeline',
        value: isRunning ? 'busy' : 'ready',
        kind: 'action',
        description: 'Enter запускает headless backend runner'
    });

    return baseFields;
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
    onChange,
    onRun,
    onInteractionChange,
    compact,
    height
}: {
    form: RunFormState;
    uiMode: TuiMode;
    session: RunSessionState;
    onChange: (nextForm: RunFormState) => void;
    onRun: () => void;
    onInteractionChange: (isLocked: boolean) => void;
    compact: boolean;
    height: number;
}): React.JSX.Element {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [editingField, setEditingField] = useState<Exclude<EditableField, 'run' | 'dryRun' | 'profile' | 'deepCheckMode' | 'validationMode' | 'registryMode'> | null>(null);
    const [draftValue, setDraftValue] = useState('');
    const fields = buildFields(form, uiMode, session.status === 'running');
    const selectedField = fields[selectedIndex] || fields[0];

    useEffect(() => {
        onInteractionChange(Boolean(editingField));
    }, [editingField, onInteractionChange]);

    useEffect(() => {
        setSelectedIndex((current) => Math.min(current, Math.max(fields.length - 1, 0)));
    }, [fields.length]);

    useInput((_input, key) => {
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

    const contentLines = Math.max(6, height - 2);
    const headerLines = 3;
    const footerLines = (editingField ? 3 : 0) + (session.lastError ? 1 : 0);
    const viewportLines = Math.max(2, contentLines - headerLines - footerLines);
    const linesPerField = 2;
    const visibleFieldCount = Math.max(1, Math.floor(viewportLines / linesPerField));
    const windowRange = useMemo(
        () => getVisibleFieldWindow(fields.length, selectedIndex, visibleFieldCount),
        [fields.length, selectedIndex, visibleFieldCount]
    );
    const visibleFields = fields.slice(windowRange.start, windowRange.end);

    return (
        <Box
            flexDirection="column"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="yellow"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Text color="yellowBright">Сборка</Text>
            <Text dimColor wrap="truncate">
                {compact ? '↑/↓ выбор, Enter действие' : '↑/↓ выбирают поле, Enter редактирует или переключает значение'}
            </Text>
            <Text dimColor wrap="truncate">
                {`Поля ${windowRange.start + 1}-${windowRange.end} из ${fields.length}`}
            </Text>

            <Box marginTop={1} flexDirection="column" flexGrow={1} minWidth={0}>
                {visibleFields.map((field, index) => {
                    const actualIndex = windowRange.start + index;
                    const isSelected = actualIndex === selectedIndex;

                    return (
                        <Box key={field.key} flexDirection="column" minWidth={0}>
                            <Text color={isSelected ? 'greenBright' : 'white'} wrap="truncate">
                                {isSelected ? '▸' : ' '} {field.label}: {field.value}
                            </Text>
                            <Text dimColor wrap="truncate">{field.description}</Text>
                        </Box>
                    );
                })}
            </Box>

            {editingField || session.lastError ? (
                <Box flexDirection="column" minWidth={0}>
                    {editingField ? (
                        <Box marginTop={1} flexDirection="column" minWidth={0}>
                            <Text wrap="truncate">Введите новое значение для {editingField} и нажмите Enter:</Text>
                            <TextInput
                                defaultValue={draftValue}
                                placeholder="Введите путь..."
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
                            <Text dimColor wrap="truncate">Esc отменяет редактирование</Text>
                        </Box>
                    ) : null}

                    {session.lastError ? (
                        <Box marginTop={1}>
                            <Text color="red" wrap="truncate">Ошибка: {session.lastError}</Text>
                        </Box>
                    ) : null}
                </Box>
            ) : null}
        </Box>
    );
}
