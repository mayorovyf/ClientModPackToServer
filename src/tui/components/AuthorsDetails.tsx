import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
import { getAuthorProfile } from '../state/authors.js';

function normalizeWrappedText(value: string): string {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function AuthorsDetails({
    selectedAuthorId,
    isFocused,
    height
}: {
    selectedAuthorId: string;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const author = getAuthorProfile(selectedAuthorId);
    const description = normalizeWrappedText(author.description);
    const contactLines = String(author.contact || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'cyan'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="greenBright" wrap="wrap">{author.nickname.trim()}</Text>
                <Text dimColor wrap="wrap">{author.role.trim()}</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="wrap">{description}</Text>
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('details.authors.contacts')}</Text>
                {contactLines.map((line) => (
                    <Text key={line} wrap="wrap">{line}</Text>
                ))}
            </Box>
        </Box>
    );
}
