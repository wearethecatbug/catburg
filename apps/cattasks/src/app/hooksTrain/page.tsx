// 0. Хуки useEffect, useRef, useState
// Тренировка хуков реакта
//
// 'use client';
//
// import {useEffect, useRef, useState} from "react";
// import {Application} from "pixi.js";
// import {initPixiApp} from "@/app/_components/tasks/Features/PixiScene";
//
//
// export default function Page() {
//
//     /**
//      * Посмотри как работает тут стейты и эфекты
//      * Вот мы сделали еррор стейт, лоадин стейт
//      */
//     const [error, setError] = useState<Error | null>(null);
//     const [loading, setLoading] = useState(true);
//     const pixiApplicationRef = useRef<Application>(null);
//     const pixiContainerRef = useRef<HTMLDivElement>(null);
//
//     /**
//      * Пока идет загрузка пикси тут у нас будето отображатся лоадер
//      */
//     useEffect(() => {
//         console.log('Initializing Pixi application...');
//         console.log('pixi container ref', pixiContainerRef.current);
//
//         let pixiContainer = pixiContainerRef.current
//         if (!pixiContainer) {
//             return;
//         }
//
//         if (!pixiApplicationRef.current) {
//             // Инициализируем пикси апп
//             initPixiApp(pixiContainer).then(app => {
//                 pixiApplicationRef.current = app;
//                 setLoading(false);
//             }).catch(err => {
//                 console.error("Failed to initialize Pixi application:", err);
//                 setError(err);
//                 setLoading(false);
//             });
//         }
//     }, []);
//
//     /**
//      * Если еррор не NULL то мы отображаем див эррор, а контент старницы нет, можно это проверить если сделать throw new Error('test error') например в useEffect
//      */
//     if (error) {
//         return <div>Error... {error.message}</div>;
//     }
//
//     return (
//         <div>
//         {loading && (<div>Loading...</div>)}
//             <div ref={pixiContainerRef}>
//                 {/*{JSON.stringify(parseTasksArr(tasksW))};*/}
//             </div>
//         </div>
//     );
// }

//1. Тогглер
// Кнопка «Показать/Скрыть». По клику переключает булево состояние и показывает/прячет блок.
// Тренировка: булево состояние, условный рендер.
//
// 'use client';
//
// import {useState} from "react";
//
// export default function Page() {
//     const [btnOpen, setBtnOpen] = useState(false);
//
//     return (
//         <div>
//             <button onClick={() => setBtnOpen(!btnOpen)}>
//                 {btnOpen ? 'Скрыть' : 'Показать'}
//             </button>
//             {btnOpen && (
//                 <div style={{marginTop: '10px', padding: '10px', border: '1px solid black'}}>
//                     Это скрываемый блок!
//                 </div>
//             )}
//             <h1>Example PixiJS with React</h1>
//         </div>
//     );
// }

// 2.Счётчик со шагом
// Кнопки +1, -1, +10, Reset. Кнопка +2 должна работать через функциональный апдейтер.
// Тренировка: setState(prev => prev + x), несколько апдейтов подряд.
//
// 'use client';
// import {useState} from "react";
//
//
// export default function Page() {
//     const [count, setCount] = useState(0);
//
//     const inc1 = () => setCount(c => c + 1);
//     const dec1 = () => setCount(c => c - 1);
//     const inc10 = () => setCount(c => c + 10);
//     const reset = () => setCount(0);
//
//     // +2 через функциональный апдейтер и несколько апдейтов подряд
//     const inc2 = () => {
//         setCount(c => c + 1);
//         setCount(c => c + 1);
//         // альтернативно одной операцией:
//         // setCount(c => c + 2);
//     };
//
//     return (
//         <div style={{display: "grid", gap: 8}}>
//             <div>Count: {count}</div>
//             <div style={{display: "flex", gap: 8}}>
//                 <button onClick={inc1}>+1</button>
//                 <button onClick={dec1}>-1</button>
//                 <button onClick={inc2}>+2</button>
//                 <button onClick={inc10}>+10</button>
//                 <button onClick={reset}>Reset</button>
//             </div>
//         </div>
//     );
// }

