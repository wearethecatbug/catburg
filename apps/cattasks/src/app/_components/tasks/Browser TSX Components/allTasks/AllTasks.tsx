'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {TASK_TOPICS, type TaskProgressStatus, type TaskTopic} from '../../catalog/taskCatalogueRows';
import type {TaskDifficulty} from '../../catalog/taskCatalog';
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
const difficultyFilters: readonly TaskDifficulty[] = ['Easy', 'Medium', 'Hard'];
const difficultyOrder = [...difficultyFilters, 'Unrated'] as const;
const pageSize = 8;

export function AllTasksHeader({className, onBack}: AllTasksProps) {
    return (
        <header className={`${styles.catalogueHeader} ${className ?? ''}`}>
            <h1 className={styles.pageTitle}>
                All tasks
                <span className={styles.shelfStickers} aria-hidden="true">
                    <img data-catalogue-shelf-sticker="samoyed" src="/cattasks/catalogue/samoyed-cushion.png" alt="" width={990} height={731} loading="lazy"/>
                    <img data-catalogue-shelf-sticker="yarn" src="/cattasks/catalogue/yarn-ball.png" alt="" width={219} height={209} loading="lazy"/>
                </span>
            </h1>
            <img className={styles.compactCandles} aria-hidden="true" src="/cattasks/catalogue/shelf-candles.png" alt="" width={145} height={131} loading="lazy"/>
            <span className={styles.backControl}>
                <img className={styles.backRabbit} aria-hidden="true" src="/cattasks/catalogue/shelf-rabbit-carrot.png" alt="" width={310} height={165} loading="lazy"/>
                <button type="button" className={styles.backButton} onClick={onBack}>
                    <img className={styles.backMascot} data-catalogue-back-capybara="" src="/cattasks/catalogue-back-capybara.png" alt=""/>
                    <span className={styles.backArrow} aria-hidden="true">←</span>
                    Back to task
                </button>
            </span>
        </header>
    );
}

