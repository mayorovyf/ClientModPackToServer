import type { ServerFormState } from './app-state.js';

import type { ServerManagerState } from '../hooks/use-server-manager.js';

export type ServerFieldKey =
    | 'targetDir'
    | 'coreType'
    | 'minecraftVersion'
    | 'loaderVersion'
    | 'javaPath'
    | 'jvmArgs'
    | 'explicitEntrypointPath'
    | 'acceptEula'
    | 'useLatestBuild'
    | 'installCore'
    | 'applyEntrypointToValidation'
    | 'launchServer'
    | 'stopServer'
    | 'clearLogs';

export interface ServerFieldDefinition {
    key: ServerFieldKey;
    label: string;
    value: string;
    kind: 'text' | 'toggle' | 'enum' | 'action';
    description: string;
}

export interface ServerFieldOptionDescription {
    label: string;
    description: string;
}

export interface ServerFieldDetails {
    title: string;
    overview: string;
    options: ServerFieldOptionDescription[];
    note?: string;
}

export const SERVER_CORE_VALUES = ['fabric', 'forge', 'neoforge'] as const;

const SERVER_FIELD_DETAILS: Record<ServerFieldKey, ServerFieldDetails> = {
    targetDir: {
        title: 'Target server dir',
        overview: 'Каталог, в который ставится серверное ядро и откуда затем запускается сервер.',
        options: [
            { label: 'Пусто', description: 'Нужно указать папку сервера вручную или подтянуть последний build.' },
            { label: 'Свой путь', description: 'Все installer и launcher-операции выполняются внутри указанной директории.' }
        ],
        note: 'Обычно сюда удобно подставлять путь последнего успешного build.'
    },
    coreType: {
        title: 'Core type',
        overview: 'Выбор типа модового ядра, которое нужно установить в серверную папку.',
        options: [
            { label: 'fabric', description: 'Ставит Fabric server bootstrap через официальный Fabric meta API.' },
            { label: 'forge', description: 'Скачивает Forge installer jar и выполняет server install через Java.' },
            { label: 'neoforge', description: 'Скачивает NeoForge installer jar и выполняет server install через Java.' }
        ]
    },
    minecraftVersion: {
        title: 'Minecraft version',
        overview: 'Версия Minecraft, под которую нужно подобрать и установить ядро.',
        options: [
            { label: 'Пусто', description: 'Установка ядра невозможна, пока версия Minecraft не указана.' },
            { label: 'Своё значение', description: 'Используется для автоматического подбора версии loader или проверки совместимости.' }
        ]
    },
    loaderVersion: {
        title: 'Loader version',
        overview: 'Явная версия loader/core. Для Fabric может оставаться пустой, тогда берётся актуальный стабильный loader.',
        options: [
            { label: 'Пусто', description: 'Fabric и Forge пытаются подобрать подходящую версию автоматически; NeoForge тоже пробует матчить по версии Minecraft.' },
            { label: 'Своё значение', description: 'Используется указанная точная версия core/loader без автоподбора.' }
        ]
    },
    javaPath: {
        title: 'Java path',
        overview: 'Путь до Java, которая будет использована для installer jars и запуска jar-launcher.',
        options: [
            { label: 'Пусто', description: 'Используется `java` из PATH.' },
            { label: 'Свой путь', description: 'Позволяет запускать installer и сервер на конкретной Java.' }
        ]
    },
    jvmArgs: {
        title: 'JVM args',
        overview: 'Дополнительные JVM-параметры для запуска jar-launcher сервера.',
        options: [
            { label: 'Пусто', description: 'Сервер запускается без дополнительных JVM-флагов.' },
            { label: 'Свой набор', description: 'Например `-Xms2G -Xmx4G` для jar-entrypoint.' }
        ],
        note: 'Эти аргументы применяются только к jar-launchers, а не к .bat/.cmd/.ps1-скриптам.'
    },
    explicitEntrypointPath: {
        title: 'Explicit launcher',
        overview: 'Явный путь до файла запуска сервера. Если оставить пустым, утилита попробует найти launcher автоматически.',
        options: [
            { label: 'Авто', description: 'Launcher ищется по типовым именам внутри target dir.' },
            { label: 'Свой путь', description: 'Полезно, если ядро создаёт нестандартный launcher.' }
        ]
    },
    acceptEula: {
        title: 'Accept EULA',
        overview: 'Если включено, утилита создаёт или обновляет `eula.txt` с `eula=true` перед install/launch.',
        options: [
            { label: 'off', description: 'EULA не меняется автоматически.' },
            { label: 'on', description: 'Перед install и запуском выставляется `eula=true`.' }
        ]
    },
    useLatestBuild: {
        title: 'Use latest build dir',
        overview: 'Подставляет путь последнего построенного server build в поле target dir.',
        options: [
            { label: 'available', description: 'Если есть последний build, target dir заполняется автоматически.' },
            { label: 'missing', description: 'Если build ещё не запускался или был dry-run, действие ничего не делает.' }
        ]
    },
    installCore: {
        title: 'Install core',
        overview: 'Запускает установку выбранного ядра в target dir.',
        options: [
            { label: 'ready', description: 'Устанавливает Fabric/Forge/NeoForge в указанную папку сервера.' },
            { label: 'busy', description: 'Установка уже выполняется.' }
        ]
    },
    applyEntrypointToValidation: {
        title: 'Use launcher for validation',
        overview: 'Копирует найденный server launcher в поле validation entrypoint текущей формы pipeline.',
        options: [
            { label: 'available', description: 'Найденный launcher можно сразу использовать в post-build validation.' },
            { label: 'missing', description: 'Пока нет найденного launcher path, применять нечего.' }
        ]
    },
    launchServer: {
        title: 'Launch server',
        overview: 'Запускает серверный процесс из target dir и показывает поток логов прямо в TUI.',
        options: [
            { label: 'ready', description: 'Сервер можно запустить.' },
            { label: 'busy', description: 'Процесс сервера уже работает.' }
        ]
    },
    stopServer: {
        title: 'Stop server',
        overview: 'Отправляет сигнал остановки запущенному серверному процессу.',
        options: [
            { label: 'ready', description: 'Процесс сервера будет остановлен.' },
            { label: 'idle', description: 'Останавливать нечего, сервер сейчас не запущен.' }
        ]
    },
    clearLogs: {
        title: 'Clear logs',
        overview: 'Очищает ленту серверных логов в TUI.',
        options: [
            { label: 'ready', description: 'Локальный буфер логов очищается.' }
        ]
    }
};

