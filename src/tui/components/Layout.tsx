import React from 'react';
import { Box } from 'ink';

import type { TerminalLayout } from '../hooks/use-terminal-layout.js';

export function Layout({
    header,
    content,
    details,
    showDetails = true,
    footer,
    showFooter = false,
    layout
}: {
    header: React.ReactNode;
    content: React.ReactNode;
    details?: React.ReactNode;
    showDetails?: boolean;
    footer?: React.ReactNode;
    showFooter?: boolean;
    layout: TerminalLayout;
}): React.JSX.Element {
    return (
        <Box
            flexDirection="column"
            width={layout.columns}
            height={layout.rootHeight}
            paddingX={layout.padding}
            paddingY={layout.padding}
            minWidth={0}
        >
            <Box width={layout.columns} height={layout.headerHeight} minWidth={0}>
                {header}
            </Box>

            <Box height={layout.headerGap} flexShrink={0} />

            <Box
                flexDirection="row"
                width={layout.columns}
                height={layout.mainAreaHeight}
                minWidth={0}
            >
                <Box
                    width={showDetails ? layout.contentWidth : layout.columns}
                    height={layout.mainAreaHeight}
                    minWidth={0}
                    flexGrow={showDetails ? 0 : 1}
                >
                    {content}
                </Box>

                {showDetails ? <Box width={layout.gap} flexShrink={0} /> : null}

                {showDetails ? (
                    <Box width={layout.detailsWidth} height={layout.mainAreaHeight} minWidth={0} flexShrink={0}>
                        {details}
                    </Box>
                ) : null}
            </Box>

            {showFooter ? <Box height={layout.footerGap} flexShrink={0} /> : null}

            {showFooter ? (
                <Box width={layout.columns} height={layout.footerHeight} minWidth={0}>
                    {footer}
                </Box>
            ) : null}
        </Box>
    );
}
