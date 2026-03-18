import React from 'react';
import { Box } from 'ink';

import type { TerminalLayout } from '../hooks/use-terminal-layout.js';

export function Layout({
    sidebar,
    content,
    details,
    showDetails = true,
    statusBar,
    layout
}: {
    sidebar: React.ReactNode;
    content: React.ReactNode;
    details?: React.ReactNode;
    showDetails?: boolean;
    statusBar: React.ReactNode;
    layout: TerminalLayout;
}): React.JSX.Element {
    const contentWithSidebar = layout.sidebarInline ? (
        <Box
            flexDirection="row"
            alignItems="stretch"
            height={layout.contentAreaHeight}
            minWidth={0}
            flexGrow={1}
        >
            <Box width={layout.sidebarWidth} height={layout.sidebarHeight} flexShrink={0}>
                {sidebar}
            </Box>
            <Box width={layout.gap} flexShrink={0} />
            <Box flexGrow={1} height={layout.screenAreaHeight} minWidth={0}>
                {content}
            </Box>
        </Box>
    ) : (
        <Box flexDirection="column" width={layout.columns} height={layout.contentAreaHeight} minWidth={0}>
            <Box height={layout.sidebarHeight} marginBottom={layout.gap}>
                {sidebar}
            </Box>
            <Box flexGrow={1} height={layout.screenAreaHeight} minWidth={0}>
                {content}
            </Box>
        </Box>
    );

    const mainArea = !showDetails ? (
        <Box width={layout.columns} height={layout.mainAreaHeight} minWidth={0}>
            {contentWithSidebar}
        </Box>
    ) : layout.detailsInline ? (
        <Box
            flexDirection="row"
            alignItems="stretch"
            width={layout.columns}
            height={layout.mainAreaHeight}
            minWidth={0}
        >
            {contentWithSidebar}
            <Box marginLeft={layout.gap} width={layout.detailsWidth} height={layout.mainAreaHeight} flexShrink={0}>
                {details}
            </Box>
        </Box>
    ) : (
        <Box flexDirection="column" width={layout.columns} height={layout.mainAreaHeight} minWidth={0}>
            {contentWithSidebar}
            <Box height={layout.gap} flexShrink={0} />
            <Box height={layout.detailsHeight} minWidth={0}>
                {details}
            </Box>
        </Box>
    );

    return (
        <Box
            flexDirection="column"
            width={layout.columns}
            height={layout.rootHeight}
            paddingX={layout.padding}
            paddingY={layout.padding}
            minWidth={0}
        >
            {mainArea}
            <Box height={layout.statusBarGap} flexShrink={0} />
            <Box width={layout.columns} height={layout.statusBarHeight} minWidth={0}>
                {statusBar}
            </Box>
        </Box>
    );
}
