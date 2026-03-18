import React from 'react';
import { pathToFileURL } from 'node:url';
import { render } from 'ink';

import { App } from './App.js';

export function main(_argv: string[] = []): void {
    render(<App />);
}

export function isDirectTuiEntry(importMetaUrl: string, argv1: string | undefined): boolean {
    if (!argv1) {
        return false;
    }

    return importMetaUrl === pathToFileURL(argv1).href;
}

if (isDirectTuiEntry(import.meta.url, process.argv[1])) {
    main();
}
