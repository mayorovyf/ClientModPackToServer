interface ConstantPoolSummary {
    classNames: string[];
    utf8Values: string[];
}

function safeReadUtf8(buffer: Buffer, offset: number, length: number): string {
    try {
        return buffer.toString('utf8', offset, offset + length);
    } catch {
        return '';
    }
}

function readConstantPool(buffer: Buffer): ConstantPoolSummary {
    if (!Buffer.isBuffer(buffer) || buffer.length < 10 || buffer.readUInt32BE(0) !== 0xcafebabe) {
        return {
            classNames: [],
            utf8Values: []
        };
    }

    const constantPoolCount = buffer.readUInt16BE(8);
    const utf8Entries = new Map<number, string>();
    const classNameIndexes = new Map<number, number>();
    let offset = 10;

    for (let index = 1; index < constantPoolCount; index += 1) {
        if (offset >= buffer.length) {
            break;
        }

        const tag = buffer.readUInt8(offset);
        offset += 1;

        switch (tag) {
            case 1: {
                if (offset + 2 > buffer.length) {
                    break;
                }

                const length = buffer.readUInt16BE(offset);
                offset += 2;

                if (offset + length > buffer.length) {
                    break;
                }

                utf8Entries.set(index, safeReadUtf8(buffer, offset, length));
                offset += length;
                break;
            }
            case 7: {
                if (offset + 2 > buffer.length) {
                    break;
                }

                classNameIndexes.set(index, buffer.readUInt16BE(offset));
                offset += 2;
                break;
            }
            case 3:
            case 4:
            case 9:
            case 10:
            case 11:
            case 12:
            case 17:
            case 18:
                offset += 4;
                break;
            case 5:
            case 6:
                offset += 8;
                index += 1;
                break;
            case 8:
            case 16:
            case 19:
            case 20:
                offset += 2;
                break;
            case 15:
                offset += 3;
                break;
            default:
                return {
                    classNames: [],
                    utf8Values: []
                };
        }
    }

    const classNames = [...classNameIndexes.values()]
        .map((nameIndex) => utf8Entries.get(nameIndex) || '')
        .filter(Boolean);

    return {
        classNames,
        utf8Values: [...utf8Entries.values()].filter(Boolean)
    };
}

module.exports = {
    readConstantPool
};
