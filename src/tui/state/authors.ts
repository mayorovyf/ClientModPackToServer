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
        description: 'Представитель студии LightFall. В данном проекте отвечает за основную архитектуру, ключевые решения по развитию и интерфейсу.',
        contact: 'LightFall: t.me/LightFallst\nTelegram: t.me/KPuCTaJl_Valley\nGithub: github.com/mayorovyf'
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
