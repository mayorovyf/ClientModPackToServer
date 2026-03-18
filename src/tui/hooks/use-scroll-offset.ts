import { useEffect, useState } from 'react';
import { useInput } from 'ink';

export function useScrollOffset({
    itemCount,
    viewportSize
}: {
    itemCount: number;
    viewportSize: number;
}): {
    offset: number;
    maxOffset: number;
    hasOverflow: boolean;
} {
    const [offset, setOffset] = useState(0);
    const maxOffset = Math.max(0, itemCount - viewportSize);
    const pageSize = Math.max(1, viewportSize - 1);

    useEffect(() => {
        setOffset((current) => Math.min(current, maxOffset));
    }, [maxOffset]);

    useInput((input, key) => {
        if (maxOffset <= 0) {
            return;
        }

        if (key.upArrow || input === 'k') {
            setOffset((current) => Math.max(0, current - 1));
            return;
        }

        if (key.downArrow || input === 'j') {
            setOffset((current) => Math.min(maxOffset, current + 1));
            return;
        }

        if (key.pageUp) {
            setOffset((current) => Math.max(0, current - pageSize));
            return;
        }

        if (key.pageDown || input === ' ') {
            setOffset((current) => Math.min(maxOffset, current + pageSize));
            return;
        }

        if (key.home) {
            setOffset(0);
            return;
        }

        if (key.end) {
            setOffset(maxOffset);
        }
    });

    return {
        offset,
        maxOffset,
        hasOverflow: maxOffset > 0
    };
}