export default function AllTasks({className, onBack}: AllTasksProps) {
    const {catalogueRows, catalogError, retryCatalog, selectTask, customTasks} = useTaskContext();
    const [query, setQuery] = useState('');
    const [topic, setTopic] = useState<TopicFilter>('All topics');
    const [status, setStatus] = useState<StatusFilter>('All statuses');
    const [selectedDifficulties, setSelectedDifficulties] = useState<ReadonlySet<TaskDifficulty>>(() => new Set(difficultyFilters));
    const [page, setPage] = useState(1);
    const searchRef = useRef<HTMLInputElement>(null);
    const taskListRef = useRef<HTMLElement>(null);

    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    const availableTopicFilters = useMemo<readonly TopicFilter[]>(
        () => customTasks.some(task => task.topic === undefined) ? [...topicFilters, 'Uncategorized'] : topicFilters,
        [customTasks],
    );

    useEffect(() => {
        if (!availableTopicFilters.includes(topic)) {
            setTopic('All topics');
            setPage(1);
        }
    }, [availableTopicFilters, topic]);

    const allDifficultiesSelected = difficultyFilters.every(difficulty => selectedDifficulties.has(difficulty));

    const toggleDifficulty = (difficulty: TaskDifficulty) => {
        setSelectedDifficulties(current => {
            const next = new Set(current);
            if (next.has(difficulty)) next.delete(difficulty);
            else next.add(difficulty);
            return next;
        });
        setPage(1);
    };

    const selectAllDifficulties = () => {
        if (allDifficultiesSelected) return;
        setSelectedDifficulties(new Set(difficultyFilters));
        setPage(1);
    };

    const visibleRows = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return catalogueRows.filter(row => {
            const matchesQuery = normalizedQuery === '' ||
                row.title.toLocaleLowerCase().includes(normalizedQuery) ||
                row.description.toLocaleLowerCase().includes(normalizedQuery);
            const matchesTopic = topic === 'All topics' || row.topic === topic;
            const matchesStatus = status === 'All statuses' || row.status === status;
            const matchesDifficulty = row.difficulty === 'Unrated'
                ? allDifficultiesSelected
                : selectedDifficulties.has(row.difficulty);
            return matchesQuery && matchesTopic && matchesStatus && matchesDifficulty;
        });
    }, [allDifficultiesSelected, catalogueRows, query, selectedDifficulties, status, topic]);

    const orderedRows = useMemo(
        () => difficultyOrder.flatMap(difficulty => visibleRows.filter(row => row.difficulty === difficulty)),
        [visibleRows],
    );
    const pageCount = Math.max(1, Math.ceil(orderedRows.length / pageSize));
    const currentPage = Math.min(page, pageCount);

    useEffect(() => {
        setPage(current => Math.min(current, pageCount));
    }, [pageCount]);

    const pagedRows = useMemo(
        () => orderedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [currentPage, orderedRows],
    );

    const groupedRows = useMemo(
        () => difficultyOrder.map(difficulty => ({difficulty, rows: pagedRows.filter(row => row.difficulty === difficulty)})).filter(group => group.rows.length),
        [pagedRows],
    );

    const pageNumbers = useMemo(() => {
        const first = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
        const last = Math.min(pageCount, first + 4);
        return Array.from({length: last - first + 1}, (_, index) => first + index);
    }, [currentPage, pageCount]);

    const openTask = (id: string) => {
        selectTask(id);
        onBack();
    };
    const goToPage = (nextPage: number) => {
        setPage(Math.max(1, Math.min(nextPage, pageCount)));
        requestAnimationFrame(() => {
            taskListRef.current?.focus({preventScroll: true});
            taskListRef.current?.scrollIntoView({block: 'start'});
        });
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
                        onChange={event => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search tasks..."
                    />
                </label>
                <fieldset className={styles.difficultyFilter}>
                    <legend className={styles.visuallyHidden}>Difficulty</legend>
                    <div className={styles.difficultyFilterHeader}>
                        <span>Difficulty</span>
                        <button
                            type="button"
                            className={styles.allDifficultiesButton}
                            aria-pressed={allDifficultiesSelected}
                            onClick={selectAllDifficulties}
                        >
                            All
                        </button>
                    </div>
                    <div className={styles.difficultyOptions}>
                        {difficultyFilters.map(difficulty => {
                            const isSelected = selectedDifficulties.has(difficulty);
                            return (
                                <button
                                    type="button"
                                    className={`${styles.difficultyOption} ${isSelected ? styles.difficultyOptionSelected : ''}`}
                                    aria-pressed={isSelected}
                                    key={difficulty}
                                    onClick={() => toggleDifficulty(difficulty)}
                                >
                                    <span className={`${styles.difficultyBar} ${styles[`difficultyBar${difficulty}`]}`} aria-hidden="true"/>
                                    <span>{difficulty}</span>
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
                <fieldset className={styles.filterGroup}>
                    <legend>Topics</legend>
                    {availableTopicFilters.map(option => (
                        <label className={styles.filterOption} key={option}>
                            <input
                                type="radio"
                                name="topic"
                                checked={topic === option}
                                onChange={() => {
                                    setTopic(option);
                                    setPage(1);
                                }}
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
                                onChange={() => {
                                    setStatus(option);
                                    setPage(1);
                                }}
                            />
                            <span>{option}</span>
                        </label>
                    ))}
                </fieldset>
            </aside>
            <section className={styles.taskList} aria-labelledby="taskListTitle" ref={taskListRef} tabIndex={-1}>
                <h2 id="taskListTitle" className={styles.visuallyHidden}>Task list</h2>
                <div className={styles.columnHeadings} aria-hidden="true">
                    <span className={styles.ordinalHeading}>#</span><span>Task</span><span className={styles.topicHeading}>Topic</span><span>Status</span><span/>
                </div>
                <div className={styles.taskResults}>
                    {catalogError ? (
                        <div className={styles.message} role="alert">
                            <p>Tasks could not be loaded.</p>
                            <button type="button" onClick={retryCatalog}>Try again</button>
                        </div>
                    ) : catalogueRows.length === 0 ? (
                        <div className={styles.message} role="status">Loading tasks…</div>
                    ) : selectedDifficulties.size === 0 ? (
                        <div className={styles.message} role="status">
                            <h3>No difficulty selected</h3>
                            <p>Choose a difficulty to see tasks.</p>
                            <button type="button" onClick={selectAllDifficulties}>Select all</button>
                        </div>
                    ) : visibleRows.length === 0 ? (
                        <div className={styles.message} role="status">No tasks match these filters.</div>
                    ) : (
                        <div className={styles.rows}>
                            {groupedRows.map(group => <section className={styles.difficultyGroup} key={group.difficulty} aria-labelledby={`difficulty-${group.difficulty}`}>
                                <h3 id={`difficulty-${group.difficulty}`} className={styles.difficultyHeading}>{group.difficulty}</h3>
                                <ul className={styles.rows}>
                            {group.rows.map(row => (
                            <li
                                className={`${styles.row} ${row.isCurrent ? styles.currentRow : ''}`}
                                key={row.id}
                                aria-current={row.isCurrent ? 'true' : undefined}
                            >
                                <span className={styles.ordinal} data-task-ordinal>{String(row.ordinal).padStart(2, '0')}</span>
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
                            ))}</ul></section>)}
                        </div>
                    )}
                </div>
                {!catalogError && catalogueRows.length > 0 && selectedDifficulties.size > 0 && visibleRows.length > 0 && (
                    <nav className={styles.pagination} aria-label="Task pages">
                        <span className={styles.pageRange}>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, orderedRows.length)} of {orderedRows.length} tasks</span>
                        <div className={styles.pageControls}>
                            <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>‹</button>
                            {pageNumbers.map(pageNumber => (
                                <button type="button" aria-current={pageNumber === currentPage ? 'page' : undefined} className={pageNumber === currentPage ? styles.currentPage : ''} key={pageNumber} onClick={() => goToPage(pageNumber)}>{pageNumber}</button>
                            ))}
                            <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)}>›</button>
                        </div>
                    </nav>
                )}
            </section>
        </main>
    );
}
