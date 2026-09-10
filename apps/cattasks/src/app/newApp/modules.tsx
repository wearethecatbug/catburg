// Input add/remove/toggle todo items in a list
// Три вкладки. Активная хранится в состоянии. Контент меняется.
import * as React from "react";

type Todo = { id: string; text: string; done: boolean };

export function TodoList() {
    const [text, setText] = React.useState("");
    const [todos, setTodos] = React.useState<Todo[]>([]);

    const add = () => {
        const t = text.trim();
        if (!t) return;

        setTodos(prev => [...prev, {id: crypto.randomUUID(), text: t, done: false}]);
        setText("");
    };

    const toggleDone = (id: string) => {
        setTodos(prev => prev.map(x => (x.id === id ? {...x, done: !x.done} : x)));
    };

    const remove = (id: string) => {
        setTodos(prev => prev.filter(x => x.id !== id));
    };

    return (
        <div>
            <input value={text} onChange={e => setText(e.target.value)}/>
            <button onClick={add}>Добавить</button>

            <ul>
                {todos.map(t => (
                    <li key={t.id}>
                        <label>
                            <input
                                type="checkbox"
                                checked={t.done}
                                onChange={() => toggleDone(t.id)}
                            />
                            <span style={{textDecoration: t.done ? "line-through" : "none"}}>
                                {t.text}
                            </span>
                        </label>
                        <button onClick={() => remove(t.id)}>Удалить</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const TABS = ["one", "two", "three"] as const;
type Tab = typeof TABS[number];

export function Tabs() {
    const [active, setActive] = React.useState<Tab>("one");

    return (
        <div>
            <div style={{display: "flex", gap: 8}}>
                {TABS.map(t => (
                    <button key={t} onClick={() => setActive(t)} disabled={t === active}>
                        {t}
                    </button>
                ))}
            </div>

            <div style={{marginTop: 12}}>
                {active === "one" && <div>Контент 1</div>}
                {active === "two" && <div>Контент 2</div>}
                {active === "three" && <div>Контент 3</div>}
            </div>
        </div>
    );
}

// TL;DR: Да. Если вкладки пользователь создаёт/удаляет, обычно родитель хранит массив вкладок и activeId, а “дочерний Tabs UI” получает это через props и сообщает события через callbacks. Так у тебя один источник правды и легко синхронизировать данные/URL/пермишены.
//
// 1) Базовый паттерн: Parent = state, Child = UI (controlled component)
//
// Parent (создание/удаление/active)

type ManagedTab = { id: string; title: string; content: React.ReactNode };

export function TabsContainer() {
    const [tabs, setTabs] = React.useState<ManagedTab[]>([
        { id: "home", title: "Home", content: <div>Home content</div> },
        { id: "profile", title: "Profile", content: <div>Profile content</div> },
    ]);
    const [activeId, setActiveId] = React.useState<string>("home");
    const [title, setTitle] = React.useState("");

    function addTab() {
        const t = title.trim();
        if (!t) return;

        const id = crypto.randomUUID();
        setTabs(prev => [...prev, { id, title: t, content: <div>{t} content</div> }]);
        setActiveId(id);
        setTitle("");
    }

    function removeTab(id: string) {
        setTabs(prev => prev.filter(x => x.id !== id));
        setActiveId(prevActive => {
            if (prevActive !== id) return prevActive;
            // если удалили активную — выбираем первую оставшуюся
            const next = tabs.find(x => x.id !== id)?.id;
            return next ?? "";
        });
    }

    const active = tabs.find(t => t.id === activeId);

    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="New tab title" />
                <button type="button" onClick={addTab}>Add tab</button>
            </div>

            <TabsView
                tabs={tabs}
                activeId={activeId}
                onChange={setActiveId}
                onClose={removeTab}
            />

            <div style={{ marginTop: 12, padding: 8, border: "1px solid #ccc" }}>
                {active ? active.content : <div>No tab selected</div>}
            </div>
        </div>
    );
}


// Child (только рендер и события)

type TabItem = { id: string; title: string };

type TabsViewProps = {
    tabs: TabItem[];
    activeId: string;
    onChange: (id: string) => void;
    onClose?: (id: string) => void;
};

export function TabsView({ tabs, activeId, onChange, onClose }: TabsViewProps) {
    return (
        <div style={{ display: "flex", gap: 8 }}>
            {tabs.map(t => {
                const active = t.id === activeId;
                return (
                    <div key={t.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button
                            type="button"
                            onClick={() => onChange(t.id)}
                            disabled={active}
                        >
                            {t.title}
                        </button>

                        {onClose && (
                            <button
                                type="button"
                                onClick={() => onClose(t.id)}
                                aria-label={`Close ${t.title}`}
                            >
                                ×
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}


// “Выбрать всё” (selectedIds)

const ITEMS = [
    {id: "a", label: "A"},
    {id: "b", label: "B"},
    {id: "c", label: "C"},
];

export function SelectAll() {
    const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

    const allSelected = selected.size === ITEMS.length;

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelected(prev => {
            if (prev.size === ITEMS.length) return new Set();
            return new Set(ITEMS.map(x => x.id));
        });
    };

    return (
        <div>
            <label>
                <input type="checkbox" checked={allSelected} onChange={toggleAll}/>
                Select all
            </label>

            <div style={{marginTop: 8}}>
                {ITEMS.map(x => (
                    <label key={x.id} style={{display: "block"}}>
                        <input
                            type="checkbox"
                            checked={selected.has(x.id)}
                            onChange={() => toggleOne(x.id)}
                        />
                        {x.label}
                    </label>
                ))}
            </div>

            <p>{selected.size} из {ITEMS.length}</p>
        </div>
    );
}

// 12) Сортировка списка (sortAsc)
//
// Лучший: хранить только флаг, сортировать копию

const NAMES = ["Zoe", "Ann", "Mike", "Bob"];

export function SortNames() {
    const [sortAsc, setSortAsc] = React.useState(true);

    const sorted = React.useMemo(() => {
        const copy = [...NAMES];
        copy.sort((a, b) => (sortAsc ? a.localeCompare(b) : b.localeCompare(a)));
        return copy;
    }, [sortAsc]);

    return (
        <div>
            <button onClick={() => setSortAsc(s => !s)}>Sort</button>
            <ul>{sorted.map(n => <li key={n}>{n}</li>)}</ul>
        </div>
    );
}

// пагинация

const PAGINATION_ITEMS = Array.from({length: 30}, (_, i) => `Item ${i + 1}`);
const PER_PAGE = 5;
const MAX_PAGE = Math.ceil(PAGINATION_ITEMS.length / PER_PAGE);

export function Pagination() {
    const [page, setPage] = React.useState(1);

    const start = (page - 1) * PER_PAGE;
    const visible = PAGINATION_ITEMS.slice(start, start + PER_PAGE);

    return (
        <div>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <span style={{padding: "0 8px"}}>{page} / {MAX_PAGE}</span>
            <button onClick={() => setPage(p => Math.min(MAX_PAGE, p + 1))} disabled={page === MAX_PAGE}>Next</button>

            <ul>{visible.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
    );
}

// пауза

export function IntervalCounter() {
    const [count, setCount] = React.useState(0);
    const [paused, setPaused] = React.useState(false);

    React.useEffect(() => {
        if (paused) return;

        const id = window.setInterval(() => {
            setCount(c => c + 1); // важно: functional update
        }, 1000);

        return () => window.clearInterval(id);
    }, [paused]);

    return (
        <div>
            <div>count: {count}</div>
            <button onClick={() => setPaused(p => !p)}>
                {paused ? "Resume" : "Pause"}
            </button>
            <button onClick={() => setCount(0)}>Reset</button>
        </div>
    );
}


// добавить убрать

type TodoItem = { id: string; title: string; done: boolean };

export function Todos() {
    const [todos, setTodos] = React.useState<TodoItem[]>([]);
    const [title, setTitle] = React.useState("");

    function addTodo() {
        const trimmed = title.trim();
        if (!trimmed) return;

        setTodos(prev => [
            ...prev,
            {id: crypto.randomUUID(), title: trimmed, done: false},
        ]);
        setTitle("");
    }

    function toggleTodo(id: string) {
        setTodos(prev => prev.map(t => (t.id === id ? {...t, done: !t.done} : t)));
    }

    function removeTodo(id: string) {
        setTodos(prev => prev.filter(t => t.id !== id));
    }

    return (
        <div>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    addTodo();
                }}
            >
                <input
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                    placeholder="New todo…"
                />
                <button type="submit">Add</button>
            </form>

            <ul>
                {todos.map(t => (
                    <TodoRow
                        key={t.id}
                        todo={t}
                        onToggle={toggleTodo}
                        onRemove={removeTodo}
                    />
                ))}
            </ul>
        </div>
    );
}

type TodoRowProps = {
    todo: TodoItem;
    onToggle: (id: string) => void;
    onRemove: (id: string) => void;
};

function TodoRow({todo, onToggle, onRemove}: TodoRowProps) {
    return (
        <li>
            <label>
                <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => onToggle(todo.id)}
                />
                {todo.title}
            </label>

            <button type="button" onClick={() => onRemove(todo.id)}>
                - Remove
            </button>
        </li>
    );
}
