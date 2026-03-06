'use client';
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

//
// export default function InputWithClear_NoState() {
//     const inputRef = React.useRef<HTMLInputElement | null>(null);
//     const outRef = React.useRef<HTMLDivElement | null>(null);
//
//     const sync = () => {
//         const v = inputRef.current?.value ?? "";
//         if (outRef.current) outRef.current.textContent = `Вы ввели: ${v}`;
//     };
//
//     const clear = () => {
//         if (inputRef.current) inputRef.current.value = "";
//         sync();
//         inputRef.current?.focus();
//     };
//
//     return (
//         <div>
//             <input className={styles.input} ref={inputRef} onInput={sync}/>
//             <button type="button" onClick={clear}>
//                 Очистить
//             </button>
//
//             <div ref={outRef}>Вы ввели:</div>
//         </div>
//     );
// }
//

// import React from "react";
//
// type FormState = { firstName: string; lastName: string };
//
// export function ObjectForm() {
//     const [form, setForm] = React.useState<FormState>({firstName: "", lastName: ""});
//
//     return (
//         <div>
//             <input
//                 placeholder="firstName"
//                 value={form.firstName}
//                 onChange={e => setForm(prev => ({...prev, firstName: e.target.value}))}
//             />
//             <input
//                 placeholder="lastName"
//                 value={form.lastName}
//                 onChange={e => setForm(prev => ({...prev, lastName: e.target.value}))}
//             />
//
//             <pre>{JSON.stringify(form)}</pre>
//         </div>
//     );
// }
//
// import * as React from "react";
//
// type Todo = { id: string; text: string; done: boolean };
//
// export function TodoList() {
//     const [text, setText] = React.useState("");
//     const [todos, setTodos] = React.useState<Todo[]>([]);
//
//     const add = () => {
//         const t = text.trim();
//         if (!t) return;
//
//         setTodos(prev => [...prev, {id: crypto.randomUUID(), text: t, done: false}]);
//         setText("");
//     };
//
//     const toggleDone = (id: string) => {
//         setTodos(prev => prev.map(x => (x.id === id ? {...x, done: !x.done} : x)));
//     };
//
//     const remove = (id: string) => {
//         setTodos(prev => prev.filter(x => x.id !== id));
//     };
//
//     return (
//         <div>
//             <input value={text} onChange={e => setText(e.target.value)}/>
//             <button onClick={add}>Добавить</button>
//
//             <ul>
//                 {todos.map(t => (
//                     <li key={t.id}>
//                         <label>
//                             <input
//                                 type="checkbox"
//                                 checked={t.done}
//                                 onChange={() => toggleDone(t.id)}
//                             />
//                             <span style={{textDecoration: t.done ? "line-through" : "none"}}>
//                 {t.text}
//               </span>
//                         </label>
//                         <button onClick={() => remove(t.id)}>Удалить</button>
//                     </li>
//                 ))}
//             </ul>
//         </div>
//     );
// }

// import * as React from "react";
//
//
// const SECTIONS = [
//     {id: "a", title: "A", body: "Текст A"},
//     {id: "b", title: "B", body: "Текст B"},
//     {id: "c", title: "C", body: "Текст C"},
// ];
//
// export function AccordionOneOpen() {
//     const [openId, setOpenId] = React.useState<string | null>(null);
//
//     return (
//         <div>
//             {SECTIONS.map(s => {
//                 const open = openId === s.id;
//                 return (
//                     <div key={s.id}>
//                         <button onClick={() => setOpenId(prev => (prev === s.id ? null : s.id))}>
//                             {s.title}
//                         </button>
//                         {open && <div style={{padding: 8}}>{s.body}</div>}
//                     </div>
//                 );
//             })}
//         </div>
//     );
// }


// import * as React from "react";
//
// const KEY = "my-counter";
//
// export function LazyStorageCounter() {
//     const [count, setCount] = React.useState<number>(() => {
//         const raw = localStorage.getItem(KEY);
//         const n = raw ? Number(raw) : 0;
//         return Number.isFinite(n) ? n : 0;
//     });
//
//     const save = () => localStorage.setItem(KEY, String(count));
//
//     return (
//         <div>
//             <div>{count}</div>
//             <button onClick={() => setCount(c => c + 1)}>+1</button>
//             <button onClick={() => setCount(c => c - 1)}>-1</button>
//             <button onClick={save}>Сохранить</button>
//         </div>
//     );
// }

// лимит текста
// import * as React from "react";
//
// export function TextLimit() {
//     const LIMIT = 20;
//     const [value, setValue] = React.useState("");
//
//     const left = LIMIT - value.length;
//     const invalid = left < 0;
//
//     return (
//         <div>
//             <textarea value={value} onChange={e => setValue(e.target.value)}/>
//             <div style={{fontWeight: invalid ? "bold" : "normal"}}>
//                 Осталось: {left}
//             </div>
//             <button disabled={invalid}>Отправить</button>
//         </div>
//     );
// }

