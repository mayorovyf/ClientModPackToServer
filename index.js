require('tsx/cjs');

const path = require('node:path');
const { spawn } = require('node:child_process');

const tsxCliPath = require.resolve('tsx/cli');
const tuiEntryPath = path.resolve(__dirname, 'src', 'tui', 'main.tsx');

function shouldLaunchTui(argv) {
    if (argv[0] === 'cli') {
        return false;
    }

    if (argv[0] === 'tui') {
        return true;
    }

    return argv.length === 0 && Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function runTui(argv) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [tsxCliPath, tuiEntryPath, ...argv], {
            cwd: __dirname,
            stdio: 'inherit',
            windowsHide: false
        });

        child.on('error', (error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
            resolve();
        });

        child.on('close', (exitCode) => {
            process.exitCode = exitCode ?? 0;
            resolve();
        });
    });
}

async function main() {
    const argv = process.argv.slice(2);

    if (shouldLaunchTui(argv)) {
        const tuiArgs = argv[0] === 'tui' ? argv.slice(1) : argv;
        await runTui(tuiArgs);
        return;
    }

    const cliArgs = argv[0] === 'cli' ? argv.slice(1) : argv;
    const { main: runCli } = require('./src/cli/main');
    await runCli(cliArgs);
}

void main();