//3. Контролируемый инпут с очисткой
// Поле ввода, рядом «Очистить». Под полем — «Вы ввели: …».
// Тренировка: строка в состоянии, сброс.
//
// "use client";
// import {useState} from "react";
//
//
// export default function Page() {
//     const [value, setValue] = useState("");
//
//     const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//         setValue(e.target.value);
//     };
//
//     const clear = () => setValue("");
//
//     return (
//         <div style={{display: "grid", gap: 8, maxWidth: 360}}>
//             <label style={{display: "flex", gap: 8}}>
//                 <input
//                     value={value}
//                     onChange={onChange}
//                     placeholder="Введите текст"
//                     style={{flex: 1}}
//                 />
//                 <button onClick={clear} disabled={!value}>
//                     Очистить
//                 </button>
//             </label>
//             <div>Вы ввели: {value || "—"}</div>
//         </div>
//     );
// }

// 4.Объект формы
// Два поля: firstName, lastName. Обновлять по одному ключу без потери второго.
// Тренировка: объект в состоянии, спред при обновлении.
// 'use client';
// import {useState} from "react";
//
// type Form = { firstName: string; lastName: string };
//
// export default function NameForm() {
//     const [form, setForm] = useState<Form>({firstName: "", lastName: ""});
//
//     // частичное обновление одного поля
//     function update<K extends keyof Form>(key: K, value: Form[K]) {
//         setForm(prev => ({...prev, [key]: value}));
//     }
//
//     const reset = () => setForm({firstName: "", lastName: ""});
//
//     return (
//         <div style={{display: "grid", gap: 8, maxWidth: 360}}>
//             <label>
//                 Имя
//                 <input
//                     value={form.firstName}
//                     onChange={e => update("firstName", e.target.value)}
//                     placeholder="Иван"
//                 />
//             </label>
//
//             <label>
//                 Фамилия
//                 <input
//                     value={form.lastName}
//                     onChange={e => update("lastName", e.target.value)}
//                     placeholder="Иванов"
//                 />
//             </label>
//
//             <button onClick={reset} disabled={!form.firstName && !form.lastName}>
//                 Сброс
//             </button>
//
//             <div>Вы: {form.firstName} {form.lastName}</div>
//         </div>
//     );
// }
//
//
//
// 5.Список задач
// Инпут + кнопка «Добавить», список с чекбоксами «выполнено», кнопка «Удалить».
// Тренировка: массив в состоянии, иммутабельные обновления.
// 'use client';
// import {useState} from "react";
//
// type Todo = { id: string; text: string; done: boolean };
// export default function TodoList() {
//     const [text, setText] = useState("");
//     const [todos, setTodos] = useState<Todo[]>([]);
//
//     const add = (e?: React.FormEvent) => {
//         e?.preventDefault();
//         const t = text.trim();
//         if (!t) return;
//         setTodos(prev => [{id: crypto.randomUUID(), text: t, done: false}, ...prev]);
//         setText("");
//     };
//
//     const toggle = (id: string) =>
//         setTodos(prev => prev.map(it => (it.id === id ? {...it, done: !it.done} : it)));
//
//     const remove = (id: string) =>
//         setTodos(prev => prev.filter(it => it.id !== id));
//
//     return (
//         <div style={{display: "grid", gap: 8, maxWidth: 420}}>
//             <form onSubmit={add} style={{display: "flex", gap: 8}}>
//                 <input
//                     value={text}
//                     onChange={e => setText(e.target.value)}
//                     placeholder="Новая задача"
//                 />
//                 <button type="submit" disabled={!text.trim()}>
//                     Добавить
//                 </button>
//             </form>
//
//             <ul style={{listStyle: "none", padding: 0, display: "grid", gap: 6}}>
//                 {todos.map(todo => (
//                     <li key={todo.id} style={{display: "flex", alignItems: "center", gap: 8}}>
//                         <input
//                             type="checkbox"
//                             checked={todo.done}
//                             onChange={() => toggle(todo.id)}
//                         />
//                         <span style={{textDecoration: todo.done ? "line-through" : "none"}}>
//               {todo.text}
//             </span>
//                         <button onClick={() => remove(todo.id)}>Удалить</button>
//                     </li>
//                 ))}
//             </ul>
//         </div>
//     );
// }
//
//