// import * as React from "react";
//
// const TABS = ["home", "profile", "settings"] as const;
// type Tab = typeof TABS[number];
//
// export function Tabs() {
//     const [currentTab, setCurrentTab] = React.useState<Tab>("home");
//
//     return (
//         <div>
//             <div style={{display: "flex", gap: 8}}>
//                 {TABS.map(t => (
//                     <button key={t} disabled={t === currentTab} onClick={() => setCurrentTab(t)}>
//                         {t}
//                     </button>
//                 ))}
//             </div>
//
//             <div style={{marginTop: 12}}>
//                 {currentTab === "home" && <div>Home content</div>}
//                 {currentTab === "profile" && <div>Profile content</div>}
//                 {currentTab === "settings" && <div>Settings content</div>}
//             </div>
//         </div>
//     );
// }

// import * as React from "react";
//
// const ITEMS = [
//     {id: "a", label: "A"},
//     {id: "b", label: "B"},
//     {id: "c", label: "C"},
// ];
//
// export function SelectAll() {
//     const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
//
//     const allSelected = selected.size === ITEMS.length;
//
//     const toggleOne = (id: string) => {
//         setSelected(prev => {
//             const next = new Set(prev);
//             next.has(id) ? next.delete(id) : next.add(id);
//             return next;
//         });
//     };
//
//     const toggleAll = () => {
//         setSelected(prev => {
//             if (prev.size === ITEMS.length) return new Set();
//             return new Set(ITEMS.map(x => x.id));
//         });
//     };
//
//     return (
//         <div>
//             <label>
//                 <input type="checkbox" checked={allSelected} onChange={toggleAll}/>
//                 Select all
//             </label>
//
//             <div style={{marginTop: 8}}>
//                 {ITEMS.map(x => (
//                     <label key={x.id} style={{display: "block"}}>
//                         <input
//                             type="checkbox"
//                             checked={selected.has(x.id)}
//                             onChange={() => toggleOne(x.id)}
//                         />
//                         {x.label}
//                     </label>
//                 ))}
//             </div>
//
//             <p>{selected.size} из {ITEMS.length}</p>
//         </div>
//     );
// }

// import * as React from "react";
//
// export function StarRating() {
//     const [rating, setRating] = React.useState(0); // 0..5
//     const [hover, setHover] = React.useState(0);   // 0..5
//
//     const active = hover || rating;
//
//     return (
//         <div>
//             {Array.from({length: 5}, (_, i) => {
//                 const v = i + 1;
//                 return (
//                     <button
//                         key={v}
//                         type="button"
//                         onMouseEnter={() => setHover(v)}
//                         onMouseLeave={() => setHover(0)}
//                         onClick={() => setRating(v)}
//                         aria-label={`${v} stars`}
//                         style={{fontSize: 22}}
//                     >
//                         {v <= active ? "★" : "☆"}
//                     </button>
//                 );
//             })}
//             <div>Rating: {rating}</div>
//         </div>
//     );
// }
// import * as React from "react";
//
// export function PasswordField() {
//     const [value, setValue] = React.useState("");
//     const [show, setShow] = React.useState(false);
//
//     return (
//         <div>
//             <input
//                 type={show ? "text" : "password"}
//                 value={value}
//                 onChange={e => setValue(e.target.value)}
//             />
//             <button type="button" onClick={() => setShow(s => !s)}>
//                 {show ? "Hide" : "Show"}
//             </button>
//         </div>
//     );
// }
// import * as React from "react";
//
// export function LivePreview() {
//     const [value, setValue] = React.useState("");
//
//     return (
//         <div style={{display: "flex", gap: 12}}>
//             <input value={value} onChange={e => setValue(e.target.value)}/>
//             <div>{value.toUpperCase()}</div>
//         </div>
//     );
// }
// import * as React from "react";
//
// const PRICE_A = 100;
// const PRICE_B = 250;
//
// export function MiniCart() {
//     const [qtyA, setQtyA] = React.useState(0);
//     const [qtyB, setQtyB] = React.useState(0);
//
//     const total = qtyA * PRICE_A + qtyB * PRICE_B;
//
//     return (
//         <div>
//             <div>
//                 A: {qtyA}{" "}
//                 <button onClick={() => setQtyA(q => Math.max(0, q - 1))}>-</button>
//                 <button onClick={() => setQtyA(q => q + 1)}>+</button>
//             </div>
//             <div>
//                 B: {qtyB}{" "}
//                 <button onClick={() => setQtyB(q => Math.max(0, q - 1))}>-</button>
//                 <button onClick={() => setQtyB(q => q + 1)}>+</button>
//             </div>
//             <p>Total: {total}</p>
//         </div>
//     );
// }

