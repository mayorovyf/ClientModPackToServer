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
    const gap = 1;
    const minimumCenterWidth = 45;
    const centerRatio = 3;
    const detailsRatio = 2;
    const totalRatio = centerRatio + detailsRatio;
    const minimumDetailsWidth = Math.ceil((minimumCenterWidth * detailsRatio) / centerRatio);
    const minimumRootHeight = 29;
    const minimumCompactSidebarHeight = 7;
    const minimumCompactScreenHeight = 8;
    const minimumCompactDetailsHeight = 8;
    const minimumThreeColumnWidth = sidebarWidth + minimumDetailsWidth + gap * 2 + minimumCenterWidth;
    const widthSupported = safeColumns >= minimumThreeColumnWidth;
    const heightSupported = safeRows >= minimumRootHeight;
    const sizeSupported = widthSupported && heightSupported;
    const compact = !widthSupported && heightSupported;
    const sidebarInline = sizeSupported;
    const detailsInline = sizeSupported;
    const inlineMainSplitWidth = Math.max(
        minimumDetailsWidth + minimumCenterWidth,
        safeColumns - sidebarWidth - gap * 2
    );
    const detailsWidth = detailsInline
        ? Math.max(minimumDetailsWidth, Math.floor((inlineMainSplitWidth * detailsRatio) / totalRatio))
        : minimumDetailsWidth;
    const statusBarGap = 0;
    const padding = 0;
    const statusBarHeight = 4;
    const rootHeight = safeRows;
    const mainAreaHeight = Math.max(rootHeight - statusBarHeight - statusBarGap, 10);
    const detailsHeight = detailsInline
        ? mainAreaHeight
        : clamp(
            Math.floor(mainAreaHeight * 0.35),
            minimumCompactDetailsHeight,
            Math.max(
                mainAreaHeight - minimumCompactSidebarHeight - minimumCompactScreenHeight - gap * 2,
                minimumCompactDetailsHeight
            )
        );
    const contentAreaHeight = detailsInline
        ? mainAreaHeight
        : Math.max(mainAreaHeight - detailsHeight - gap, minimumCompactSidebarHeight + minimumCompactScreenHeight + gap);
    const sidebarHeight = sidebarInline
        ? contentAreaHeight
        : clamp(
            Math.floor(contentAreaHeight * 0.28),
            minimumCompactSidebarHeight,
            Math.max(contentAreaHeight - minimumCompactScreenHeight - gap, minimumCompactSidebarHeight)
        );
    const screenAreaHeight = sidebarInline
        ? contentAreaHeight
        : Math.max(contentAreaHeight - sidebarHeight - gap, minimumCompactScreenHeight);
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
        eventLimit: clamp(detailsHeight - 5, compact ? 3 : 3, compact ? 8 : 10),
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