//6. Выбор вкладки
// Три вкладки. Активная хранится в состоянии. Контент меняется.
//     Тренировка: хранить идентификатор, условный рендер.
// 'use client';
// import {useState} from 'react';
//
// type TabId = 'one' | 'two' | 'three';
//
// export default function Tabs() {
//     const [active, setActive] = useState<TabId>('one');
//
//     return (
//         <div style={{maxWidth: 520}}>
//             <div role="tablist" aria-label="Tabs" style={{display: 'flex', gap: 8, marginBottom: 12}}>
//                 <button
//                     role="tab"
//                     aria-selected={active === 'one'}
//                     onClick={() => setActive('one')}
//                 >
//                     Вкладка 1
//                 </button>
//                 <button
//                     role="tab"
//                     aria-selected={active === 'two'}
//                     onClick={() => setActive('two')}
//                 >
//                     Вкладка 2
//                 </button>
//                 <button
//                     role="tab"
//                     aria-selected={active === 'three'}
//                     onClick={() => setActive('three')}
//                 >
//                     Вкладка 3
//                 </button>
//             </div>
//
//             {active === 'one' && (
//                 <div role="tabpanel">Контент первой вкладки</div>
//             )}
//             {active === 'two' && (
//                 <div role="tabpanel">Контент второй вкладки</div>
//             )}
//             {active === 'three' && (
//                 <div role="tabpanel">Контент третьей вкладки</div>
//             )}
//         </div>
//     );
// }
//
//
//
//
// Вариант 2

// 'use client';
// import {useState, ReactNode} from 'react';
//
// type TabId = 'one' | 'two' | 'three';
//
// const TABS: { id: TabId; label: string }[] = [
//     { id: 'one', label: 'Вкладка 1' },
//     { id: 'two', label: 'Вкладка 2' },
//     { id: 'three', label: 'Вкладка 3' },
// ];
//
// export default function Tabs() {
//     const [active, setActive] = useState<TabId>('one');
//
//     function renderTabButton(id: TabId, label: string) {
//         const selected = active === id;
//         return (
//             <button
//                 key={id}
//                 role="tab"
//                 aria-selected={selected}
//                 onClick={() => setActive(id)}
//                 style={{ fontWeight: selected ? 700 : 400 }}
//             >
//                 {label}
//             </button>
//         );
//     }
//
//     function renderContent(id: TabId): ReactNode {
//         switch (id) {
//             case 'one':
//                 return <div role="tabpanel">Контент первой вкладки</div>;
//             case 'two':
//                 return <div role="tabpanel">Контент второй вкладки</div>;
//             case 'three':
//                 return <div role="tabpanel">Контент третьей вкладки</div>;
//             default:
//                 return null;
//         }
//     }
//
//     return (
//         <div style={{ maxWidth: 520 }}>
//             <div role="tablist" aria-label="Tabs" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
//                 {TABS.map(t => renderTabButton(t.id, t.label))}
//             </div>
//             {renderContent(active)}
//         </div>
//     );
// }

