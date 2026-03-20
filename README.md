# ClientModPackToServer

`ClientModPackToServer` — локальная Node.js утилита для сборки серверной версии Minecraft-модпака из клиентского инстанса без изменения исходной папки с модами.

Проект уже не ограничивается простым filename matching. Сейчас он умеет читать metadata из `.jar`, строить archive index, прогонять несколько classification engines, учитывать зависимости, использовать registry, запускать deep-check, выполнять dedicated-server probe для спорных модов, собирать отчёты и управлять сервером из TUI.

## Что умеет проект

- Принимать на вход:
  - обычный корень инстанса с `mods/`
  - корень Prism Launcher инстанса с `minecraft/mods/`
  - корень Prism Launcher инстанса с `.minecraft/mods/`
  - саму папку `mods/`
- Строить отдельный `build/<runId>/mods/` или работать в `dry-run`
- Собирать подробные отчёты в `reports/<runId>/`
- Классифицировать моды несколькими слоями:
  - `probe-knowledge-engine`
  - `metadata-engine`
  - `forge-bytecode-engine`
  - `client-signature-engine`
  - `forge-semantic-engine`
  - `registry-engine`
  - `filename-engine`
- Выводить не только `keep/remove/review`, но и роль мода:
  - `client-ui`
  - `client-visual`
  - `client-qol`
  - `client-library`
  - `common-library`
  - `common-gameplay`
  - `common-optimization`
  - `compat-client`
  - `unknown`
- Учитывать dependency graph и role propagation
- Запускать dedicated-server probe для хвоста `review` и сохранять подтверждённые знания в `data/probe-knowledge.json`
- Поддерживать ручные overrides через `data/review-overrides.json`
- Выполнять post-build validation
- Управлять сервером из TUI и CLI:
  - install core
  - doctor
  - launch
  - logs

## Требования

- Node.js 20+

## Установка

```powershell
npm.cmd install
```

## Быстрый старт

Интерактивный TUI:

```powershell
node index.js
```

Анализ без build:

```powershell
node index.js --input M:\instances\PackName --dry-run
```

Полный build:

```powershell
node index.js --input M:\instances\PackName --output M:\server_instances --report-dir M:\ClientModPackToServer\Reports
```

Принудительный probe для спорных модов:

```powershell
node index.js --input M:\instances\PackName --probe force --probe-max-mods 8
```

Запуск пресета:

```powershell
node index.js preset run safe-build
```

Doctor для управляемого сервера:

```powershell
node index.js server doctor --target-dir M:\server_instances\PackName
```

## Основной pipeline

1. Разрешается layout входного инстанса: direct instance, Prism root или `mods/`.
2. Для каждого `.jar` читаются metadata, manifest, archive index, bytecode summary и client signatures.
3. Запускается первый проход classification engines.
4. Строится dependency graph и dependency role propagation.
5. Arbiter сводит сигналы в `keep/remove/review`.
6. Deep-check пытается снять часть спорных кейсов.
7. Для хвоста `review` может запускаться dedicated-server probe.
8. После probe выполняется повторный classification pass с учётом накопленного knowledge store.
9. К build копируются только финальные `keep`-решения, если это не `dry-run`.
10. Validation проверяет собранный результат.
11. Пишутся `report.json`, `summary.md`, `run.json`, `events.log`.

## TUI

Сейчас TUI организован как четыре раздела:

- `Запуск`
  - `Пути`
  - `Стратегия`
  - `Проверка`
  - `Лог`
  - `Пресеты`
- `Результаты`
  - `История`
  - `Моды`
  - `Проблемы`
  - `Сравнение`
- `Сервер`
  - `Настройка`
  - `Установка ядра`
  - `Проверка`
  - `Запуск`
  - `Логи`
- `Настройки`
  - `Общие`
  - `Registry`
  - `О проекте`

`Результаты` и `Сервер` делят выбранный run: если в истории выбран отчёт, его build можно использовать при работе с сервером.

## CLI

Основные команды:

- `node index.js [run options]`
- `node index.js preset list`
- `node index.js preset save <name> [run options]`
- `node index.js preset show <name-or-id>`
- `node index.js preset delete <name-or-id>`
- `node index.js preset run <name-or-id> [run options]`
- `node index.js server doctor ...`
- `node index.js server install ...`
- `node index.js server start ...`

Полный список флагов: `node index.js --help`

## Файлы и артефакты

- `build/<runId>/mods/` — собранный серверный модпак
- `reports/<runId>/report.json` — полный machine-readable отчёт
- `reports/<runId>/summary.md` — краткая сводка
- `reports/<runId>/run.json` — параметры запуска
- `reports/<runId>/events.log` — лента событий
- `data/local-registry.json` — встроенный fallback registry
- `data/local-overrides.json` — локальные registry overrides
- `data/review-overrides.json` — ручные решения
- `data/probe-knowledge.json` — накопленные probe результаты
- `cache/registry/` — runtime cache для registry

## Тесты

```powershell
npm.cmd run typecheck
npm.cmd test
```

`lint` пока не настроен.

## Документация

Индекс документов: [docs/README.md](docs/README.md)

## Текущие ограничения

- Автоматизация стала существенно сильнее, но хвост `review` всё ещё существует
- Batch probe и binary split пока не реализованы
- CLI и доменные сообщения локализованы не полностью
- Нет полноценного benchmark corpus с формальной метрикой точности на большом наборе реальных паков
