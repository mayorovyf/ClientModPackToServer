export interface AuthorProfile {
    id: string;
    nickname: string;
    role: string;
    description: string;
    contact: string;
}

export const AUTHOR_PROFILES: AuthorProfile[] = [
    {
        id: 'kristallik',
        nickname: 'KPuCTaJluK | mayorovyf',
        role: 'главный разработчик',
        description: 'Отвечает за основную архитектуру проекта, ключевые решения по интерфейсу и развитие главного pipeline.',
        contact: 'mayorovyf'
    },
    {
        id: 'fan',
        nickname: 'F_aN | Алексей 🐟',
        role: 'разработчик',
        description: 'Участвует в разработке логики утилиты, развитии сопутствующих частей проекта и поддержке инструментария.',
        contact: 'Telegram: t.me/F_aN_N\nDiscord: steefanita'
    }
];

export function getAuthorProfile(authorId: string): AuthorProfile {
    const fallbackAuthor = AUTHOR_PROFILES[0];

    if (!fallbackAuthor) {
        throw new Error('AUTHOR_PROFILES is empty');
    }

    return AUTHOR_PROFILES.find((author) => author.id === authorId) || fallbackAuthor;
}