// import * as React from "react";
//
// const SECTIONS = [
//     {title: "One", body: "Body 1"},
//     {title: "Two", body: "Body 2"},
//     {title: "Three", body: "Body 3"},
// ];
//
// export function Accordion() {
//     const [openIndex, setOpenIndex] = React.useState<number | null>(null);
//
//     return (
//         <div>
//             {SECTIONS.map((s, i) => {
//                 const open = openIndex === i;
//                 return (
//                     <div key={s.title}>
//                         <button onClick={() => setOpenIndex(prev => (prev === i ? null : i))}>
//                             {s.title}
//                         </button>
//                         {open && <div>{s.body}</div>}
//                     </div>
//                 );
//             })}
//         </div>
//     );
// }

// import * as React from "react";
//
// export function ModalExample() {
//     const [isOpen, setIsOpen] = React.useState(false);
//
//     return (
//         <div>
//             <button onClick={() => setIsOpen(true)}>Open</button>
//
//             {isOpen && (
//                 <div
//                     onClick={() => setIsOpen(false)}
//                     style={{
//                         position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
//                         display: "grid", placeItems: "center",
//                     }}
//                 >
//                     <div
//                         onClick={e => e.stopPropagation()}
//                         style={{background: "white", padding: 16}}
//                     >
//                         <div>Modal content</div>
//                         <button onClick={() => setIsOpen(false)}>Close</button>
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// }

// import * as React from "react";
//
// const COLORS = ["#ff0000", "#00ff00", "#0000ff"] as const;
//
// export function Palette() {
//     const [color, setColor] = React.useState<string>(COLORS[0]);
//
//     return (
//         <div>
//             <div style={{display: "flex", gap: 8}}>
//                 {COLORS.map(c => (
//                     <button key={c} onClick={() => setColor(c)} style={{width: 32, height: 32, background: c}}/>
//                 ))}
//             </div>
//             <div style={{marginTop: 12, width: 80, height: 80, background: color, border: "1px solid #000"}}/>
//         </div>
//     );
// }

// import * as React from "react";
//
// const NAMES = ["Zoe", "Ann", "Mike", "Bob"];
//
// export function SortNames() {
//     const [sortAsc, setSortAsc] = React.useState(true);
//
//     const sorted = React.useMemo(() => {
//         const copy = [...NAMES];
//         copy.sort((a, b) => (sortAsc ? a.localeCompare(b) : b.localeCompare(a)));
//         return copy;
//     }, [sortAsc]);
//
//     return (
//         <div>
//             <button onClick={() => setSortAsc(s => !s)}>Sort</button>
//             <ul>{sorted.map(n => <li key={n}>{n}</li>)}</ul>
//         </div>
//     );
// }

// import * as React from "react";
//
// const NAMES = ["Zoe", "Ann", "Mike", "Bob"];
// type SortDirection = "ascending" | "descending";
//
// export function SortNames() {
//     const [sortDirection, setSortDirection] = React.useState<SortDirection>("ascending");
//
//     const sortedNames = React.useMemo(() => {
//         const namesCopy = [...NAMES];
//         const asc = sortDirection === "ascending";
//         namesCopy.sort((a, b) => (asc ? a.localeCompare(b) : b.localeCompare(a)));
//         return namesCopy;
//     }, [sortDirection]);
//
//     return (
//         <div>
//             <button
//                 type="button"
//                 onClick={() =>
//                     setSortDirection(d => (d === "ascending" ? "descending" : "ascending"))
//                 }
//             >
//                 Toggle sort
//             </button>
//             <ul>{sortedNames.map(n => <li key={n}>{n}</li>)}</ul>
//         </div>
//     );
// }

// import * as React from "react";
//
// const ITEMS = Array.from({length: 30}, (_, i) => `Item ${i + 1}`);
// const PER_PAGE = 5;
// const MAX_PAGE = Math.ceil(ITEMS.length / PER_PAGE);
//
// export function Pagination() {
//     const [page, setPage] = React.useState(1);
//
//     const start = (page - 1) * PER_PAGE;
//     const visible = ITEMS.slice(start, start + PER_PAGE);
//
//     return (
//         <div>
//             <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
//             <span style={{padding: "0 8px"}}>{page} / {MAX_PAGE}</span>
//             <button onClick={() => setPage(p => Math.min(MAX_PAGE, p + 1))} disabled={page === MAX_PAGE}>Next</button>
//
//             <ul>{visible.map(x => <li key={x}>{x}</li>)}</ul>
//         </div>
//     );
// }

