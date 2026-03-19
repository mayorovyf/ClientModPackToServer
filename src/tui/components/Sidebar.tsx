import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';

import type { NavigationItem, RunSessionStatus, ScreenId, TuiMode } from '../state/app-state.js';

function StatusPill({ status }: { status: RunSessionStatus }): React.JSX.Element {
    const t = useT();

    switch (status) {
        case 'running':
            return <Text backgroundColor="yellow" color="black"> {t('status.pill.running')} </Text>;
        case 'failed':
            return <Text backgroundColor="red" color="black"> {t('status.pill.failed')} </Text>;
        case 'succeeded':
            return <Text backgroundColor="green" color="black"> {t('status.pill.succeeded')} </Text>;
        case 'idle':
        default:
            return <Text backgroundColor="green" color="black"> {t('status.pill.idle')} </Text>;
    }
}

function getScreenSpecificHints(
    activeScreen: ScreenId,
    activePageId: string,
    compact: boolean,
    t: ReturnType<typeof useT>
): string[] {
    switch (activeScreen) {
        case 'build':
            if (activePageId === 'presets') {
                return [
                    t('sidebar.hint.presets.apply'),
                    t('sidebar.hint.presets.save'),
                    t('sidebar.hint.presets.update'),
                    t('sidebar.hint.presets.delete')
                ];
            }

            return compact
                ? [t('sidebar.hint.build.compact')]
                : [t('sidebar.hint.build.full')];
        case 'server':
            return [
                t('sidebar.hint.server.enter'),
                t('sidebar.hint.server.useLatestBuild'),
                t('sidebar.hint.server.applyValidation')
            ];
        default:
            return [];
    }
}

export function Sidebar({
    items,
    activeScreen,
    activePageId,
    activePageLabel,
    hasMultiplePages,
    isFocused,
    uiMode,
    runStatus,
    showHints,
    compact,
    width,
    height
}: {
    items: NavigationItem[];
    activeScreen: ScreenId;
    activePageId: string;
    activePageLabel: string;
    hasMultiplePages: boolean;
    isFocused: boolean;
    uiMode: TuiMode;
    runStatus: RunSessionStatus;
    showHints: boolean;
    compact: boolean;
    width?: number;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const screenSpecificHints = showHints ? getScreenSpecificHints(activeScreen, activePageId, compact, t) : [];

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width={width ?? '100%'}
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'cyan'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyanBright" wrap="truncate">{compact ? 'CMPTS' : 'ClientModPackToServer'}</Text>
                <Text dimColor wrap="truncate">{uiMode === 'simple' ? t('sidebar.mode.simple') : t('sidebar.mode.expert')}</Text>
                <Text dimColor wrap="truncate">{t('sidebar.page', { page: activePageLabel })}</Text>
                <Box marginTop={1}>
                    <StatusPill status={runStatus} />
                </Box>

                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    {items.map((item, index) => {
                        const isActive = item.id === activeScreen;

                        return (
                            <Box key={item.id} marginBottom={1}>
                                <Box flexDirection="row" alignItems="center" minWidth={0}>
                                    <Box width={2} minWidth={2}>
                                        <Text color={isActive ? 'greenBright' : 'white'}>
                                            {isActive ? '>' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text color={isActive ? 'greenBright' : 'white'} wrap="truncate">
                                            {`${index + 1}. ${t(item.labelKey)}`}
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                {showHints ? (
                    <>
                        {screenSpecificHints.map((hint) => (
                            <Text key={hint} dimColor wrap="truncate">{hint}</Text>
                        ))}
                        {hasMultiplePages ? <Text dimColor wrap="truncate">{t('sidebar.hint.pages')}</Text> : null}
                        {screenSpecificHints.length > 0 ? <Text dimColor wrap="truncate"> </Text> : null}
                        <Text dimColor wrap="truncate">{t('sidebar.hint.columns')}</Text>
                        <Text dimColor wrap="truncate">{t('sidebar.hint.move')}</Text>
                        <Text dimColor wrap="truncate">{t('sidebar.hint.sections')}</Text>
                        <Text dimColor wrap="truncate">{t('sidebar.hint.toggleMode')}</Text>
                        <Text dimColor wrap="truncate">{t('sidebar.hint.run')}</Text>
                        <Text dimColor wrap="truncate">{t('sidebar.hint.exit')}</Text>
                    </>
                ) : null}
            </Box>
        </Box>
    );
}