export function getServerFieldDefinitions({
    form,
    serverState,
    hasLatestBuild
}: {
    form: ServerFormState;
    serverState: ServerManagerState;
    hasLatestBuild: boolean;
}): ServerFieldDefinition[] {
    return [
        {
            key: 'targetDir',
            label: 'Target dir',
            value: form.targetDir || '<not set>',
            kind: 'text',
            description: 'Куда ставить и откуда запускать сервер'
        },
        {
            key: 'coreType',
            label: 'Core type',
            value: form.coreType,
            kind: 'enum',
            description: 'fabric / forge / neoforge'
        },
        {
            key: 'minecraftVersion',
            label: 'Minecraft',
            value: form.minecraftVersion || '<required>',
            kind: 'text',
            description: 'Версия Minecraft для ядра'
        },
        {
            key: 'loaderVersion',
            label: 'Loader version',
            value: form.loaderVersion || '<auto>',
            kind: 'text',
            description: 'Явная версия loader/core'
        },
        {
            key: 'javaPath',
            label: 'Java path',
            value: form.javaPath || '<java from PATH>',
            kind: 'text',
            description: 'Java для install и jar-launch'
        },
        {
            key: 'jvmArgs',
            label: 'JVM args',
            value: form.jvmArgs || '<none>',
            kind: 'text',
            description: 'Дополнительные JVM флаги'
        },
        {
            key: 'explicitEntrypointPath',
            label: 'Launcher path',
            value: form.explicitEntrypointPath || serverState.resolvedEntrypointPath || '<auto>',
            kind: 'text',
            description: 'Явный launcher или auto-detect'
        },
        {
            key: 'acceptEula',
            label: 'Accept EULA',
            value: form.acceptEula ? 'on' : 'off',
            kind: 'toggle',
            description: 'Автоматически писать eula=true'
        },
        {
            key: 'useLatestBuild',
            label: 'Use latest build',
            value: hasLatestBuild ? 'available' : 'missing',
            kind: 'action',
            description: 'Подставить путь последнего build'
        },
        {
            key: 'installCore',
            label: serverState.installStatus === 'installing' ? 'Installing core...' : 'Install core',
            value: serverState.installStatus === 'installing' ? 'busy' : 'ready',
            kind: 'action',
            description: 'Скачать и установить ядро'
        },
        {
            key: 'applyEntrypointToValidation',
            label: 'Use for validation',
            value: serverState.resolvedEntrypointPath ? 'available' : 'missing',
            kind: 'action',
            description: 'Записать launcher в validation entrypoint'
        },
        {
            key: 'launchServer',
            label: serverState.launchStatus === 'running' ? 'Server is running' : 'Launch server',
            value: serverState.launchStatus === 'running' ? 'busy' : 'ready',
            kind: 'action',
            description: 'Запустить серверный процесс'
        },
        {
            key: 'stopServer',
            label: 'Stop server',
            value: serverState.launchStatus === 'running' || serverState.launchStatus === 'starting' ? 'ready' : 'idle',
            kind: 'action',
            description: 'Остановить сервер'
        },
        {
            key: 'clearLogs',
            label: 'Clear logs',
            value: 'ready',
            kind: 'action',
            description: 'Очистить ленту логов'
        }
    ];
}

export function getServerFieldDetails(fieldKey: ServerFieldKey): ServerFieldDetails {
    return SERVER_FIELD_DETAILS[fieldKey];
}