// import * as React from "react";
//
// export function SimpleForm() {
//     const [name, setName] = React.useState("");
//     const [email, setEmail] = React.useState("");
//
//     const canSubmit = name.trim() !== "" && email.includes("@");
//
//     return (
//         <form onSubmit={e => e.preventDefault()}>
//             <input placeholder="name" value={name} onChange={e => setName(e.target.value)}/>
//             <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)}/>
//             <button disabled={!canSubmit}>Submit</button>
//         </form>
//     );
// }
// import * as React from "react";
//
// type State = { liked: boolean; count: number };
//
// type Action =
//     | { type: "toggle" }
//     | { type: "setCount"; value: number };
//
// function assertNever(x: never): never {
//     throw new Error("Unexpected action: " + JSON.stringify(x));
// }
//
// function reducer(state: State, action: Action): State {
//     switch (action.type) {
//         case "toggle":
//             return {
//                 liked: !state.liked,
//                 count: state.count + (state.liked ? -1 : 1),
//             };
//
//         case "setCount":
//             return {...state, count: action.value};
//
//         default:
//             return assertNever(action); // если добавишь новый action и забудешь case — будет ошибка компиляции
//     }
// }
//
// export function LikeReducer() {
//     const [state, dispatch] = React.useReducer(reducer, {liked: false, count: 10});
//
//     return (
//         <div>
//             <button type="button" onClick={() => dispatch({type: "toggle"})}>
//                 {state.liked ? "Unlike" : "Like"}
//             </button>
//             <button type="button" onClick={() => dispatch({type: "setCount", value: 10})}>
//                 .count
//             </button>
//             <span style={{paddingLeft: 8}}>{state.count}</span>
//         </div>
//     );
// }
// import * as React from "react";
//
// type Tag = { id: string; text: string };
//
// export function Tags() {
//     const [tags, setTags] = React.useState<Tag[]>([]);
//     const [value, setValue] = React.useState("");
//
//     const add = () => {
//         const t = value.trim();
//         if (!t) return;
//
//         setTags(prev => (prev.length >= 5 ? prev : [...prev, {id: crypto.randomUUID(), text: t}]));
//         setValue("");
//     };
//
//     const remove = (id: string) => setTags(prev => prev.filter(x => x.id !== id));
//
//     return (
//         <div>
//             <input value={value} onChange={e => setValue(e.target.value)}/>
//             <button type="button" onClick={add} disabled={tags.length >= 5}>Add</button>
//
//             <ul>
//                 {tags.map(t => (
//                     <li key={t.id}>
//                         {t.text}
//                         <button type="button" onClick={() => remove(t.id)}>x</button>
//                     </li>
//                 ))}
//             </ul>
//         </div>
//     );
// }
//
// import * as React from "react";
//
// export function MoveItems() {
//     const [items, setItems] = React.useState(["A", "B", "C", "D"]);
//
//     const swap = (i: number, j: number) => {
//         setItems(prev => {
//             if (i < 0 || j < 0 || i >= prev.length || j >= prev.length) return prev;
//             const next = [...prev];
//             [next[i], next[j]] = [next[j], next[i]];
//             return next;
//         });
//     };
//
//     return (
//         <ul>
//             {items.map((x, i) => (
//                 <li key={`${x}-${i}`}>
//                     {x}{" "}
//                     <button type="button" onClick={() => swap(i, i - 1)} disabled={i === 0}>
//                         Up
//                     </button>
//                     <button
//                         type="button"
//                         onClick={() => swap(i, i + 1)}
//                         disabled={i === items.length - 1}
//                     >
//                         Down
//                     </button>
//                 </li>
//             ))}
//         </ul>
//     );
// }

