import type { ManualReviewAction } from '../../review/manual-overrides.js';

const EXACT_REASON_TRANSLATIONS: Record<string, string> = {
    'Saved from TUI review menu': 'Сохранено через меню спорных модов.',
    'Deep-check did not produce enough decisive evidence': 'Deep-check не нашёл достаточно убедительных доказательств.',
    'Deep-check found both keep and remove evidence': 'Deep-check нашёл признаки и для keep, и для remove.',
    'Deep-check could not read the jar archive': 'Deep-check не смог прочитать jar-архив.',
    'Deep-check was not triggered for this mod': 'Deep-check не запускался для этого мода.',
    'Deep-check confirmed keep': 'Deep-check подтвердил keep.',
    'Deep-check confirmed remove': 'Deep-check подтвердил remove.',
    'Dependency graph requires keeping this jar': 'Граф зависимостей требует сохранить этот jar.',
    'Dependency validation found unresolved blocking issues': 'Проверка зависимостей нашла нерешённые блокирующие проблемы.',
    'Strong engines disagree on the final side of this mod': 'Сильные движки не сошлись по итоговой стороне этого мода.',
    'Strong engine conflict requires manual review or deep-check': 'Конфликт сильных движков требует ручной проверки или deep-check.',
    'No stable classification signal was produced because engine errors occurred': 'Не удалось получить стабильный сигнал классификации из-за ошибок движков.',
    'No strong remove signal was produced; kept conservatively': 'Сильного remove-сигнала не было, поэтому мод сохранён консервативно.',
    'Dependency preservation overrode disputed signals': 'Сохранение по зависимостям переопределило спорные сигналы.',
    'Conflicting engine results were detected; the mod was kept conservatively': 'Обнаружены конфликтующие результаты движков, поэтому мод сохранён консервативно.',
    'Primary metadata could not be parsed safely': 'Не удалось безопасно разобрать основные metadata.',
    'Metadata explicitly marks the mod as client-side': 'Metadata явно помечает мод как клиентский.',
    'Metadata explicitly marks the mod as server-side': 'Metadata явно помечает мод как серверный.',
    'Metadata explicitly marks the mod as compatible with both sides': 'Metadata явно помечает мод как совместимый с обеими сторонами.',
    'Client-only entrypoints were found in metadata': 'В metadata найдены entrypoint только для клиента.',
    'No supported metadata files were found': 'Поддерживаемые metadata-файлы не найдены.',
    'Metadata was found, but it does not contain an explicit side decision': 'Metadata найдены, но явного решения по стороне в них нет.',
    'Legacy filename matcher did not find a client-only pattern': 'Старый filename matcher не нашёл клиентский паттерн.',
    'No local registry rule matched this mod': 'Ни одно локальное правило registry не подошло к этому моду.',
    'Local registry does not contain matching rules': 'В локальном registry нет подходящих правил.'
};

function translateManualReviewAction(action: ManualReviewAction): string {
    return action === 'exclude' ? 'исключить' : 'оставить';
}

function translateManualReviewNote(note: string): string {
    const normalizedNote = String(note || '').trim();

    if (!normalizedNote) {
        return 'без пояснения';
    }

    if (normalizedNote in EXACT_REASON_TRANSLATIONS) {
        return EXACT_REASON_TRANSLATIONS[normalizedNote] || normalizedNote;
    }

    if (normalizedNote === 'keep') {
        return 'оставить';
    }

    if (normalizedNote === 'exclude') {
        return 'исключить';
    }

    return normalizedNote;
}

export function translateDecisionReason(reason: string | null | undefined): string {
    const normalizedReason = String(reason || '').trim();

    if (!normalizedReason) {
        return 'Без пояснения.';
    }

    if (normalizedReason in EXACT_REASON_TRANSLATIONS) {
        return EXACT_REASON_TRANSLATIONS[normalizedReason] || normalizedReason;
    }

    if (normalizedReason.startsWith('Manual review override: ')) {
        return `Ручное решение: ${translateManualReviewNote(normalizedReason.slice('Manual review override: '.length))}`;
    }

    if (normalizedReason.startsWith('Manual review override (') && normalizedReason.endsWith(')')) {
        const action = normalizedReason.slice('Manual review override ('.length, -1);
        return `Ручное решение: ${translateManualReviewNote(action)}.`;
    }

    if (normalizedReason.startsWith('Profile ') && normalizedReason.endsWith(' escalated a risky remove decision into review')) {
        const profile = normalizedReason.slice('Profile '.length, normalizedReason.indexOf(' escalated a risky remove decision into review'));
        return `Профиль ${profile} перевёл рискованное remove-решение в review.`;
    }

    if (normalizedReason.startsWith('Legacy filename matcher matched "') && normalizedReason.endsWith('"')) {
        const matchedRule = normalizedReason.slice('Legacy filename matcher matched "'.length, -1);
        return `Старый filename matcher сработал по шаблону "${matchedRule}".`;
    }

    if (normalizedReason.startsWith('Engine ') && normalizedReason.endsWith(' failed')) {
        const engineName = normalizedReason.slice('Engine '.length, -' failed'.length);
        return `Движок ${engineName} завершился с ошибкой.`;
    }

    return normalizedReason;
}

export function translateManualOverrideSummary(action: ManualReviewAction | null): string {
    if (!action) {
        return 'нет';
    }

    return translateManualReviewAction(action);
}