// 7. Аккордеон «одна открыта»
//
// Несколько секций. В состоянии id открытой или `null`. Клик по заголовку открывает её и закрывает остальные.
//
//  Тренировка: единственный источник правды, сравнение id.
// 'use client';
// import {ReactNode, useState} from 'react';
//
// type SectionId = 'one' | 'two' | 'three';
// type Item = { id: SectionId; label: string; content: ReactNode };
//
// const SECTIONS: Item[] = [
//     {
//         id: 'one',
//         label: 'Секция 1',
//         content:
//             'Контент первой секции. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
//     },
//     {
//         id: 'two',
//         label: 'Секция 2',
//         content:
//             'Контент второй секции. Ut enim ad minim veniam, quis nostrud exercitation.',
//     },
//     {
//         id: 'three',
//         label: 'Секция 3',
//         content:
//             'Контент третьей секции. Duis aute irure dolor in reprehenderit.',
//     },
// ];
//
// export default function OneOpenAccordion() {
//
//     const [active, setActive] = useState<SectionId | null>(null);
//     const toggle = (id: SectionId) => setActive(prev => (prev === id ? null : id));
//
//     return (
//         <div style={{maxWidth: 520}}>
//             {SECTIONS.map(({id, label, content}) => {
//                 const open = active === id;
//                 const btnId = `acc-btn-${id}`;
//                 const panelId = `acc-panel-${id}`;
//                 return (
//                     <section key={id} style={{border: '1px solid #ccc', borderRadius: 8, marginBottom: 8}}>
//                         <h3 style={{margin: 0}}>
//                             <button
//                                 id={btnId}
//                                 aria-expanded={open}
//                                 aria-controls={panelId}
//                                 onClick={() => toggle(id)}
//                                 style={{width: '100%', textAlign: 'left', padding: 12, fontWeight: 600}}
//                             >
//                                 {label}
//                             </button>
//                         </h3>
//                         {open && (
//                             <div
//                                 id={panelId}
//                                 role="region"
//                                 aria-labelledby={btnId}
//                                 style={{padding: 12, borderTop: '1px solid #ccc'}}
//                             >
//                                 {content}
//                             </div>
//                         )}
//                     </section>
//                 );
//             })}
//         </div>
//     );
// }
//


// 8. Счётчик с ленивой инициализацией
//
// Начальное значение читать из `localStorage` только один раз. Кнопка «Сохранить» записывает текущее.
//
// Тренировка: `useState(() => init())`, побочный эффект сохранения по кнопке.
//

// 'use client';
// import {useState} from 'react';
//
// const KEY = 'counter:v1';
//
// function loadInitial(): number {
//     if (typeof window === 'undefined') return 0; // SSR защита
//     try {
//         const raw = localStorage.getItem(KEY);
//         const n = Number(raw);
//         return Number.isFinite(n) ? n : 0;
//     } catch {
//         return 0;
//     }
// }
//
// export default function LazyCounter() {
//     const [count, setCount] = useState<number>(() => loadInitial());
//
//     const inc = () => setCount(c => c + 1);
//     const dec = () => setCount(c => c - 1);
//     const reset = () => setCount(0);
//
//     const save = () => {
//         try {
//             localStorage.setItem(KEY, String(count));
//             console.log('localStorage', Object.entries(localStorage));
//         } catch { /* игнорируем квоты/приватный режим */
//         }
//     };
//
//     return (
//         <div style={{display: 'grid', gap: 8}}>
//             <div>Count: {count}</div>
//             <div style={{display: 'flex', gap: 8}}>
//                 <button onClick={inc}>+1</button>
//                 <button onClick={dec}>-1</button>
//                 <button onClick={reset}>Reset</button>
//                 <button onClick={save}>Сохранить</button>
//             </div>
//         </div>
//     );
// }

// 9. Ограничение символов
//
// `textarea` с лимитом, под ним «Осталось: N». Когда `N < 0` — подсветка и кнопка «Отправить» неактивна.
//
// Тренировка: производные вычисления от состояния без отдельного стейта.

// 'use client';
// import {useState} from "react";
// import styles from './page.module.css';
//
// const LIMIT = 3;
//
// export default function LimitedTextarea() {
//     const [text, setText] = useState('');
//
//     const left = LIMIT - text.length;                    // производное значение
//     const canSubmit = text.length > 0 && left >= 0;      // правило доступности
//
//     const handleSubmit = () => {
//         if (!canSubmit) return;
//         console.log('Submitted!');
//     };
//
//     return (
//         <div style={{display: 'grid', gap: 8}}>
//       <textarea
//           rows={4}
//           cols={40}
//           value={text}
//           onChange={e => setText(e.target.value)}
//       />
//             <div style={{color: left < 0 ? '#ff3b30' : 'inherit'}}>
//                 Осталось: {left}
//             </div>
//             <button
//                 type="button"
//                 className={styles.btn}
//                 onClick={handleSubmit}
//                 disabled={!canSubmit}
//             >
//                 Отправить
//             </button>
//         </div>
//     );
// }

