'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {TASK_TOPICS, type TaskProgressStatus, type TaskTopic} from '../../catalog/taskCatalogueRows';
import {useTaskContext} from '../../context/TaskProvider';
import {CustomTaskControls} from '../../customTasks/CustomTaskControls';
import styles from './AllTasks.module.css';

type AllTasksProps = {
    readonly className?: string;
    readonly onBack: () => void;
};

type TopicFilter = 'All topics' | TaskTopic;
type StatusFilter = 'All statuses' | Exclude<TaskProgressStatus, 'In progress'>;

const topicFilters: readonly TopicFilter[] = ['All topics', ...TASK_TOPICS];
const statusFilters: readonly StatusFilter[] = ['All statuses', 'Not started', 'Completed'];

export function AllTasksHeader({className, onBack}: AllTasksProps) {
    return (
        <header className={`${styles.catalogueHeader} ${className ?? ''}`}>
            <h1 className={styles.pageTitle}>All tasks</h1>
            <button type="button" className={styles.backButton} onClick={onBack}>
                <span className={styles.backMascot} aria-hidden="true">
                    <img className={styles.mascotNormal} src="/cattasks/capybara-navigation-normal.png" alt=""/>
                    <img className={styles.mascotReveal} src="/cattasks/capybara-navigation-reveal.png" alt=""/>
                </span>
                <span className={styles.backArrow} aria-hidden="true">←</span>
                Back to task
            </button>
        </header>
    );
}

export default function AllTasks({className, onBack}: AllTasksProps) {
    const {catalogueRows, catalogError, retryCatalog, selectTask, customTasks} = useTaskContext();
    const [query, setQuery] = useState('');
    const [topic, setTopic] = useState<TopicFilter>('All topics');
    const [status, setStatus] = useState<StatusFilter>('All statuses');
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    const availableTopicFilters = useMemo<readonly TopicFilter[]>(
        () => customTasks.some(task => task.topic === undefined) ? [...topicFilters, 'Uncategorized'] : topicFilters,
        [customTasks],
    );

    useEffect(() => {
        if (!availableTopicFilters.includes(topic)) setTopic('All topics');
    }, [availableTopicFilters, topic]);

    const visibleRows = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return catalogueRows.filter(row => {
            const matchesQuery = normalizedQuery === '' ||
                row.title.toLocaleLowerCase().includes(normalizedQuery) ||
                row.description.toLocaleLowerCase().includes(normalizedQuery);
            const matchesTopic = topic === 'All topics' || row.topic === topic;
            const matchesStatus = status === 'All statuses' || row.status === status;
            return matchesQuery && matchesTopic && matchesStatus;
        });
    }, [catalogueRows, query, status, topic]);

    const openTask = (id: string) => {
        selectTask(id);
        onBack();
    };

    return (
        <main className={`${styles.catalogueMain} ${className ?? ''}`}>
            <aside className={styles.filters} aria-label="Task filters">
                <label className={styles.searchLabel}>
                    <span>Search tasks</span>
                    <input
                        ref={searchRef}
                        type="search"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Search tasks..."
                    />
                </label>
                <fieldset className={styles.filterGroup}>
                    <legend>Topics</legend>
                    {availableTopicFilters.map(option => (
                        <label className={styles.filterOption} key={option}>
                            <input
                                type="radio"
                                name="topic"
                                checked={topic === option}
                                onChange={() => setTopic(option)}
                            />
                            <span>{option}</span>
                        </label>
                    ))}
                </fieldset>
                <CustomTaskControls/>
                <fieldset className={styles.filterGroup}>
                    <legend>Status</legend>
                    {statusFilters.map(option => (
                        <label className={styles.filterOption} key={option}>
                            <input
                                type="radio"
                                name="status"
                                checked={status === option}
                                onChange={() => setStatus(option)}
                            />
                            <span>{option}</span>
                        </label>
                    ))}
                </fieldset>
            </aside>
            <section className={styles.taskList} aria-labelledby="taskListTitle">
                <h2 id="taskListTitle" className={styles.visuallyHidden}>Task list</h2>
                <div className={styles.columnHeadings} aria-hidden="true">
                    <span>Task</span><span>Topic</span><span>Status</span><span/>
                </div>
                {catalogError ? (
                    <div className={styles.message} role="alert">
                        <p>Tasks could not be loaded.</p>
                        <button type="button" onClick={retryCatalog}>Try again</button>
                    </div>
                ) : catalogueRows.length === 0 ? (
                    <div className={styles.message} role="status">Loading tasks…</div>
                ) : visibleRows.length === 0 ? (
                    <div className={styles.message} role="status">No tasks match these filters.</div>
                ) : (
                    <ul className={styles.rows}>
                        {visibleRows.map(row => (
                            <li
                                className={`${styles.row} ${row.isCurrent ? styles.currentRow : ''}`}
                                key={row.id}
                                aria-current={row.isCurrent ? 'true' : undefined}
                            >
                                <div className={styles.taskDescription}>
                                    <h3>{row.title}</h3>
                                    <p>{row.description}</p>
                                </div>
                                <span className={styles.topic}>{row.topic}</span>
                                <span className={styles.status}>
                                    <span>{row.status}</span>
                                    {row.isCurrent && <span className={styles.currentMarker}>Current task</span>}
                                </span>
                                {row.isCurrent ? (
                                    <button type="button" className={styles.openButton} onClick={() => openTask(row.id)}>
                                        Open <span aria-hidden="true">→</span>
                                    </button>
                                ) : (
                                    <button type="button" className={styles.openIcon} onClick={() => openTask(row.id)} aria-label={`Open ${row.title}`}>
                                        <span aria-hidden="true">›</span>
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
