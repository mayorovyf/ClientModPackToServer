import type { RunFormState, TuiMode } from './app-state.js';

export type SettingsFieldKey =
    | 'uiMode'
    | 'showHints'
    | 'outputPath'
    | 'reportDir'
    | 'serverDirName'
    | 'runIdPrefix'
    | 'profile'
    | 'deepCheckMode'
    | 'validationMode'
    | 'validationTimeoutMs'
    | 'validationEntrypointPath'
    | 'validationSaveArtifacts'
    | 'registryMode'
    | 'registryManifestUrl'
    | 'registryBundleUrl'
    | 'registryFilePath'
    | 'registryOverridesPath'
    | 'enabledEngineNames'
    | 'disabledEngineNames';

export interface SettingsFieldDefinition {
    key: SettingsFieldKey;
    label: string;
    value: string;
    kind: 'text' | 'toggle' | 'enum';
    description: string;
}

export interface SettingsFieldOptionDescription {
    label: string;
    description: string;
}

export interface SettingsFieldDetails {
    title: string;
    overview: string;
    options: SettingsFieldOptionDescription[];
    note?: string;
}

const SETTINGS_FIELD_DETAILS: Record<SettingsFieldKey, SettingsFieldDetails> = {
    uiMode: {
        title: 'Режим интерфейса',
        overview: 'Переключает состав экранов и уровень детализации формы запуска.',
        options: [
            { label: 'simple', description: 'Показывает только основные элементы для обычного запуска.' },
            { label: 'expert', description: 'Открывает расширенные поля анализа и тонкие настройки pipeline.' }
        ]
    },
    showHints: {
        title: 'Подсказки интерфейса',
        overview: 'Управляет нижним блоком навигационных подсказок в левом столбце.',
        options: [
            { label: 'on', description: 'Подсказки по стрелкам, режиму и запуску остаются видимыми.' },
            { label: 'off', description: 'Левый столбец становится чище и не показывает справку по клавишам.' }
        ]
    },
    outputPath: {
        title: 'Папка build по умолчанию',
        overview: 'Корневая директория, внутри которой создаётся итоговая серверная папка.',
        options: [
            { label: 'По умолчанию', description: 'Используется стандартный каталог `build/` в корне проекта.' },
            { label: 'Свой путь', description: 'Итоговая серверная папка создаётся внутри указанной директории.' }
        ]
    },
    reportDir: {
        title: 'Папка reports по умолчанию',
        overview: 'Корневая директория для `report.json`, `summary.md` и `events.log`.',
        options: [
            { label: 'По умолчанию', description: 'Используется стандартный каталог `reports/` в корне проекта.' },
            { label: 'Свой путь', description: 'Отчёты запуска сохраняются в указанную директорию.' }
        ]
    },
    serverDirName: {
        title: 'Имя серверной папки',
        overview: 'Определяет имя итоговой серверной папки внутри build root.',
        options: [
            { label: 'Авто', description: 'Имя строится автоматически по названию инстанса.' },
            { label: 'Свое имя', description: 'Серверная сборка будет сохранена в папку с указанным именем.' }
        ],
        note: 'Это имя каталога, а не полный путь.'
    },
    runIdPrefix: {
        title: 'Префикс run ID',
        overview: 'Задаёт префикс для идентификаторов запуска и каталогов отчётов.',
        options: [
            { label: 'По умолчанию', description: 'Используется стандартный префикс `run`.' },
            { label: 'Свой префикс', description: 'Новые отчёты и run ID будут создаваться с указанным префиксом.' }
        ]
    },
    profile: {
        title: 'Arbiter profile',
        overview: 'Определяет, насколько осторожно финальный арбитр обращается со спорными модами.',
        options: [
            { label: 'safe', description: 'Максимально осторожный режим, чаще оставляет спорные моды на review.' },
            { label: 'balanced', description: 'Базовый режим с умеренным балансом между keep и remove.' },
            { label: 'aggressive', description: 'Более жёсткий режим, быстрее исключает клиентские моды.' }
        ]
    },
    deepCheckMode: {
        title: 'Deep-check',
        overview: 'Управляет углублённой проверкой спорных модов по содержимому архивов.',
        options: [
            { label: 'auto', description: 'Запускается только там, где это действительно нужно.' },
            { label: 'off', description: 'Углублённая проверка полностью отключена.' },
            { label: 'force', description: 'Пытается выполнять deep-check принудительно там, где он поддерживается.' }
        ]
    },
    validationMode: {
        title: 'Validation',
        overview: 'Задаёт поведение post-build smoke-test после сборки серверной папки.',
        options: [
            { label: 'off', description: 'Smoke-test не запускается.' },
            { label: 'auto', description: 'Запускается только когда найден рабочий server entrypoint.' },
            { label: 'require', description: 'Нельзя тихо пропустить проверку, иначе run завершается ошибкой.' },
            { label: 'force', description: 'Жёстко требует успешного прохождения smoke-test.' }
        ]
    },
    validationTimeoutMs: {
        title: 'Validation timeout',
        overview: 'Максимальное время ожидания smoke-test в миллисекундах.',
        options: [
            { label: 'По умолчанию', description: 'Используется стандартный timeout проекта.' },
            { label: 'Свое значение', description: 'Smoke-test завершится по пользовательскому таймауту.' }
        ]
    },
    validationEntrypointPath: {
        title: 'Validation entrypoint',
        overview: 'Явный путь до server launcher для smoke-test.',
        options: [
            { label: 'Авто', description: 'Entrypoint определяется автоматически по собранной серверной папке.' },
            { label: 'Свой путь', description: 'Validation использует указанный launcher вместо auto-detect.' }
        ]
    },
    validationSaveArtifacts: {
        title: 'Validation artifacts',
        overview: 'Определяет, нужно ли сохранять stdout/stderr smoke-test в каталог отчётов.',
        options: [
            { label: 'off', description: 'Артефакты сохраняются только по обычной логике проекта.' },
            { label: 'on', description: 'stdout и stderr validation принудительно записываются в report dir.' }
        ]
    },
    registryMode: {
        title: 'Registry mode',
        overview: 'Определяет, откуда загружать effective registry во время запуска.',
        options: [
            { label: 'auto', description: 'Пробует remote, затем кэш, затем встроенный fallback.' },
            { label: 'offline', description: 'Использует только локальные данные без сети.' },
            { label: 'refresh', description: 'Требует обновление из remote manifest/bundle.' },
            { label: 'pinned', description: 'Фиксируется на локальном embedded/cached состоянии.' }
        ]
    },
    registryManifestUrl: {
        title: 'Registry manifest URL',
        overview: 'URL удалённого manifest.json для загрузки реестра.',
        options: [
            { label: 'Не задано', description: 'Используется стандартный источник проекта или локальный fallback.' },
            { label: 'Указано', description: 'Remote registry будет читать manifest по указанному URL.' }
        ]
    },
    registryBundleUrl: {
        title: 'Registry bundle URL',
        overview: 'Явный URL bundle-файла реестра.',
        options: [
            { label: 'Не задано', description: 'Bundle URL берётся из manifest или стандартной конфигурации.' },
            { label: 'Указано', description: 'Remote registry будет использовать явно заданный bundle URL.' }
        ],
        note: 'Для bundle URL обычно нужен и manifest URL.'
    },
    registryFilePath: {
        title: 'Локальный registry file',
        overview: 'Путь до локального JSON-файла с базовым реестром.',
        options: [
            { label: 'Не задано', description: 'Используется стандартный файл реестра проекта.' },
            { label: 'Указано', description: 'Базовый registry будет прочитан из указанного файла.' }
        ]
    },
    registryOverridesPath: {
        title: 'Локальные overrides',
        overview: 'Путь до локального JSON-файла с переопределениями правил.',
        options: [
            { label: 'Не задано', description: 'Используется стандартный файл overrides проекта.' },
            { label: 'Указано', description: 'Локальные переопределения будут загружены из указанного файла.' }
        ]
    },
    enabledEngineNames: {
        title: 'Включённые engines',
        overview: 'Список движков классификации через запятую, которые нужно принудительно включить.',
        options: [
            { label: 'По умолчанию', description: 'Используется стандартный набор движков проекта.' },
            { label: 'Свой список', description: 'Backend запускается только с указанным набором engines.' }
        ],
        note: 'Формат: `metadata-engine, registry-engine`.'
    },
    disabledEngineNames: {
        title: 'Отключённые engines',
        overview: 'Список движков классификации через запятую, которые нужно отключить.',
        options: [
            { label: 'Пусто', description: 'Ни один engine не отключается принудительно.' },
            { label: 'Свой список', description: 'Указанные engines будут исключены из запуска.' }
        ],
        note: 'Формат: `filename-engine` или список через запятую.'
    }
};

