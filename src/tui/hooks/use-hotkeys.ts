import { useInput } from 'ink';

import type { FocusedColumn, ScreenId, TuiMode } from '../state/app-state.js';

const SCREEN_ORDER: ScreenId[] = ['build', 'presets', 'server', 'registry', 'reports', 'review', 'settings', 'authors'];
const DEFAULT_COLUMN_ORDER: FocusedColumn[] = ['sidebar', 'content', 'details'];

export function getAdjacentScreen(currentScreen: ScreenId, direction: 'prev' | 'next'): ScreenId {
    const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
    const fallbackScreen = SCREEN_ORDER[0] ?? 'build';

    if (currentIndex === -1) {
        return fallbackScreen;
    }

    const nextIndex = direction === 'prev'
        ? (currentIndex <= 0 ? SCREEN_ORDER.length - 1 : currentIndex - 1)
        : (currentIndex >= SCREEN_ORDER.length - 1 ? 0 : currentIndex + 1);

    return SCREEN_ORDER[nextIndex] ?? fallbackScreen;
}

export function getColumnOrder(showDetails: boolean): FocusedColumn[] {
    return showDetails ? DEFAULT_COLUMN_ORDER : ['sidebar', 'content'];
}

export function getAdjacentColumn(
    currentColumn: FocusedColumn,
    direction: 'prev' | 'next',
    showDetails: boolean
): FocusedColumn {
    const columnOrder = getColumnOrder(showDetails);
    const currentIndex = columnOrder.indexOf(currentColumn);
    const fallbackColumn = columnOrder[0] ?? 'sidebar';

    if (currentIndex === -1) {
        return fallbackColumn;
    }

    const nextIndex = direction === 'prev'
        ? (currentIndex <= 0 ? columnOrder.length - 1 : currentIndex - 1)
        : (currentIndex >= columnOrder.length - 1 ? 0 : currentIndex + 1);

    return columnOrder[nextIndex] ?? fallbackColumn;
}

export function getAdjacentPage(currentPageId: string, direction: 'prev' | 'next', pageIds: string[]): string {
    const fallbackPageId = pageIds[0] ?? '';
    const currentIndex = pageIds.indexOf(currentPageId);

    if (currentIndex === -1) {
        return fallbackPageId;
    }

    const nextIndex = direction === 'prev'
        ? (currentIndex <= 0 ? pageIds.length - 1 : currentIndex - 1)
        : (currentIndex >= pageIds.length - 1 ? 0 : currentIndex + 1);

    return pageIds[nextIndex] ?? fallbackPageId;
}

export function getPageIdFromAltDigit(input: string, pageIds: string[]): string | null {
    if (!/^[1-9]$/.test(input)) {
        return null;
    }

    return pageIds[Number(input) - 1] ?? null;
}

export function useHotkeys({
    activeScreen,
    setActiveScreen,
    activePageId,
    activePageIds,
    onActivePageChange,
    focusedColumn,
    setFocusedColumn,
    uiMode,
    setUiMode,
    showDetails,
    allowGlobalHotkeys,
    isRunning,
    onRun,
    onExit
}: {
    activeScreen: ScreenId;
    setActiveScreen: (screen: ScreenId) => void;
    activePageId: string;
    activePageIds: string[];
    onActivePageChange: (pageId: string) => void;
    focusedColumn: FocusedColumn;
    setFocusedColumn: (column: FocusedColumn) => void;
    uiMode: TuiMode;
    setUiMode: (mode: TuiMode) => void;
    showDetails: boolean;
    allowGlobalHotkeys: boolean;
    isRunning: boolean;
    onRun: () => void;
    onExit: () => void;
}): void {
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            onExit();
            return;
        }

        if (!allowGlobalHotkeys) {
            return;
        }

        if (input.toLowerCase() === 'm') {
            setUiMode(uiMode === 'simple' ? 'expert' : 'simple');
            return;
        }

        if (input.toLowerCase() === 'r' && !isRunning) {
            onRun();
            return;
        }

        if (key.meta && activePageIds.length > 1) {
            const nextPageId = getPageIdFromAltDigit(input, activePageIds);

            if (nextPageId) {
                onActivePageChange(nextPageId);
                return;
            }
        }

        if (input >= '1' && input <= String(SCREEN_ORDER.length)) {
            const nextScreen = SCREEN_ORDER[Number(input) - 1];

            if (nextScreen) {
                setActiveScreen(nextScreen);
            }

            return;
        }

        if (
            focusedColumn === 'content'
            && activePageIds.length > 1
            && (key.tab || input === ',' || input === '.')
        ) {
            onActivePageChange(getAdjacentPage(
                activePageId,
                key.shift || input === ',' ? 'prev' : 'next',
                activePageIds
            ));
            return;
        }

        if (key.leftArrow || input === '[') {
            setFocusedColumn(getAdjacentColumn(focusedColumn, 'prev', showDetails));
            return;
        }

        if (key.rightArrow || input === ']') {
            setFocusedColumn(getAdjacentColumn(focusedColumn, 'next', showDetails));
            return;
        }

        if (focusedColumn === 'sidebar' && (key.upArrow || key.downArrow)) {
            setActiveScreen(getAdjacentScreen(activeScreen, key.upArrow ? 'prev' : 'next'));
        }
    });
}
