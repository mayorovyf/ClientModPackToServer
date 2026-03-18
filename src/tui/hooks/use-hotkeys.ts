import { useInput } from 'ink';

import type { FocusedColumn, ScreenId, TuiMode } from '../state/app-state.js';

const SCREEN_ORDER: ScreenId[] = ['build', 'registry', 'reports', 'review', 'settings', 'authors'];
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

export function getColumnOrder(activeScreen: ScreenId): FocusedColumn[] {
    return activeScreen === 'build' || activeScreen === 'settings'
        ? ['sidebar', 'content']
        : DEFAULT_COLUMN_ORDER;
}

export function getAdjacentColumn(
    currentColumn: FocusedColumn,
    direction: 'prev' | 'next',
    activeScreen: ScreenId
): FocusedColumn {
    const columnOrder = getColumnOrder(activeScreen);
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

export function useHotkeys({
    activeScreen,
    setActiveScreen,
    focusedColumn,
    setFocusedColumn,
    uiMode,
    setUiMode,
    allowGlobalHotkeys,
    isRunning,
    onRun,
    onExit
}: {
    activeScreen: ScreenId;
    setActiveScreen: (screen: ScreenId) => void;
    focusedColumn: FocusedColumn;
    setFocusedColumn: (column: FocusedColumn) => void;
    uiMode: TuiMode;
    setUiMode: (mode: TuiMode) => void;
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

        if (input >= '1' && input <= '6') {
            const nextScreen = SCREEN_ORDER[Number(input) - 1];

            if (nextScreen) {
                setActiveScreen(nextScreen);
            }

            return;
        }

        if (key.leftArrow || input === '[') {
            setFocusedColumn(getAdjacentColumn(focusedColumn, 'prev', activeScreen));
            return;
        }

        if (key.rightArrow || input === ']') {
            setFocusedColumn(getAdjacentColumn(focusedColumn, 'next', activeScreen));
            return;
        }

        if (focusedColumn === 'sidebar' && (key.upArrow || key.downArrow)) {
            setActiveScreen(getAdjacentScreen(activeScreen, key.upArrow ? 'prev' : 'next'));
        }
    });
}
