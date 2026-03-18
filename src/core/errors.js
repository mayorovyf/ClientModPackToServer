class AppError extends Error {
    constructor(message, { code = 'APP_ERROR', cause } = {}) {
        super(message);
        this.name = new.target.name;
        this.code = code;

        if (cause) {
            this.cause = cause;
        }
    }
}

class ConfigurationError extends AppError {
    constructor(message, options = {}) {
        super(message, { code: 'CONFIGURATION_ERROR', ...options });
    }
}

class RunConfigurationError extends ConfigurationError {
    constructor(message, options = {}) {
        super(message, { code: 'RUN_CONFIGURATION_ERROR', ...options });
    }
}

class FileSystemError extends AppError {
    constructor(message, options = {}) {
        super(message, { code: 'FILESYSTEM_ERROR', ...options });
    }
}

class FileReadError extends FileSystemError {
    constructor(message, options = {}) {
        super(message, { code: 'FILE_READ_ERROR', ...options });
    }
}

class DirectoryCreationError extends FileSystemError {
    constructor(message, options = {}) {
        super(message, { code: 'DIRECTORY_CREATION_ERROR', ...options });
    }
}

class FileMoveError extends FileSystemError {
    constructor(message, options = {}) {
        super(message, { code: 'FILE_MOVE_ERROR', ...options });
    }
}

class ArchiveError extends AppError {
    constructor(message, options = {}) {
        super(message, { code: 'ARCHIVE_ERROR', ...options });
    }
}

class ArchiveReadError extends ArchiveError {
    constructor(message, options = {}) {
        super(message, { code: 'ARCHIVE_READ_ERROR', ...options });
    }
}

class ArchiveEntryReadError extends ArchiveError {
    constructor(message, options = {}) {
        super(message, { code: 'ARCHIVE_ENTRY_READ_ERROR', ...options });
    }
}

class MetadataParseError extends AppError {
    constructor(message, options = {}) {
        super(message, { code: 'METADATA_PARSE_ERROR', ...options });
    }
}

class RegistryError extends AppError {
    constructor(message, options = {}) {
        super(message, { code: 'REGISTRY_ERROR', ...options });
    }
}

class RegistryFetchError extends RegistryError {
    constructor(message, options = {}) {
        super(message, { code: 'REGISTRY_FETCH_ERROR', ...options });
    }
}

class RegistryValidationError extends RegistryError {
    constructor(message, options = {}) {
        super(message, { code: 'REGISTRY_VALIDATION_ERROR', ...options });
    }
}

class RegistryCacheError extends RegistryError {
    constructor(message, options = {}) {
        super(message, { code: 'REGISTRY_CACHE_ERROR', ...options });
    }
}

class BuildError extends AppError {
    constructor(message, options = {}) {
        super(message, { code: 'BUILD_ERROR', ...options });
    }
}

class OutputDirectoryError extends BuildError {
    constructor(message, options = {}) {
        super(message, { code: 'OUTPUT_DIRECTORY_ERROR', ...options });
    }
}

class FileCopyError extends BuildError {
    constructor(message, options = {}) {
        super(message, { code: 'FILE_COPY_ERROR', ...options });
    }
}

class ReportWriteError extends BuildError {
    constructor(message, options = {}) {
        super(message, { code: 'REPORT_WRITE_ERROR', ...options });
    }
}

class ResultCollisionError extends BuildError {
    constructor(message, options = {}) {
        super(message, { code: 'RESULT_COLLISION_ERROR', ...options });
    }
}

class PathValidationError extends AppError {
    constructor(message, options = {}) {
        super(message, { code: 'PATH_VALIDATION_ERROR', ...options });
    }
}

class UserInputError extends AppError {
    constructor(message, options = {}) {
        super(message, { code: 'USER_INPUT_ERROR', ...options });
    }
}

module.exports = {
    AppError,
    ArchiveEntryReadError,
    ArchiveError,
    ArchiveReadError,
    BuildError,
    ConfigurationError,
    DirectoryCreationError,
    FileCopyError,
    FileMoveError,
    FileReadError,
    FileSystemError,
    MetadataParseError,
    OutputDirectoryError,
    PathValidationError,
    ReportWriteError,
    RegistryCacheError,
    RegistryError,
    RegistryFetchError,
    RegistryValidationError,
    ResultCollisionError,
    RunConfigurationError,
    UserInputError
};