// import * as React from "react";
//
// type Unit = "C" | "F";
// type TempState = { unit: Unit; valueText: string };
//
// const round2 = (n: number) => Math.round(n * 100) / 100;
//
// function parseNumberOrNull(s: string): number | null {
//     if (s.trim() === "") return null;
//     const n = Number(s);
//     return Number.isFinite(n) ? n : null;
// }
//
// // Убираем ведущие нули при наборе: "05" -> "5", "-05" -> "-5"
// // Но оставляем "0." как есть (для десятичных)
// function stripLeadingZero(raw: string): string {
//     if (raw === "" || raw === "0" || raw === "-0") return raw;
//
//     // десятичные: "0." или "-0." — оставляем
//     if (raw.startsWith("0.") || raw.startsWith("-0.")) return raw;
//
//     // "00012" -> "12"
//     if (/^0+\d/.test(raw)) return raw.replace(/^0+/, "");
//
//     // "-00012" -> "-12"
//     if (/^-0+\d/.test(raw)) return "-" + raw.replace(/^-0+/, "");
//
//     // "00" -> "0"
//     if (/^0+$/.test(raw)) return "0";
//
//     return raw;
// }
//
// function convert(value: number, unit: Unit): { unit: Unit; value: number } {
//     return unit === "C"
//         ? {unit: "F", value: value * 9 / 5 + 32}
//         : {unit: "C", value: (value - 32) * 5 / 9};
// }
//
// export function TemperatureToggle() {
//     const [t, setT] = React.useState<TempState>({unit: "C", valueText: "0"});
//
//     const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
//         // чтобы при вводе “0” заменялся автоматически
//         if (t.valueText === "0") e.currentTarget.select();
//     };
//
//     const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//         const raw = e.target.value; // для type="number" это строка
//         // разрешаем пустое (пользователь стер)
//         if (raw === "") {
//             setT(s => ({...s, valueText: ""}));
//             return;
//         }
//
//         // убираем ведущие нули при ручном вводе
//         const normalized = stripLeadingZero(raw);
//         setT(s => ({...s, valueText: normalized}));
//     };
//
//     const handleBlur = () => {
//         // если оставили пустым — вернём "0"
//         setT(prev => (prev.valueText === "" ? {...prev, valueText: "0"} : prev));
//     };
//
//     const toggleUnit = () => {
//         setT(prev => {
//             const n = parseNumberOrNull(prev.valueText);
//             if (n === null) return prev;
//
//             const next = convert(n, prev.unit);
//             return {unit: next.unit, valueText: String(round2(next.value))};
//         });
//     };
//
//     const canToggle = parseNumberOrNull(t.valueText) !== null;
//
//     return (
//         <div>
//             <input
//                 type="number"
//                 step="1"          // или "any", если хочешь дроби
//                 value={t.valueText}
//                 onFocus={handleFocus}
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//             />
//
//             <span style={{padding: "0 8px"}}>{t.unit}</span>
//
//             <button type="button" onClick={toggleUnit} disabled={!canToggle}>
//                 Toggle
//             </button>
//         </div>
//     );
// }

// "use client";
// import * as React from "react";
//
// type Item = { id: string; category: "a" | "b" | "c" };
//
// const DATA: Item[] = [
//     {id: "1", category: "a"},
//     {id: "2", category: "b"},
//     {id: "3", category: "a"},
//     {id: "4", category: "c"},
// ];
//
// const CATEGORIES = ["a", "b", "c"] as const;
// type Category = (typeof CATEGORIES)[number];
//
// // ✅ Это то, что ты импортируешь в page.tsx: <FilterChips />
// export function FilterChips() {
//     return (
//         <FilterChipsBase<Item, Category>
//             items={DATA}
//             categories={CATEGORIES}
//             getCategory={(x) => x.category}
//             getKey={(x) => x.id}
//             renderItem={(x) => `Item ${x.id} (${x.category})`}
//             emptyMeansAll={true}
//         />
//     );
// }
//
// type FilterChipsProps<TItem, TCat extends string> = {
//     items: readonly TItem[];
//     categories: readonly TCat[];
//     getCategory: (item: TItem) => TCat;
//     getKey: (item: TItem) => React.Key;
//     renderItem: (item: TItem) => React.ReactNode;
//     emptyMeansAll?: boolean;
// };
//
// function FilterChipsBase<TItem, TCat extends string>(props: FilterChipsProps<TItem, TCat>) {
//     const {items, categories, getCategory, getKey, renderItem, emptyMeansAll = true} = props;
//
//     const [active, setActive] = React.useState<Set<TCat>>(() => new Set());
//
//     const toggle = (cat: TCat) => {
//         setActive(prev => {
//             const next = new Set(prev);
//             next.has(cat) ? next.delete(cat) : next.add(cat);
//             return next;
//         });
//     };
//
//     const clear = () => setActive(new Set<TCat>());
//
//     const filtered = React.useMemo(() => {
//         const noFilter = active.size === 0 && emptyMeansAll;
//         return noFilter ? items : items.filter(x => active.has(getCategory(x)));
//     }, [items, active, emptyMeansAll, getCategory]);
//
//     return (
//         <div>
//             <div role="group" aria-label="Filters" style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
//                 {categories.map(cat => {
//                     const pressed = active.has(cat);
//                     return (
//                         <button
//                             key={cat}
//                             type="button"
//                             onClick={() => toggle(cat)}
//                             aria-pressed={pressed}
//                             style={{
//                                 border: "1px solid",
//                                 borderRadius: 999,
//                                 padding: "6px 10px",
//                                 background: pressed ? "rgba(0,0,0,0.08)" : "transparent",
//                             }}
//                         >
//                             {cat}
//                         </button>
//                     );
//                 })}
//
//                 <button type="button" onClick={clear} disabled={active.size === 0}>
//                     Clear
//                 </button>
//             </div>
//
//             <p style={{marginTop: 12}}>
//                 Подходит: {filtered.length} из {items.length}
//             </p>
//
//             <ul>
//                 {filtered.map(item => (
//                     <li key={getKey(item)}>{renderItem(item)}</li>
//                 ))}
//             </ul>
//         </div>
//     );
// }

