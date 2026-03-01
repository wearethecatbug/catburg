# Task Store & AddTaskInput — Исправления и Обновления

Дата: 2026-02-28

## 🔴 Обнаруженные проблемы

### 1. **task.store.tsx — устаревшая структура Task**
- ❌ Использовалось поле `deadlineMode` (устарело)
- ❌ Отсутствовали поля `timerControls` и `pomodoro`
- ❌ Default timer mode был `'flexible'` (должен быть `'duration'`)
- ❌ Filter использовал неправильные ключи urgency: `green/yellow/red` вместо `normal/warn/danger`
- ❌ Filter использовал `flexible` вместо `duration`

### 2. **AddTaskInput.tsx — неправильная передача данных**
- ❌ Передавалось поле `deadlineMode` вместо `timerMode`
- ❌ Тип данных был `any` вместо `CreateTaskInput`
- ❌ Неправильный индекс preset по умолчанию (PRESETS[3] вместо PRESETS[2])

### 3. **task.types.ts — несоответствие типов**
- ❌ Поле `deadlineMode` присутствовало в Task и CreateTaskInput
- ❌ Отсутствовали `timerControls` и `pomodoro` в Task
- ❌ Неиспользуемый тип `DeadlineMode`
- ❌ Неиспользуемый интерфейс `QueryState`

### 4. **FilterDropdown.tsx — несоответствие с domain**
- ❌ URGENCY_OPTIONS использовал `green/yellow/red` вместо `normal/warn/danger`
- ❌ MODE_OPTIONS использовал `flexible` вместо `duration`
- ❌ clearAll() использовал старые ключи

## ✅ Внесенные исправления

### 1. **task.types.ts**

#### Удалено:
```typescript
// УДАЛЕНО: устаревший тип
export type DeadlineMode = 'duration' | 'deadline';

// УДАЛЕНО: неиспользуемый интерфейс
export interface QueryState { ... }
```

#### Обновлено Task:
```typescript
export interface Task {
  // ...existing fields...
  timerMode: TimerMode; // 'duration' | 'pomodoro' | 'deadline'
  
  // ДОБАВЛЕНО: настройки управления таймером
  timerControls?: {
    autoStart: boolean;
    autoPlay: boolean;
    autoReset: boolean;
    allowOverdue: boolean;
  };
  
  // ДОБАВЛЕНО: настройки Pomodoro (только для режима pomodoro)
  pomodoro?: {
    cycles: number;
    workDurationMin: number;
    shortBreakMin: number;
    longBreakMin: number;
    currentCycle?: number;
    isBreak?: boolean;
  };
  
  // УДАЛЕНО: deadlineMode: DeadlineMode;
}
```

#### Обновлено CreateTaskInput:
```typescript
export interface CreateTaskInput {
  title: string;
  workspace?: WorkspaceType;
  timerMode?: TimerMode; // ДОБАВЛЕНО
  targetAt?: string;
  durationSec?: number;
  
  timerControls?: { // ДОБАВЛЕНО
    autoStart: boolean;
    autoPlay: boolean;
    autoReset: boolean;
    allowOverdue: boolean;
  };
  
  pomodoro?: { // ДОБАВЛЕНО
    cycles: number;
    workDurationMin: number;
    shortBreakMin: number;
    longBreakMin: number;
    autoStart: boolean;
    autoPlay: boolean;
  };
  
  reminders?: { id: string; enabled: boolean }[];
  
  // УДАЛЕНО: deadlineMode?: DeadlineMode;
}
```

### 2. **task.store.tsx**

#### Обновлено createTask:
```typescript
function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();
  const durationSec = input.durationSec ?? 25 * 60;

  return {
    id: generateId(),
    title: input.title,
    workspace: input.workspace ?? 'work',
    status: 'active',
    timerMode: input.timerMode ?? 'duration', // ИСПРАВЛЕНО: было 'flexible'
    targetAt: input.targetAt,
    remainingSec: durationSec,
    originalDurationSec: durationSec,
    timerStatus: 'idle',
    
    // ДОБАВЛЕНО: timerControls с defaults
    timerControls: input.timerControls ?? {
      autoStart: false,
      autoPlay: false,
      autoReset: false,
      allowOverdue: false,
    },
    
    // ДОБАВЛЕНО: pomodoro settings (если есть)
    pomodoro: input.pomodoro,
    
    reminders: input.reminders ?? [],
    createdAt: now,
    updatedAt: now,
    
    // УДАЛЕНО: deadlineMode: input.deadlineMode ?? 'duration',
  };
}
```

#### Обновлено initialFilter:
```typescript
const initialFilter: FilterState = {
  status: 'active',
  urgency: { 
    normal: true,   // ИСПРАВЛЕНО: было green
    warn: true,     // ИСПРАВЛЕНО: было yellow
    danger: true,   // ИСПРАВЛЕНО: было red
    overdue: true 
  },
  approachingRed: { enabled: false, windowMinutes: 10 },
  mode: { 
    duration: true,  // ИСПРАВЛЕНО: было flexible
    pomodoro: true, 
    deadline: true 
  },
  hasReminders: 'any',
};
```

### 3. **AddTaskInput.tsx**

