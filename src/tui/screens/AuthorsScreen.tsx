import React from 'react';
import { Box, Text, useInput } from 'ink';

import { AUTHOR_PROFILES } from '../state/authors.js';

export function AuthorsScreen({
    selectedAuthorId,
    onSelectedAuthorChange,
    isFocused,
    height
}: {
    selectedAuthorId: string;
    onSelectedAuthorChange: (authorId: string) => void;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const selectedIndex = Math.max(
        AUTHOR_PROFILES.findIndex((author) => author.id === selectedAuthorId),
        0
    );

    useInput((_input, key) => {
        if (!isFocused || AUTHOR_PROFILES.length <= 1) {
            return;
        }

        if (key.upArrow) {
            const nextIndex = selectedIndex <= 0 ? AUTHOR_PROFILES.length - 1 : selectedIndex - 1;
            onSelectedAuthorChange(AUTHOR_PROFILES[nextIndex]?.id ?? selectedAuthorId);
            return;
        }

        if (key.downArrow) {
            const nextIndex = selectedIndex >= AUTHOR_PROFILES.length - 1 ? 0 : selectedIndex + 1;
            onSelectedAuthorChange(AUTHOR_PROFILES[nextIndex]?.id ?? selectedAuthorId);
        }
    });

    return (
        <Box
            flexDirection="column"
            justifyContent="center"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'gray'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" alignItems="center" minWidth={0}>
                {AUTHOR_PROFILES.map((author) => {
                    const isSelected = author.id === selectedAuthorId;

                    return (
                        <Box key={author.id} flexDirection="column" alignItems="center" minWidth={0}>
                            <Box flexDirection="row" alignItems="center" minWidth={0}>
                                <Box width={2} minWidth={2}>
                                    <Text color={isSelected ? 'greenBright' : 'whiteBright'}>
                                        {isSelected ? '▸' : ' '}
                                    </Text>
                                </Box>
                                <Box minWidth={0}>
                                    <Text color={isSelected ? 'greenBright' : 'whiteBright'} wrap="truncate">
                                        {author.nickname.trim()}
                                    </Text>
                                </Box>
                            </Box>
                            <Text dimColor wrap="truncate">{author.role}</Text>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
