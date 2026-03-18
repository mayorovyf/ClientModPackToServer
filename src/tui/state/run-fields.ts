import type { RunFormState, TuiMode } from './app-state.js';

export type RunFieldKey =
    | 'inputPath'
    | 'outputPath'
    | 'serverDirName'
    | 'reportDir'
    | 'dryRun'
    | 'profile'
    | 'deepCheckMode'
    | 'validationMode'
    | 'registryMode'
    | 'run';

export interface RunFieldDefinition {
    key: RunFieldKey;
    label: string;
    value: string;
    kind: 'text' | 'toggle' | 'enum' | 'action';
    description: string;
}

export interface RunFieldOptionDescription {
    label: string;
    description: string;
}

export interface RunFieldDetails {
    title: string;
    overview: string;
    options: RunFieldOptionDescription[];
    note?: string;
}

export const PROFILE_VALUES = ['safe', 'balanced', 'aggressive'] as const;
export const DEEP_CHECK_VALUES = ['auto', 'off', 'force'] as const;
export const VALIDATION_VALUES = ['off', 'auto', 'require', 'force'] as const;
export const REGISTRY_VALUES = ['auto', 'offline', 'refresh', 'pinned'] as const;

const RUN_FIELD_DETAILS: Record<RunFieldKey, RunFieldDetails> = {
    inputPath: {
        title: 'Папка инстанса',
        overview: 'Корневая папка клиентского инстанса, внутри которой лежат `mods/`, `config/` и остальные файлы. Без неё запуск из TUI не начнётся.',
        options: [
            {
                label: 'Пусто',
                description: 'Кнопка запуска и горячая клавиша `r` ничего не делают, пока путь не заполнен.'
            },
            {
                label: 'Путь указан',
                description: 'Backend получает `--input <path>`, находит внутри инстанса папку `mods` и собирает серверную версию всего содержимого.'
            }
        ],
        note: 'Указывай корень инстанса, а не отдельную папку `mods`.'
    },
    outputPath: {
        title: 'Папка build',
        overview: 'Корневая директория, внутри которой создаётся итоговая серверная папка.',
        options: [
            {
                label: 'Пусто',
                description: 'Используется стандартный каталог `build/` в корне проекта.'
            },
            {
                label: 'Свой путь',
                description: 'Итоговая серверная папка будет создана внутри указанной директории.'
            }
        ]
    },
    serverDirName: {
        title: 'Папка сервера',
        overview: 'Имя итоговой серверной папки внутри build root. Внутри неё будут `mods`, `config` и остальные файлы инстанса.',
        options: [
            {
                label: 'Авто',
                description: 'Имя будет сгенерировано автоматически по названию инстанса.'
            },
            {
                label: 'Свое имя',
                description: 'Серверная сборка будет записана в папку с указанным именем.'
            }
        ],
        note: 'Это именно имя каталога, а не полный путь.'
    },
    reportDir: {
        title: 'Папка reports',
        overview: 'Корневая директория для артефактов запуска: `report.json`, `summary.md` и `events.log`.',
        options: [
            {
                label: 'Пусто',
                description: 'Используется стандартный каталог `reports/` в корне проекта.'
            },
            {
                label: 'Свой путь',
                description: 'Все отчёты текущего запуска сохраняются в указанную директорию.'
            }
        ]
    },
    dryRun: {
        title: 'Dry-run',
        overview: 'Переключает запуск без копирования модов и без создания итоговой серверной папки.',
        options: [
            {
                label: 'off',
                description: 'Обычный запуск: kept-моды и остальные файлы инстанса копируются в серверную папку.'
            },
            {
                label: 'on',
                description: 'Только анализ и отчёты: решения считаются, но итоговая серверная папка не создаётся.'
            }
        ]
    },
    profile: {
        title: 'Arbiter profile',
        overview: 'Определяет, насколько консервативно финальный арбитр обращается со спорными модами.',
        options: [
            {
                label: 'safe',
                description: 'Максимально осторожный режим: чаще оставляет спорные кейсы на review.'
            },
            {
                label: 'balanced',
                description: 'Рабочий режим по умолчанию: умеренно балансирует keep/remove.'
            },
            {
                label: 'aggressive',
                description: 'Более жёсткий режим: охотнее исключает спорные клиентские моды.'
            }
        ]
    },
    deepCheckMode: {
        title: 'Deep-check',
        overview: 'Управляет углублённой проверкой спорных модов по содержимому архива и внутренним сигнатурам.',
        options: [
            {
                label: 'auto',
                description: 'Deep-check запускается только для кейсов, которые действительно требуют эскалации.'
            },
            {
                label: 'off',
                description: 'Углублённая проверка выключена; решение остаётся на предыдущих сигналах.'
            },
            {
                label: 'force',
                description: 'Пытается принудительно прогонять deep-check там, где он поддерживается.'
            }
        ]
    },
    validationMode: {
        title: 'Validation',
        overview: 'Определяет поведение post-build smoke-test после того, как серверная папка уже собрана.',
        options: [
            {
                label: 'off',
                description: 'Smoke-test полностью пропускается.'
            },
            {
                label: 'auto',
                description: 'Проверка запускается только когда есть server build и найден server entrypoint.'
            },
            {
                label: 'require',
                description: 'Smoke-test обязателен: его нельзя тихо пропустить, иначе stage помечается ошибкой.'
            },
            {
                label: 'force',
                description: 'Жёсткий режим обязательной проверки с ожиданием успешного прохождения smoke-test.'
            }
        ]
    },
    registryMode: {
        title: 'Registry mode',
        overview: 'Определяет, откуда брать effective registry: из встроенного файла, кэша или удалённого источника.',
        options: [
            {
                label: 'auto',
                description: 'Пробует обновить remote registry, а при проблемах откатывается к кэшу или embedded fallback.'
            },
            {
                label: 'offline',
                description: 'Работает только с локальными данными: кэш и встроенный fallback без сети.'
            },
            {
                label: 'refresh',
                description: 'Требует обновление из remote manifest/bundle и не рассчитан на полностью офлайн-запуск.'
            },
            {
                label: 'pinned',
                description: 'Фиксируется на локальном embedded registry без автоматического refresh.'
            }
        ]
    },
    run: {
        title: 'Запуск pipeline',
        overview: 'Запускает headless backend runner с текущими параметрами формы и начинает новый run.',
        options: [
            {
                label: 'ready',
                description: 'Запуск доступен, если заполнена папка инстанса и backend сейчас не работает.'
            },
            {
                label: 'busy',
                description: 'Backend уже выполняется; повторный старт блокируется до завершения или отмены.'
            }
        ],
        note: 'Горячая клавиша `r` делает то же самое, что и Enter на этом пункте.'
    }
};

