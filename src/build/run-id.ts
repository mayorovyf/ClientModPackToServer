const crypto = require('node:crypto');

interface CreateRunIdOptions {
    date?: Date;
    prefix?: string;
}

interface NormalizedCreateRunIdOptions {
    date: Date;
    prefix: string;
}

function pad(value: number | string, size = 2): string {
    return String(value).padStart(size, '0');
}

function normalizeCreateRunIdOptions(input?: Date | CreateRunIdOptions | null): NormalizedCreateRunIdOptions {
    if (input instanceof Date) {
        return {
            date: input,
            prefix: 'run'
        };
    }

    if (!input || typeof input !== 'object') {
        return {
            date: new Date(),
            prefix: 'run'
        };
    }

    const date = input.date instanceof Date && !Number.isNaN(input.date.getTime())
        ? input.date
        : new Date();
    const prefix = input.prefix ? String(input.prefix).trim() : 'run';

    return {
        date,
        prefix: prefix || 'run'
    };
}

function createRunId(input: Date | CreateRunIdOptions = new Date()): string {
    const { date, prefix } = normalizeCreateRunIdOptions(input);
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = pad(date.getMilliseconds(), 3);
    const suffix = crypto.randomBytes(2).toString('hex');

    return `${prefix}-${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}-${suffix}`;
}

module.exports = {
    createRunId,
    normalizeCreateRunIdOptions
};
