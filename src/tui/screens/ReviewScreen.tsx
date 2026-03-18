import React from 'react';
import { Box, Text } from 'ink';
import { Badge } from '@inkjs/ui';

import type { ReportDecisionSummary } from '../../types/report.js';
import { useScrollOffset } from '../hooks/use-scroll-offset.js';
import type { RunSessionState } from '../state/app-state.js';

export function ReviewScreen({
    session,
    compact,
    height
}: {
    session: RunSessionState;
    compact: boolean;
    height: number;
}): React.JSX.Element {
    const reviewDecisions: ReportDecisionSummary[] = (session.lastReport?.decisions || []).filter(
        (decision: ReportDecisionSummary) => decision.requiresReview || decision.finalSemanticDecision === 'review'
    );

    const visibleDecisionLimit = Math.max(1, Math.floor((height - 7) / 3));
    const { offset, hasOverflow } = useScrollOffset({
        itemCount: reviewDecisions.length,
        viewportSize: visibleDecisionLimit
    });
    const visibleDecisions = reviewDecisions.slice(offset, offset + visibleDecisionLimit);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="red"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="redBright">Спорные моды</Text>
                <Box marginTop={1}>
                    <Badge color="yellow">{`Review ${reviewDecisions.length}`}</Badge>
                </Box>
                {hasOverflow ? (
                    <Text dimColor wrap="truncate">
                        {`↑/↓ прокрутка | ${offset + 1}-${Math.min(offset + visibleDecisions.length, reviewDecisions.length)} из ${reviewDecisions.length}`}
                    </Text>
                ) : null}
            </Box>
            <Box flexDirection="column" minWidth={0}>
                {reviewDecisions.length === 0 ? (
                    <Text dimColor wrap="truncate">
                        После последнего запуска спорных модов не было
                    </Text>
                ) : null}
                {visibleDecisions.map((decision) => (
                    <Box key={decision.fileName} marginBottom={1} flexDirection="column" minWidth={0}>
                        <Text wrap="truncate">{decision.fileName}</Text>
                        <Text dimColor wrap="truncate">{decision.reason}</Text>
                        <Text dimColor wrap="truncate">
                            {`semantic=${decision.finalSemanticDecision || 'n/a'} confidence=${decision.finalConfidence || 'none'} origin=${decision.decisionOrigin}`}
                        </Text>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
