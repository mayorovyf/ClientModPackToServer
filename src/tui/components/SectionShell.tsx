import React from 'react';
import { Box, Text } from 'ink';

import type { ScreenId, SectionPageMap } from '../state/app-state.js';
import type { SectionDefinition } from '../sections/types.js';

const SECTION_TAB_COLOR: Record<ScreenId, string> = {
    build: 'yellow',
    presets: 'blue',
    server: 'cyan',
    registry: 'blue',
    reports: 'magenta',
    review: 'red',
    settings: 'gray',
    authors: 'gray'
};

function renderTabsOnBorder<S extends ScreenId>({
    section,
    activePageId,
    isFocused
}: {
    section: SectionDefinition<S>;
    activePageId: SectionPageMap[S];
    isFocused: boolean;
}): React.JSX.Element {
    const borderColor = isFocused ? 'green' : (SECTION_TAB_COLOR[section.id] ?? 'cyan');

    return (
        <Box flexDirection="row" width="100%" minWidth={0} overflow="hidden" marginLeft={1} marginRight={1}>
            <Text color={borderColor}>───</Text>
            {section.pages.map((page, index) => (
                <Box key={String(page.id)} flexDirection="row" minWidth={0} flexShrink={0}>
                    <Text color={borderColor}>┤</Text>
                    <Text color={page.id === activePageId ? 'whiteBright' : borderColor} wrap="truncate">
                        {page.label}
                    </Text>
                    <Text color={borderColor}>├</Text>
                </Box>
            ))}
            <Box flexGrow={1} minWidth={0}>
                <Text color={borderColor} wrap="truncate">{'─'.repeat(256)}</Text>
            </Box>
        </Box>
    );
}

export function SectionShell<S extends ScreenId>({
    section,
    activePageId,
    height,
    isFocused,
    content
}: {
    section: SectionDefinition<S>;
    activePageId: SectionPageMap[S];
    height: number;
    isFocused: boolean;
    content: (contentHeight: number) => React.JSX.Element;
}): React.JSX.Element {
    const showTabs = section.pages.length > 1;
    const contentHeight = Math.max(1, height);

    return (
        <Box flexDirection="column" width="100%" height={height} minWidth={0} position="relative">
            <Box
                flexGrow={1}
                height={contentHeight}
                minWidth={0}
            >
                {content(contentHeight)}
            </Box>
            {showTabs ? (
                <Box position="absolute" width="100%" minWidth={0}>
                    {renderTabsOnBorder({ section, activePageId, isFocused })}
                </Box>
            ) : null}
        </Box>
    );
}
