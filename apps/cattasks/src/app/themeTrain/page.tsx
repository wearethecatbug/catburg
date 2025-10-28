import styles from './page.module.css';

export default function Home() {
    return (
        <main className={styles.main}>
            <section className={styles.section}>
                <h1 className={styles.h1}>Home</h1>
                <p style={{margin: 0, opacity: 0.9}}>
                    Тестовая страница для проверки тем. Меняй тему в хедере. Все цвета берутся из CSS-переменных.
                </p>
            </section>

            <section className={styles.section} style={{gap: 16}}>
                <h2 className={styles.h2}>Акценты</h2>
                <div className={styles.accentRow}>
                    <button className={styles.btnPrimary}>Primary</button>
                    <a href="#" className={styles.linkChip}>Link sample</a>
                    <span className={styles.textChip}>Text on background</span>
                </div>
            </section>

            <section className={styles.section} style={{gap: 16}}>
                <h2 className={styles.h2}>Карточки</h2>
                <div className={styles.cardsGrid}>
                    {cards.map((c) => (
                        <article key={c.t} className={styles.card}>
                            <h3 className={styles.cardTitle}>{c.t}</h3>
                            <p className={styles.cardDesc}>{c.d}</p>
                            <a href={c.href}>Подробнее</a>
                        </article>
                    ))}
                </div>
            </section>

            <footer className={styles.footer}>
                © {new Date().getFullYear()} ThemeTrain
            </footer>
        </main>
    );
}

const cards = [
    {t: 'Тема light', d: 'Светлый фон и тёмный текст.', href: '#'},
    {t: 'Тема dark', d: 'Тёмный фон и светлый текст.', href: '#'},
    {t: 'Тема blue', d: 'Тёмно-синяя палитра, высокий контраст.', href: '#'},
];