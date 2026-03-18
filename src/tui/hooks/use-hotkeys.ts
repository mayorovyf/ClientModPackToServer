import { useInput } from 'ink';

import type { ScreenId, TuiMode } from '../state/app-state.js';

const SCREEN_ORDER: ScreenId[] = ['build', 'registry', 'reports', 'review', 'settings'];

export function useHotkeys({
    activeScreen,
    setActiveScreen,
    uiMode,
    setUiMode,
    allowGlobalHotkeys,
    isRunning,
    onRun,
    onExit
}: {
    activeScreen: ScreenId;
    setActiveScreen: (screen: ScreenId) => void;
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

        if (input >= '1' && input <= '5') {
            const nextScreen = SCREEN_ORDER[Number(input) - 1];

            if (nextScreen) {
                setActiveScreen(nextScreen);
            }

            return;
        }

        if (key.leftArrow || input === '[') {
            const currentIndex = SCREEN_ORDER.indexOf(activeScreen);
            const nextIndex = currentIndex <= 0 ? SCREEN_ORDER.length - 1 : currentIndex - 1;
            const nextScreen = SCREEN_ORDER[nextIndex];

            if (nextScreen) {
                setActiveScreen(nextScreen);
            }

            return;
        }

        if (key.rightArrow || input === ']') {
            const currentIndex = SCREEN_ORDER.indexOf(activeScreen);
            const nextIndex = currentIndex >= SCREEN_ORDER.length - 1 ? 0 : currentIndex + 1;
            const nextScreen = SCREEN_ORDER[nextIndex];

            if (nextScreen) {
                setActiveScreen(nextScreen);
            }
        }
    });
}
