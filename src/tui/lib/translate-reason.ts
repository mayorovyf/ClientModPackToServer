import type { Locale } from '../../i18n/types.js';
import type { ManualReviewAction } from '../../review/manual-overrides.js';

const EXACT_REASON_TRANSLATIONS_RU: Record<string, string> = {
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

function translateManualReviewNote(note: string, locale: Locale): string {
    const normalizedNote = String(note || '').trim();

    if (!normalizedNote) {
        return locale === 'ru' ? 'без пояснения' : 'no explanation';
    }

    if (locale === 'ru' && normalizedNote in EXACT_REASON_TRANSLATIONS_RU) {
        return EXACT_REASON_TRANSLATIONS_RU[normalizedNote] || normalizedNote;
    }

    if (normalizedNote === 'keep' || normalizedNote === 'exclude') {
        return translateManualOverrideSummary(normalizedNote, locale);
    }

    return normalizedNote;
}

export function translateDecisionReason(reason: string | null | undefined, locale: Locale = 'ru'): string {
    const normalizedReason = String(reason || '').trim();

    if (!normalizedReason) {
        return locale === 'ru' ? 'Без пояснения.' : 'No explanation.';
    }

    if (locale === 'ru' && normalizedReason in EXACT_REASON_TRANSLATIONS_RU) {
        return EXACT_REASON_TRANSLATIONS_RU[normalizedReason] || normalizedReason;
    }

    if (normalizedReason.startsWith('Manual review override: ')) {
        const note = translateManualReviewNote(normalizedReason.slice('Manual review override: '.length), locale);
        return locale === 'ru' ? `Ручное решение: ${note}` : `Manual review: ${note}`;
    }

    if (normalizedReason.startsWith('Manual review override (') && normalizedReason.endsWith(')')) {
        const action = normalizedReason.slice('Manual review override ('.length, -1);
        const note = translateManualReviewNote(action, locale);
        return locale === 'ru' ? `Ручное решение: ${note}.` : `Manual review: ${note}.`;
    }

    if (normalizedReason.startsWith('Profile ') && normalizedReason.endsWith(' escalated a risky remove decision into review')) {
        const profile = normalizedReason.slice('Profile '.length, normalizedReason.indexOf(' escalated a risky remove decision into review'));
        return locale === 'ru'
            ? `Профиль ${profile} перевёл рискованное remove-решение в review.`
            : `Profile ${profile} escalated a risky remove decision into review.`;
    }

    if (normalizedReason.startsWith('Legacy filename matcher matched "') && normalizedReason.endsWith('"')) {
        const matchedRule = normalizedReason.slice('Legacy filename matcher matched "'.length, -1);
        return locale === 'ru'
            ? `Старый filename matcher сработал по шаблону "${matchedRule}".`
            : `Legacy filename matcher matched "${matchedRule}".`;
    }

    if (normalizedReason.startsWith('Engine ') && normalizedReason.endsWith(' failed')) {
        const engineName = normalizedReason.slice('Engine '.length, -' failed'.length);
        return locale === 'ru'
            ? `Движок ${engineName} завершился с ошибкой.`
            : `Engine ${engineName} failed.`;
    }

    return normalizedReason;
}

export function translateManualOverrideSummary(action: ManualReviewAction | null, locale: Locale = 'ru'): string {
    if (!action) {
        return locale === 'ru' ? 'нет' : 'none';
    }

    if (locale === 'ru') {
        return action === 'exclude' ? 'исключить' : 'оставить';
    }

    return action;
}
