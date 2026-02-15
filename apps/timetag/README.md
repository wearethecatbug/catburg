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

- **Green** (🟢): 15+ minutes remaining
- **Yellow** (🟡): 5-15 minutes remaining
- **Red** (🔴): Less than 5 minutes remaining
- **Overdue** (⚫): Timer expired

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3003](http://localhost:3003) in your browser.

## Tech Stack

- Next.js 15 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS
- localStorage for persistence

## Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/             # Shared UI components
│   ├── Badge.tsx
│   ├── Checkbox.tsx
│   ├── Chip.tsx
│   ├── Dropdown.tsx
│   └── Toast.tsx
├── context/                # React Context providers
│   └── TaskContext.tsx
├── features/               # Feature-based components
│   ├── composer/
│   ├── filters/
│   ├── header/
│   ├── task-list/
│   └── workspace-tabs/
├── hooks/                  # Custom React hooks
│   ├── useKeyboardShortcuts.ts
│   └── useLocalStorage.ts
├── types/                  # TypeScript types
│   └── task.ts
└── utils/                  # Utility functions
    ├── id.ts
    └── time.ts
```

