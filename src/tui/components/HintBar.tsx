import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';

import type { ScreenId } from '../state/app-state.js';

function getScreenSpecificHints(
    activeScreen: ScreenId,
    activePageId: string,
    compact: boolean,
    t: ReturnType<typeof useT>
): string[] {
    switch (activeScreen) {
        case 'build':
            if (activePageId === 'launch') {
                return compact
                    ? [t('sidebar.hint.build.compact'), t('sidebar.hint.build.logMode')]
                    : [t('sidebar.hint.build.full'), t('sidebar.hint.build.logMode')];
            }

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
        case 'results':
            if (activePageId === 'overview') {
                return [
                    t('sidebar.hint.results.confirm'),
                    t('sidebar.hint.results.filter'),
                    t('sidebar.hint.results.sort'),
                    t('sidebar.hint.results.review')
                ];
            }

            return [];
        default:
            return [];
    }
}

export function HintBar({
    width,
    activeScreen,
    activePageId,
    hasMultiplePages,
    showDetails,
    isRunning,
    compact
}: {
    width: number;
    activeScreen: ScreenId;
    activePageId: string;
    hasMultiplePages: boolean;
    showDetails: boolean;
    isRunning: boolean;
    compact: boolean;
}): React.JSX.Element {
    const t = useT();
    const hints = [
        ...getScreenSpecificHints(activeScreen, activePageId, compact, t),
        ...(hasMultiplePages ? [t('sidebar.hint.pages')] : []),
        ...(showDetails ? [t('sidebar.hint.columns')] : []),
        t('sidebar.hint.move'),
        t('sidebar.hint.sections'),
        t('sidebar.hint.toggleMode'),
        ...(!isRunning ? [t('sidebar.hint.run')] : []),
        t('sidebar.hint.exit')
    ];

    return (
        <Box
            width={width}
            height={3}
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            minWidth={0}
        >
            <Text wrap="truncate">{hints.join('  ')}</Text>
        </Box>
    );
}