// import * as React from "react";
//
// // хук с рефом для сохранения колбэка
// function useInterval(callback: () => void, delay: number | null) {
//     const saved = React.useRef(callback);
//
//     React.useEffect(() => {
//         saved.current = callback;
//     }, [callback]);
//
//     React.useEffect(() => {
//         if (delay === null) return;
//         const id = window.setInterval(() => saved.current(), delay);
//         return () => window.clearInterval(id);
//     }, [delay]);
// }
//
// export function IntervalCounter2() {
//     const [count, setCount] = React.useState(0);
//     const [paused, setPaused] = React.useState(false);
//
//     useInterval(() => setCount(c => c + 1), paused ? null : 1000);
//
//     return (
//         <div>
//             <div>count: {count}</div>
//             <button onClick={() => setPaused(p => !p)}>
//                 {paused ? "Resume" : "Pause"}
//             </button>
//         </div>
//     );
// }

// import * as React from "react";
//
// export function WindowWidth() {
//     const [width, setWidth] = React.useState(() =>
//         typeof window === "undefined" ? 0 : window.innerWidth
//     );
//
//     React.useEffect(() => {
//         if (typeof window === "undefined") return;
//
//         const onResize = () => setWidth(window.innerWidth);
//
//         onResize(); // инициализация
//         window.addEventListener("resize", onResize);
//
//         return () => window.removeEventListener("resize", onResize);
//     }, []);
//
//     return <div>width: {width}px</div>;
// }
// import * as React from "react";
//
// type Item = { id: string; title: string; tags: string[] };
//
// const DATA: Item[] = [
//     {id: "1", title: "React useEffect dependencies", tags: ["react", "hooks"]},
//     {id: "2", title: "React useLayoutEffect vs useEffect", tags: ["react", "hooks"]},
//     {id: "3", title: "TypeScript union types", tags: ["typescript"]},
//     {id: "4", title: "TypeScript generics basics", tags: ["typescript"]},
//     {id: "5", title: "Next.js SSR hydration pitfalls", tags: ["nextjs", "ssr"]},
//     {id: "6", title: "AbortController with fetch", tags: ["fetch", "network"]},
//     {id: "7", title: "Debounce vs throttle", tags: ["performance"]},
//     {id: "8", title: "Window resize listener pattern", tags: ["browser", "events"]},
//     {id: "9", title: "Click outside dropdown", tags: ["ui", "events"]},
//     {id: "10", title: "useSyncExternalStore basics", tags: ["react", "hooks"]},
// ];
//
// // “псевдо-fetch”: имитируем сеть и умеем отменять через AbortController
// function searchLocalApi(query: string, signal: AbortSignal): Promise<Item[]> {
//     return new Promise((resolve, reject) => {
//         const q = query.trim().toLowerCase();
//
//         const t = window.setTimeout(() => {
//             // если отменили до таймаута — просто не отдаём результат
//             if (signal.aborted) return;
//
//             const res = DATA.filter((x) => {
//                 const hay = `${x.title} ${x.tags.join(" ")}`.toLowerCase();
//                 return hay.includes(q);
//             }).slice(0, 10);
//
//             resolve(res);
//         }, 250); // “сетевой” лаг
//
//         const onAbort = () => {
//             window.clearTimeout(t);
//             // emulate AbortError like fetch
//             const err = new DOMException("Aborted", "AbortError");
//             reject(err);
//         };
//
//         signal.addEventListener("abort", onAbort, {once: true});
//     });
// }
//
// export function DebouncedSearchLocal() {
//     const [q, setQ] = React.useState("");
//     const [items, setItems] = React.useState<Item[]>([]);
//     const [loading, setLoading] = React.useState(false);
//     const [error, setError] = React.useState<string | null>(null);
//
//     React.useEffect(() => {
//         const query = q.trim();
//
//         if (!query) {
//             setItems([]);
//             setLoading(false);
//             setError(null);
//             return;
//         }
//
//         const ac = new AbortController();
//
//         const debounceId = window.setTimeout(async () => {
//             try {
//                 setLoading(true);
//                 setError(null);
//
//                 const res = await searchLocalApi(query, ac.signal);
//                 setItems(res);
//             } catch (e) {
//                 // как в fetch: AbortError — это нормальная отмена, не показываем как ошибку
//                 if ((e as any)?.name === "AbortError") return;
//                 setError((e as Error).message ?? "Unknown error");
//             } finally {
//                 setLoading(false);
//             }
//         }, 500);
//
//         return () => {
//             window.clearTimeout(debounceId);
//             ac.abort();
//         };
//     }, [q]);
//
//     return (
//         <div style={{maxWidth: 520}}>
//             <input
//                 value={q}
//                 onChange={(e) => setQ(e.target.value)}
//                 placeholder="Search (например: react, typescript, debounce, ssr)..."
//                 style={{width: "100%", padding: 8}}
//             />
//
//             <div style={{marginTop: 8}}>
//                 {loading && <div>Loading…</div>}
//                 {error && <div style={{color: "crimson"}}>{error}</div>}
//
//                 {!loading && !error && q.trim() && items.length === 0 && (
//                     <div>No results</div>
//                 )}
//
//                 <ul>
//                     {items.map((x) => (
//                         <li key={x.id}>
//                             {x.title}{" "}
//                             <small style={{opacity: 0.7}}>
//                                 [{x.tags.join(", ")}]
//                             </small>
//                         </li>
//                     ))}
//                 </ul>
//             </div>
//         </div>
//     );
// }