export function getSettingsFieldDefinitions({
    form,
    uiMode,
    showHints
}: {
    form: RunFormState;
    uiMode: TuiMode;
    showHints: boolean;
}): SettingsFieldDefinition[] {
    return [
        {
            key: 'uiMode',
            label: 'Режим интерфейса',
            value: uiMode,
            kind: 'enum',
            description: 'Состав экранов TUI'
        },
        {
            key: 'showHints',
            label: 'Подсказки',
            value: showHints ? 'on' : 'off',
            kind: 'toggle',
            description: 'Помощь по клавишам'
        },
        {
            key: 'outputPath',
            label: 'Build root',
            value: form.outputPath || '<по умолчанию>',
            kind: 'text',
            description: 'Корень серверных сборок'
        },
        {
            key: 'reportDir',
            label: 'Reports root',
            value: form.reportDir || '<по умолчанию>',
            kind: 'text',
            description: 'Корень папки отчётов'
        },
        {
            key: 'serverDirName',
            label: 'Папка сервера',
            value: form.serverDirName || '<авто>',
            kind: 'text',
            description: 'Имя папки сервера'
        },
        {
            key: 'runIdPrefix',
            label: 'Run ID prefix',
            value: form.runIdPrefix || '<по умолчанию>',
            kind: 'text',
            description: 'Префикс ID запуска'
        },
        {
            key: 'profile',
            label: 'Arbiter profile',
            value: form.profile,
            kind: 'enum',
            description: 'Строгость решений арбитра'
        },
        {
            key: 'deepCheckMode',
            label: 'Deep-check',
            value: form.deepCheckMode,
            kind: 'enum',
            description: 'Глубокая проверка модов'
        },
        {
            key: 'validationMode',
            label: 'Validation mode',
            value: form.validationMode,
            kind: 'enum',
            description: 'Проверка серверной сборки'
        },
        {
            key: 'validationTimeoutMs',
            label: 'Validation timeout',
            value: form.validationTimeoutMs || '<по умолчанию>',
            kind: 'text',
            description: 'Таймаут smoke-test'
        },
        {
            key: 'validationEntrypointPath',
            label: 'Validation entrypoint',
            value: form.validationEntrypointPath || '<авто>',
            kind: 'text',
            description: 'Явный server launcher'
        },
        {
            key: 'validationSaveArtifacts',
            label: 'Validation artifacts',
            value: form.validationSaveArtifacts ? 'on' : 'off',
            kind: 'toggle',
            description: 'Сохранение логов проверки'
        },
        {
            key: 'registryMode',
            label: 'Registry mode',
            value: form.registryMode,
            kind: 'enum',
            description: 'Источник правил реестра'
        },
        {
            key: 'registryManifestUrl',
            label: 'Registry manifest URL',
            value: form.registryManifestUrl || '<не задано>',
            kind: 'text',
            description: 'Адрес manifest.json реестра'
        },
        {
            key: 'registryBundleUrl',
            label: 'Registry bundle URL',
            value: form.registryBundleUrl || '<не задано>',
            kind: 'text',
            description: 'Адрес bundle реестра'
        },
        {
            key: 'registryFilePath',
            label: 'Registry file',
            value: form.registryFilePath || '<по умолчанию>',
            kind: 'text',
            description: 'Локальный файл реестра'
        },
        {
            key: 'registryOverridesPath',
            label: 'Registry overrides',
            value: form.registryOverridesPath || '<по умолчанию>',
            kind: 'text',
            description: 'Локальные overrides правил'
        },
        {
            key: 'enabledEngineNames',
            label: 'Enabled engines',
            value: form.enabledEngineNames || '<по умолчанию>',
            kind: 'text',
            description: 'Включённые движки анализа'
        },
        {
            key: 'disabledEngineNames',
            label: 'Disabled engines',
            value: form.disabledEngineNames || '<пусто>',
            kind: 'text',
            description: 'Отключённые движки анализа'
        }
    ];
}

export function getSettingsFieldDetails(fieldKey: SettingsFieldKey): SettingsFieldDetails {
    return SETTINGS_FIELD_DETAILS[fieldKey];
}
