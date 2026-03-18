type WritableLike = {
    write: (chunk: string) => unknown;
};

export interface NdjsonWriter {
    write: (value: unknown) => void;
}

export function createNdjsonWriter(stream: WritableLike = process.stdout): NdjsonWriter {
    return {
        write(value: unknown) {
            stream.write(`${JSON.stringify(value)}\n`);
        }
    };
}