// import * as React from "react";
//
// type OpBtn = "+" | "-" | "*" | "/" | null;
//
// type State = {
//     display: string;   // то, что показываем на экране
//     acc: number | null; // аккумулятор (предыдущее число)
//     op: OpBtn;            // выбранная операция
//     entering: boolean; // сейчас набираем новое число?
//     error: string | null;
//     secretBuf: string;        // последние цифры
//     secretMsg: string | null; // сообщение на экране
// };
//
// type Action =
//     | { type: "digit"; digit: string }      // "0".."9"
//     | { type: "dot" }                       // "."
//     | { type: "op"; op: Exclude<OpBtn, null> } // "+-*/"
//     | { type: "eq" }                        // "="
//     | { type: "clear" }                     // "C"
//     | { type: "sign" }                      // "+/-"
//     | { type: "percent" };                  // "%"
//
// const initialState: State = {
//     display: "0",
//     acc: null,
//     op: null,
//     entering: false,
//     error: null,
//     secretBuf: "",
//     secretMsg: null,
// };
//
//
// const SECRET = "1337";
// const SECRET_TEXT = "Рядом с тобой крот! 🦡";
//
// function OpButton({
//                       op,
//                       label,
//                       state,
//                       dispatch,
//                   }: {
//     op: OpBtn;
//     label: string;
//     state: { op: OpBtn | null; acc: number | null; error: string | null };
//     dispatch: React.Dispatch<any>;
// }) {
//     const isActive = state.error == null && state.acc != null && state.op === op;
//
//     return (
//         <button
//             className={`btn ${isActive ? "btn--active" : ""}`}
//             onClick={() => dispatch({type: "op", op})}
//         >
//             {label}
//         </button>
//     );
// }
//
// function toNumber(display: string) {
//     // display гарантированно валиден: "-", "0", "12.3" и т.п.
//     return Number(display);
// }
//
// function format(n: number) {
//     // простое форматирование, без локалей
//     if (!Number.isFinite(n)) return "Error";
//     // уберём ".0"
//     const s = String(n);
//     return s.endsWith(".0") ? s.slice(0, -2) : s;
// }
//
// function applyOp(a: number, b: number, op: Exclude<Op, null>): number {
//     switch (op) {
//         case "+":
//             return a + b;
//         case "-":
//             return a - b;
//         case "*":
//             return a * b;
//         case "/":
//             return b === 0 ? NaN : a / b;
//     }
// }
//
// function updateSecretOnDigit(state: State, digit: string): Pick<State, "secretBuf" | "secretMsg"> {
//     // держим, например, последние 8 цифр
//     const nextBuf = (state.secretBuf + digit).slice(-8);
//
//     // если найден секрет — показываем сообщение
//     const hit = nextBuf.endsWith(SECRET);
//
//     return {
//         secretBuf: nextBuf,
//         secretMsg: hit ? SECRET_TEXT : state.secretMsg,
//     };
// }
//
// function reducer(state: State, action: Action): State {
//     if (state.error && action.type !== "clear") {
//         // в ошибке — только clear снимает
//         return state;
//     }
//
//     switch (action.type) {
//         case "clear":
//             return initialState;
//
//         case "digit": {
//             const d = action.digit;
//             const secret = updateSecretOnDigit(state, d);
//             if (state.entering) {
//                 const next = state.display === "0" ? d : state.display + d;
//                 return {...state, ...secret, display: next};
//             }
//             // начинаем ввод нового числа
//             return {...state, ...secret, display: d, entering: true};
//         }
//
//         case "dot": {
//             if (state.entering) {
//                 if (state.display.includes(".")) return state;
//                 return {...state, display: state.display + "."};
//             }
//             return {...state, display: "0.", entering: true};
//         }
//
//         case "sign": {
//             if (state.display === "0") return state;
//             if (state.display.startsWith("-")) {
//                 return {...state, display: state.display.slice(1)};
//             }
//             return {...state, display: "-" + state.display};
//         }
//
//         case "percent": {
//             const n = toNumber(state.display) / 100;
//             return {...state, display: format(n), entering: false};
//         }
//
//         case "op": {
//             const current = toNumber(state.display);
//
//             // если операции ещё нет — зафиксировали acc и ждём новое число
//             if (state.op === null || state.acc === null) {
//                 return {...state, acc: current, op: action.op, entering: false};
//             }
//
//             // если уже есть op, и пользователь нажимает новую op:
//             // - если он НЕ вводил новое число (entering=false) — просто заменяем op
//             if (!state.entering) {
//                 return {...state, op: action.op};
//             }
//
//             // - если вводил — выполняем предыдущую op (цепочкой)
//             const res = applyOp(state.acc, current, state.op);
//             if (!Number.isFinite(res)) return {
//                 ...state,
//                 display: "Error",
//                 error: "Math error",
//                 acc: null,
//                 op: null,
//                 entering: false
//             };
//             return {...state, display: format(res), acc: res, op: action.op, entering: false};
//         }
//
//         case "eq": {
//             const current = toNumber(state.display);
//
//             if (state.op === null || state.acc === null) {
//                 // нечего считать
//                 return {...state, entering: false};
//             }
//
//             // если "=" нажали сразу после op (entering=false), трактуем как a op a
//             const b = state.entering ? current : state.acc;
//
//             const res = applyOp(state.acc, b, state.op);
//             if (!Number.isFinite(res)) return {
//                 ...state,
//                 display: "🐖",
//                 error: "Tribble error",
//                 acc: null,
//                 op: null,
//                 entering: false
//             };
//             return {...state, display: format(res), acc: null, op: null, entering: false};
//         }
//
//         default:
//             return state;
//     }
// }
//
// export function Calculator() {
//     const [state, dispatch] = React.useReducer(reducer, initialState);
//
//     const opStyle = (op: Exclude<OpBtn, null>): React.CSSProperties => {
//         const isActive = state.op === op && state.acc != null && !state.error;
//         return isActive ? {outline: "2px solid currentColor", fontWeight: 700} : {};
//     };
//
//     return (
//         <div style={{width: 240, fontFamily: "system-ui"}}>
//             <div style={{padding: 12, border: "1px solid #ccc", marginBottom: 8, textAlign: "right"}}>
//                 {state.display}
//             </div>
//             {state.secretMsg && (
//                 <div style={{marginBottom: 8, textAlign: "center", fontWeight: 700}}>
//                     {state.secretMsg}
//                 </div>
//             )}
//
//             <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6}}>
//                 <button onClick={() => dispatch({type: "clear"})}>C</button>
//                 <button onClick={() => dispatch({type: "sign"})}>+/-</button>
//                 <button onClick={() => dispatch({type: "percent"})}>%</button>
//                 <button style={opStyle("/")} onClick={() => dispatch({type: "op", op: "/"})}>÷</button>
//
//                 {"789".split("").map(d => (
//                     <button key={d} onClick={() => dispatch({type: "digit", digit: d})}>{d}</button>
//                 ))}
//                 <button style={opStyle("*")} onClick={() => dispatch({type: "op", op: "*"})}>×</button>
//
//                 {"456".split("").map(d => (
//                     <button key={d} onClick={() => dispatch({type: "digit", digit: d})}>{d}</button>
//                 ))}
//                 <button style={opStyle("-")} onClick={() => dispatch({type: "op", op: "-"})}>−</button>
//
//                 {"123".split("").map(d => (
//                     <button key={d} onClick={() => dispatch({type: "digit", digit: d})}>{d}</button>
//                 ))}
//                 <button style={opStyle("+")} onClick={() => dispatch({type: "op", op: "+"})}>+</button>
//
//                 <button style={{gridColumn: "span 2"}} onClick={() => dispatch({type: "digit", digit: "0"})}>0</button>
//                 <button onClick={() => dispatch({type: "dot"})}>.</button>
//                 <button onClick={() => dispatch({type: "eq"})}>=</button>
//             </div>
//
//             {state.error && <div style={{marginTop: 8, color: "crimson"}}>{state.error}</div>}
//         </div>
//     );
// }
import * as React from "react";

type Todo = { id: string; title: string; done: boolean };

export function Todos() {
    const [todos, setTodos] = React.useState<Todo[]>([]);
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
    todo: Todo;
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
