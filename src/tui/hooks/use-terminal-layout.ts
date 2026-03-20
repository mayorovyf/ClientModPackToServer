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
    brandWidth: number;
    contentWidth: number;
    detailsWidth: number;
    gap: number;
    padding: number;
    rootHeight: number;
    headerHeight: number;
    headerGap: number;
    footerHeight: number;
    footerGap: number;
    mainAreaHeight: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function calculateTerminalLayout(columns = 120, rows = 40, showHints = true): TerminalLayout {
    const safeColumns = Math.max(columns || 120, 16);
    const safeRows = Math.max(rows || 40, 8);
    const brandWidth = 25;
    const gap = 1;
    const minimumCenterWidth = 45;
    const centerRatio = 3;
    const detailsRatio = 2;
    const totalRatio = centerRatio + detailsRatio;
    const minimumDetailsWidth = Math.ceil((minimumCenterWidth * detailsRatio) / centerRatio);
    const minimumHeaderChromeWidth = 48;
    const minimumThreeColumnWidth = Math.max(
        minimumCenterWidth + minimumDetailsWidth + gap,
        brandWidth + gap + minimumHeaderChromeWidth
    );
    const minimumRootHeight = 29;
    const headerHeight = 4;
    const headerGap = 0;
    const footerHeight = showHints ? 3 : 0;
    const footerGap = 0;
    const widthSupported = safeColumns >= minimumThreeColumnWidth;
    const heightSupported = safeRows >= minimumRootHeight;
    const sizeSupported = widthSupported && heightSupported;
    const compact = !sizeSupported;
    const detailsWidth = Math.max(minimumDetailsWidth, Math.floor((safeColumns * detailsRatio) / totalRatio));
    const contentWidth = clamp(
        safeColumns - detailsWidth - gap,
        minimumCenterWidth,
        safeColumns
    );
    const padding = 0;
    const rootHeight = safeRows;
    const mainAreaHeight = Math.max(
        rootHeight - headerHeight - headerGap - footerHeight - footerGap,
        10
    );

    return {
        columns: safeColumns,
        rows: safeRows,
        minimumThreeColumnWidth,
        minimumRootHeight,
        widthSupported,
        heightSupported,
        sizeSupported,
        compact,
        brandWidth,
        contentWidth,
        detailsWidth,
        gap,
        padding,
        rootHeight,
        headerHeight,
        headerGap,
        footerHeight,
        footerGap,
        mainAreaHeight
    };
}

function getStdoutSize(stdout: NodeJS.WriteStream | undefined): { columns: number; rows: number } {
    return {
        columns: stdout?.columns ?? process.stdout.columns ?? 120,
        rows: stdout?.rows ?? process.stdout.rows ?? 40
    };
}

export function useTerminalLayout(showHints: boolean): TerminalLayout {
    const { stdout } = useStdout();
    const output = stdout as NodeJS.WriteStream | undefined;
    const [layout, setLayout] = useState<TerminalLayout>(() => {
        const size = getStdoutSize(output);
        return calculateTerminalLayout(size.columns, size.rows, showHints);
    });

    useEffect(() => {
        const updateLayout = () => {
            const size = getStdoutSize(output);
            setLayout(calculateTerminalLayout(size.columns, size.rows, showHints));
        };

        updateLayout();
        output?.on?.('resize', updateLayout);

        return () => {
            output?.off?.('resize', updateLayout);
        };
    }, [output, showHints]);

    return layout;
}