export function getRunFieldDefinitions(form: RunFormState, uiMode: TuiMode, isRunning: boolean): RunFieldDefinition[] {
    const fields: RunFieldDefinition[] = [
        {
            key: 'inputPath',
            label: 'Папка инстанса',
            value: form.inputPath || '<не указана>',
            kind: 'text',
            description: 'Корень инстанса с mods, config и прочим'
        },
        {
            key: 'outputPath',
            label: 'Папка build',
            value: form.outputPath || '<по умолчанию>',
            kind: 'text',
            description: 'Куда создать серверную папку'
        },
        {
            key: 'serverDirName',
            label: 'Папка сервера',
            value: form.serverDirName || '<авто>',
            kind: 'text',
            description: 'Имя итоговой серверной папки'
        },
        {
            key: 'reportDir',
            label: 'Папка reports',
            value: form.reportDir || '<по умолчанию>',
            kind: 'text',
            description: 'Куда писать отчёты run'
        },
        {
            key: 'dryRun',
            label: 'Dry-run',
            value: form.dryRun ? 'on' : 'off',
            kind: 'toggle',
            description: 'Только анализ без создания серверной папки'
        }
    ];

    if (uiMode === 'expert') {
        fields.push(
            {
                key: 'profile',
                label: 'Arbiter profile',
                value: form.profile,
                kind: 'enum',
                description: 'safe / balanced / aggressive'
            },
            {
                key: 'deepCheckMode',
                label: 'Deep-check',
                value: form.deepCheckMode,
                kind: 'enum',
                description: 'auto / off / force'
            },
            {
                key: 'validationMode',
                label: 'Validation',
                value: form.validationMode,
                kind: 'enum',
                description: 'off / auto / require / force'
            },
            {
                key: 'registryMode',
                label: 'Registry mode',
                value: form.registryMode,
                kind: 'enum',
                description: 'auto / offline / refresh / pinned'
            }
        );
    }

    fields.push({
        key: 'run',
        label: isRunning ? 'Pipeline выполняется' : 'Запустить pipeline',
        value: isRunning ? 'busy' : 'ready',
        kind: 'action',
        description: 'Enter запускает headless backend runner'
    });

    return fields;
}

export function getRunFieldDetails(fieldKey: RunFieldKey): RunFieldDetails {
    return RUN_FIELD_DETAILS[fieldKey];
}