// 10. История выбора цвета
//
//     `<input type="color">`, под ним последние 5 выбранных цветов в виде кнопок-плиток. Клик по плитке применяет цвет.
//
//     Тренировка: массив фиксированной длины, обновление по клику.
//
//
// 'use client';
// import {useState} from 'react';
//
// const MAX = 5;
//
// export default function ColorHistory() {
//     const [color, setColor] = useState('#ff0000');   // зафиксированный цвет
//     const [picker, setPicker] = useState('#ff0000'); // живой во время перетаскивания
//     const [history, setHistory] = useState<string[]>([]);
//
//     // добавляем в начало, убираем дубликаты, режем до MAX
//     const push = (v: string) =>
//         setHistory(h => [v, ...h.filter(x => x !== v)].slice(0, MAX));
//
//     // тянем ползунок -> меняется только превью
//     function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
//         setPicker(e.currentTarget.value);
//     }
//
//     // запасной коммит, если onChange не сработал
//
//     function handleBlur() {
//         if (picker !== color) {
//             setColor(picker);
//             push(picker);
//         }
//     }
//
//     function apply(v: string) {
//         setColor(v);
//         setPicker(v);
//         push(v);
//     }
//
//     return (
//         <div style={{display: 'grid', gap: 12, maxWidth: 360}}>
//             <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
//                 <input
//                     type="color"
//                     value={picker}
//                     onInput={handleInput}
//                     onBlur={handleBlur}
//                     aria-label="Выбор цвета"
//                 />
//                 <span>{color}</span>
//             </label>
//
//             <div aria-label="Превью"
//                  style={{height: 56, border: '1px solid #ccc', borderRadius: 8, backgroundColor: color}}/>
//
//             <div style={{display: 'flex', gap: 8}}>
//                 {history.map(c => (
//                     <button
//                         key={c}
//                         type="button"
//                         onClick={() => {
//                             setColor(c);
//                             setPicker(c);
//                             push(c);
//                         }}
//                         title={c}
//                         aria-label={`Применить ${c}`}
//                         style={{width: 32, height: 32, borderRadius: 6, border: '1px solid #999', backgroundColor: c}}
//                     />
//                 ))}
//             </div>
//         </div>
//     );
// }

// 11. Выбор цвета по клику
//     `<input type="color">`, под ним 2 кнопки-плитки . Клик по плитке применяет цвет к ней.
//
// 'use client';
// import styles from './page.module.css';
// import {ChangeEvent, useState} from "react";
//
//
// export default function ColourPicker() {
//     const [color, setColor] = useState("#ff0000");
//
//
//     const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
//         setColor(e.target.value);
//         console.log("e.target.value" + e.target.value)
//     }
//
//     const changeColor = (e: React.MouseEvent<HTMLButtonElement>) => {
//         (e.target as HTMLButtonElement).style.backgroundColor = color;
//         (e.target as HTMLButtonElement).innerText = `Color ${color}`;
//     }
//
//
//     return (
//         <div style={{display: 'grid', gap: 8}}>
//             <input type="color" onChange={handleColorChange} value={color}/>
//             <button className={styles.btn} onClick={changeColor}>
//                 Color
//             </button>
//             <button className={styles.btn} onClick={changeColor}>
//                 Color
//             </button>
//         </div>
//     );
// }
//

// 12. Переключатель темы
// Кнопка переключает ‘light’/’dark’. Текст показывает текущую тему.

// 'use client';
// import {useEffect, useState} from 'react';
//
// type Theme = 'light' | 'dark';
//
// export default function ThemeToggle() {
//     const [theme, setTheme] = useState<Theme>('light');
//     const toggle = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));
//
//     // опционально: хук для CSS (html[data-theme="dark"] { ... })
//     useEffect(() => {
//         document.documentElement.dataset.theme = theme;
//     }, [theme]);
//
//     return (
//         <div style={{display: 'grid', gap: 8}}>
//             <button onClick={toggle}>Переключить тему</button>
//             <div>Тема: {theme}</div>
//         </div>
//     );
// }