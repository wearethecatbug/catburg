# TimeTag

A task list application with per-task timers, deadlines, and urgency levels.

## Features

- **Task Management**: Create, edit, and delete tasks
- **Per-Task Timers**: Each task has its own timer that can be started, paused, and reset
- **Urgency Levels**: Visual indicators (Green/Yellow/Red/Overdue) based on remaining time
- **Workspace Tabs**: Organize tasks by Work, Home, or view All
- **Status Filters**: Filter by All, Active, Done, or Archived
- **Bulk Actions**: Select multiple tasks for batch operations
- **Search**: Search within current workspace
- **Sort**: Sort by date created, last updated, time remaining, or title
- **Local Storage**: Tasks persist in browser localStorage

## Keyboard Shortcuts

- `Enter` - Add task (when input focused)
- `Ctrl+K` / `Cmd+K` - Focus search
- `Ctrl+N` / `Cmd+N` - Focus add input
- `Esc` - Clear search

## Urgency Levels

Visual indicators based on **percentage of original duration remaining** (fair for tasks of any length):

- **Green** (🟢): 50%+ of time remaining
- **Yellow** (🟡): 20-50% of time remaining
- **Red** (🔴): Less than 20% of time remaining
- **Overdue** (⚫): Timer expired

*Example: For a 2-hour task, Yellow starts at 24 minutes remaining (20%). For a 10-minute task, Yellow starts at 2 minutes remaining.*

## Getting Started

**Requirements:** Node.js `>=20.9.0`

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3003](http://localhost:3003) in your browser.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS
- localStorage for persistence

## Project Structure

TimeTag follows a **layered architecture** for clear separation of concerns:

```
src/
├── app/                    # Next.js App Router entry points
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── widgets/                # Screen-level composition (header, task-list)
│   ├── header/
│   └── task-list/
├── features/               # Feature UI modules
│   ├── bulk-actions/
│   ├── list-filter/
│   ├── list-search/
│   ├── list-sort/
│   ├── status-filters/
│   ├── task-composer/
│   └── workspace-switch/
├── entities/               # Business entities (task components)
│   └── task/
├── store/                  # Global state management
│   └── task.store.tsx      # TaskProvider + reducer
├── domain/                 # Pure business logic (no React)
│   ├── task.pipeline.ts    # Filter/sort pipeline
│   ├── task.urgency.ts     # Urgency calculation
│   ├── task.types.ts       # Core types
│   ├── timer.logic.ts      # Timer state machine
│   └── timer.ring.ts       # Visual ring logic
└── shared/                 # Reusable utilities
    ├── hooks/              # Custom React hooks
    ├── icons/              # Icon components
    ├── ui/                 # UI components (Button, Dropdown, Toast, etc.)
    └── utils/              # Helper functions (id, time formatting)
```

**Key principles:**
- UI dispatches actions via `useTasks()` from `store/task.store.tsx`
- Business logic stays pure in `domain/`
- Visible tasks derived through `applyPipeline()` in `domain/task.pipeline.ts`