#### Обновлено handleSubmit:
```typescript
const handleSubmit = (e?: React.FormEvent) => {
  // ...validation...
  
  // ИСПРАВЛЕНО: правильный тип вместо any
  const taskData: CreateTaskInput = {
    title,
    workspace: defaultWorkspace ?? state.workspace,
    timerMode, // ДОБАВЛЕНО: передаем timerMode
    durationSec,
    timerControls: {
      autoStart: autoEnabled,
      autoPlay: playEnabled,
      autoReset: autoResetEnabled,
      allowOverdue: overdueEnabled,
    },
  };

  if (timerMode === 'pomodoro') {
    taskData.pomodoro = {
      cycles: Math.max(1, Math.floor(pomoCycles)),
      workDurationMin: Math.max(1, Math.floor(pomoWorkMin)),
      shortBreakMin: Math.max(1, Math.floor(pomoShortBreakMin)),
      longBreakMin: Math.max(1, Math.floor(pomoLongBreakMin)),
      autoStart: autoEnabled,
      autoPlay: playEnabled,
    };
  }

  addTask(taskData);
  
  // ИСПРАВЛЕНО: правильный индекс preset (PRESETS[2] вместо PRESETS[3])
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[2];
  
  // УДАЛЕНО: deadlineMode: timerMode === 'deadline' ? 'deadline' : 'duration',
};
```

### 4. **FilterDropdown.tsx**

#### Обновлено URGENCY_OPTIONS:
```typescript
const URGENCY_OPTIONS: { id: UrgencyLevel; label: string; color: string }[] = [
  { id: 'normal', label: 'Green (50%+)', color: 'bg-green-500' },        // ИСПРАВЛЕНО
  { id: 'warn', label: 'Yellow (20-50%)', color: 'bg-yellow-500' },      // ИСПРАВЛЕНО
  { id: 'danger', label: 'Red (< 20%)', color: 'bg-red-500' },           // ИСПРАВЛЕНО
  { id: 'overdue', label: 'Overdue', color: 'bg-red-700' },
];
```

#### Обновлено MODE_OPTIONS:
```typescript
const MODE_OPTIONS: { id: TimerMode; label: string }[] = [
  { id: 'duration', label: 'Duration' },   // ИСПРАВЛЕНО: было flexible
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'deadline', label: 'Deadline' },
];
```

#### Обновлено clearAll:
```typescript
const clearAll = () => {
  setFilter({
    urgency: { normal: true, warn: true, danger: true, overdue: true }, // ИСПРАВЛЕНО
    mode: { duration: true, pomodoro: true, deadline: true },           // ИСПРАВЛЕНО
    approachingRed: { enabled: false, windowMinutes: 10 },
    hasReminders: 'any',
  });
};
```

## 📊 Сводная таблица изменений

| Файл | Проблема | Исправление |
|------|----------|------------|
| `task.types.ts` | Устаревшее поле `deadlineMode` | Удалено, используется только `timerMode` |
| `task.types.ts` | Отсутствуют `timerControls` и `pomodoro` | Добавлены в Task и CreateTaskInput |
| `task.types.ts` | Неиспользуемые типы | Удалены `DeadlineMode` и `QueryState` |
| `task.store.tsx` | Default timer mode `'flexible'` | Изменено на `'duration'` |
| `task.store.tsx` | Неправильные ключи urgency | `green/yellow/red` → `normal/warn/danger` |
| `task.store.tsx` | Отсутствуют новые поля в createTask | Добавлены `timerControls` и `pomodoro` |
| `AddTaskInput.tsx` | Передавался `deadlineMode` | Теперь передается `timerMode` |
| `AddTaskInput.tsx` | Тип `any` вместо `CreateTaskInput` | Исправлено на правильный тип |
| `AddTaskInput.tsx` | Неправильный индекс preset | PRESETS[3] → PRESETS[2] |
| `FilterDropdown.tsx` | Неправильные ключи urgency | Исправлено на `normal/warn/danger` |
| `FilterDropdown.tsx` | `flexible` вместо `duration` | Исправлено на `duration` |

## ✅ Результат

- ✅ Все типы согласованы с архитектурой TimeTag
- ✅ Task правильно создается с полями `timerMode`, `timerControls`, `pomodoro`
- ✅ Filter использует правильные ключи urgency и mode
- ✅ AddTaskInput передает правильные данные с типом CreateTaskInput
- ✅ Удалены устаревшие типы и поля
- ✅ Нет ошибок компиляции TypeScript

## 🎯 Рекомендации

1. **Миграция данных:** Если в localStorage есть старые задачи с `deadlineMode`, нужно написать миграцию
2. **Тестирование:** Проверить создание задач во всех 3 режимах (duration/pomodoro/deadline)
3. **Фильтр:** Убедиться, что urgency filter работает корректно с новыми ключами
4. **Timer Controls:** Протестировать все 4 toggle-опции (Auto Start, Notifications, Auto Reset, Allow Overdue)
5. **Pomodoro:** Проверить корректность передачи всех pomodoro-полей

## 📝 Next Steps

- [ ] Написать миграцию для старых задач в localStorage
- [ ] Обновить timer.logic.ts для работы с timerControls
- [ ] Реализовать логику Pomodoro (циклы, переключение work/break)
- [ ] Добавить визуализацию Pomodoro прогресса
- [ ] Обновить task.urgency.ts для соответствия новым зонам (50%/20%)

