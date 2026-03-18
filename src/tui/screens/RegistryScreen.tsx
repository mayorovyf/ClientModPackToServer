import React from 'react';
import { Box, Text } from 'ink';
import { Badge, StatusMessage } from '@inkjs/ui';

import type { RunFormState, RunSessionState } from '../state/app-state.js';

export function RegistryScreen({
    form,
    session,
    compact,
    height
}: {
    form: RunFormState;
    session: RunSessionState;
    compact: boolean;
    height: number;
}): React.JSX.Element {
    const registry = session.lastReport?.registry || null;

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
            <Text color="blueBright">Registry</Text>
            <Box marginTop={1} minWidth={0}>
                <StatusMessage variant={registry ? 'success' : 'info'}>
                    {registry
                        ? 'Используется effective registry последнего запуска'
                        : 'Пока доступен только конфиг перед запуском'}
                </StatusMessage>
            </Box>
            <Box marginTop={1} flexDirection="column" minWidth={0}>
                <Text wrap="truncate">Текущий mode: {form.registryMode}</Text>
                <Text wrap="truncate">Источник: {registry?.sourceDescription || 'n/a'}</Text>
                <Text wrap="truncate">Версия registry: {registry?.registryVersion || 'n/a'}</Text>
                <Text wrap="truncate">Schema version: {registry?.schemaVersion || 'n/a'}</Text>
                <Text wrap="truncate">Cache used: {registry ? (registry.usedCache ? 'yes' : 'no') : 'n/a'}</Text>
                <Text wrap="truncate">
                    Embedded fallback: {registry ? (registry.usedEmbeddedFallback ? 'yes' : 'no') : 'n/a'}
                </Text>
                <Text wrap="truncate">
                    Overrides used: {registry ? (registry.usedLocalOverrides ? 'yes' : 'no') : 'n/a'}
                </Text>
            </Box>
            <Box marginTop={1} flexDirection={compact ? 'column' : 'row'}>
                <Badge color="cyan">{`Rules ${registry?.effectiveRuleCount || 0}`}</Badge>
                {!compact ? <Text> </Text> : null}
                <Badge color="yellow">{`Warnings ${registry?.warnings.length || 0}`}</Badge>
                {!compact ? <Text> </Text> : null}
                <Badge color="red">{`Errors ${registry?.errors.length || 0}`}</Badge>
            </Box>
        </Box>
    );
}
