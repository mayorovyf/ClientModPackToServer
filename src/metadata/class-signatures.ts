interface ParsedClassSignatures {
    className: string | null;
    superClassName: string | null;
    interfaceNames: string[];
    fieldDescriptors: string[];
    methodDescriptors: string[];
    utf8Values: string[];
    classNames: string[];
}

function safeReadUtf8(buffer: Buffer, offset: number, length: number): string {
    try {
        return buffer.toString('utf8', offset, offset + length);
    } catch {
        return '';
    }
}

function emptyParsedClass(): ParsedClassSignatures {
    return {
        className: null,
        superClassName: null,
        interfaceNames: [],
        fieldDescriptors: [],
        methodDescriptors: [],
        utf8Values: [],
        classNames: []
    };
}

function parseClassSignatures(buffer: Buffer): ParsedClassSignatures {
    if (!Buffer.isBuffer(buffer) || buffer.length < 10 || buffer.readUInt32BE(0) !== 0xcafebabe) {
        return emptyParsedClass();
    }

    const constantPoolCount = buffer.readUInt16BE(8);
    const utf8Entries = new Map<number, string>();
    const classNameIndexes = new Map<number, number>();
    let offset = 10;

    const ensure = (size: number): boolean => offset + size <= buffer.length;

    for (let index = 1; index < constantPoolCount; index += 1) {
        if (!ensure(1)) {
            return emptyParsedClass();
        }

        const tag = buffer.readUInt8(offset);
        offset += 1;

        switch (tag) {
            case 1: {
                if (!ensure(2)) {
                    return emptyParsedClass();
                }

                const length = buffer.readUInt16BE(offset);
                offset += 2;

                if (!ensure(length)) {
                    return emptyParsedClass();
                }

                utf8Entries.set(index, safeReadUtf8(buffer, offset, length));
                offset += length;
                break;
            }
            case 7: {
                if (!ensure(2)) {
                    return emptyParsedClass();
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
                if (!ensure(4)) {
                    return emptyParsedClass();
                }

                offset += 4;
                break;
            case 5:
            case 6:
                if (!ensure(8)) {
                    return emptyParsedClass();
                }

                offset += 8;
                index += 1;
                break;
            case 8:
            case 16:
            case 19:
            case 20:
                if (!ensure(2)) {
                    return emptyParsedClass();
                }

                offset += 2;
                break;
            case 15:
                if (!ensure(3)) {
                    return emptyParsedClass();
                }

                offset += 3;
                break;
            default:
                return emptyParsedClass();
        }
    }

    if (!ensure(6)) {
        return emptyParsedClass();
    }

    offset += 2; // access_flags
    const thisClassIndex = buffer.readUInt16BE(offset);
    offset += 2;
    const superClassIndex = buffer.readUInt16BE(offset);
    offset += 2;

    const classNameForIndex = (classIndex: number): string | null => {
        if (!classIndex) {
            return null;
        }

        const nameIndex = classNameIndexes.get(classIndex);
        return nameIndex ? (utf8Entries.get(nameIndex) || null) : null;
    };

    if (!ensure(2)) {
        return emptyParsedClass();
    }

    const interfacesCount = buffer.readUInt16BE(offset);
    offset += 2;
    const interfaceNames: string[] = [];

    for (let index = 0; index < interfacesCount; index += 1) {
        if (!ensure(2)) {
            return emptyParsedClass();
        }

        const interfaceName = classNameForIndex(buffer.readUInt16BE(offset));
        offset += 2;

        if (interfaceName) {
            interfaceNames.push(interfaceName);
        }
    }

    const skipMembers = (collector: string[]): boolean => {
        if (!ensure(2)) {
            return false;
        }

        const count = buffer.readUInt16BE(offset);
        offset += 2;

        for (let index = 0; index < count; index += 1) {
            if (!ensure(6)) {
                return false;
            }

            offset += 2; // access_flags
            offset += 2; // name_index
            const descriptorIndex = buffer.readUInt16BE(offset);
            offset += 2;
            const descriptor = utf8Entries.get(descriptorIndex);

            if (descriptor) {
                collector.push(descriptor);
            }

            if (!ensure(2)) {
                return false;
            }

            const attributesCount = buffer.readUInt16BE(offset);
            offset += 2;

            for (let attrIndex = 0; attrIndex < attributesCount; attrIndex += 1) {
                if (!ensure(6)) {
                    return false;
                }

                offset += 2; // attribute_name_index
                const attributeLength = buffer.readUInt32BE(offset);
                offset += 4;

                if (!ensure(attributeLength)) {
                    return false;
                }

                offset += attributeLength;
            }
        }

        return true;
    };

    const fieldDescriptors: string[] = [];
    const methodDescriptors: string[] = [];

    if (!skipMembers(fieldDescriptors) || !skipMembers(methodDescriptors)) {
        return emptyParsedClass();
    }

    const classNames = [...classNameIndexes.values()]
        .map((nameIndex) => utf8Entries.get(nameIndex) || '')
        .filter(Boolean);

    return {
        className: classNameForIndex(thisClassIndex),
        superClassName: classNameForIndex(superClassIndex),
        interfaceNames,
        fieldDescriptors,
        methodDescriptors,
        utf8Values: [...utf8Entries.values()].filter(Boolean),
        classNames
    };
}

module.exports = {
    parseClassSignatures
};
