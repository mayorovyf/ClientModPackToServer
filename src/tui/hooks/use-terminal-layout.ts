import React, { useEffect, useState } from 'react';
import { useStdout } from 'ink';

export interface TerminalLayout {
    columns: number;
    rows: number;
    minimumThreeColumnWidth: number;
    minimumRootHeight: number;
    widthSupported: boolean;
    heightSupported: boolean;
    sizeSupported: boolean;
    compact: boolean;
    sidebarInline: boolean;
    detailsInline: boolean;
    sidebarWidth: number;
    detailsWidth: number;
    gap: number;
    statusBarGap: number;
    padding: number;
    eventLimit: number;
    rootHeight: number;
    statusBarHeight: number;
    mainAreaHeight: number;
    contentAreaHeight: number;
    sidebarHeight: number;
    screenAreaHeight: number;
    screenHeight: number;
    detailsHeight: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function calculateTerminalLayout(columns = 120, rows = 40): TerminalLayout {
    const safeColumns = Math.max(columns || 120, 16);
    const safeRows = Math.max(rows || 40, 8);
    const sidebarWidth = 25;
    const detailsWidth = 22;
    const gap = 1;
    const minimumCenterWidth = 45;
    const minimumRootHeight = 29;
    const minimumThreeColumnWidth = sidebarWidth + detailsWidth + gap * 2 + minimumCenterWidth;
    const widthSupported = safeColumns >= minimumThreeColumnWidth;
    const heightSupported = safeRows >= minimumRootHeight;
    const sizeSupported = widthSupported && heightSupported;
    const compact = !sizeSupported;
    const sidebarInline = sizeSupported;
    const detailsInline = sizeSupported;
    const statusBarGap = 0;
    const padding = 0;
    const statusBarHeight = 4;
    const rootHeight = safeRows;
    const mainAreaHeight = Math.max(rootHeight - statusBarHeight - statusBarGap, 10);
    const detailsHeight = detailsInline
        ? mainAreaHeight
        : clamp(Math.floor(mainAreaHeight * 0.35), 8, Math.max(mainAreaHeight - 6, 8));
    const contentAreaHeight = detailsInline
        ? mainAreaHeight
        : Math.max(mainAreaHeight - detailsHeight - gap, 8);
    const sidebarHeight = sidebarInline
        ? contentAreaHeight
        : clamp(Math.floor(contentAreaHeight * 0.28), 7, Math.max(contentAreaHeight - 6, 7));
    const screenAreaHeight = sidebarInline
        ? contentAreaHeight
        : Math.max(contentAreaHeight - sidebarHeight - gap, 8);
    const screenHeight = Math.max(screenAreaHeight - 1, 6);

    return {
        columns: safeColumns,
        rows: safeRows,
        minimumThreeColumnWidth,
        minimumRootHeight,
        widthSupported,
        heightSupported,
        sizeSupported,
        compact,
        sidebarInline,
        detailsInline,
        sidebarWidth,
        detailsWidth,
        gap,
        statusBarGap,
        padding,
        eventLimit: clamp(detailsHeight - 11, compact ? 2 : 3, compact ? 6 : 10),
        rootHeight,
        statusBarHeight,
        mainAreaHeight,
        contentAreaHeight,
        sidebarHeight,
        screenAreaHeight,
        screenHeight,
        detailsHeight
    };
}

function getStdoutSize(stdout: NodeJS.WriteStream | undefined): { columns: number; rows: number } {
    return {
        columns: stdout?.columns ?? process.stdout.columns ?? 120,
        rows: stdout?.rows ?? process.stdout.rows ?? 40
    };
}

export function useTerminalLayout(): TerminalLayout {
    const { stdout } = useStdout();
    const output = stdout as NodeJS.WriteStream | undefined;
    const [layout, setLayout] = useState<TerminalLayout>(() => {
        const size = getStdoutSize(output);
        return calculateTerminalLayout(size.columns, size.rows);
    });

    useEffect(() => {
        const updateLayout = () => {
            const size = getStdoutSize(output);
            setLayout(calculateTerminalLayout(size.columns, size.rows));
        };

        updateLayout();
        output?.on?.('resize', updateLayout);

        return () => {
            output?.off?.('resize', updateLayout);
        };
    }, [output]);

    return layout;
}
