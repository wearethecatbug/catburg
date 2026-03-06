# Task Composer Components

This folder contains reusable UI components extracted from `AddTaskInput.tsx` to reduce code duplication and improve maintainability.

## Components

### Generic UI Components

#### `Dropdown.tsx`
A fully-featured dropdown menu component with keyboard support.

**Props:**
- `id` - Unique identifier for the button
- `label` - Accessible label (screen reader only)
- `icon` - Icon to display in the button
- `buttonContent` - Content to render inside the button
- `options` - Array of dropdown options with id, label, and optional icon
- `selectedId` - Currently selected option ID
- `isOpen` - Whether dropdown is open
- `onToggle` - Callback for toggling dropdown
- `onSelect` - Callback when option is selected
- `onClose` - Callback to close dropdown
- `title` - Tooltip text
- `ariaLabel` - ARIA label for the menu

**Features:**
- Click-outside detection
- Keyboard navigation (ArrowDown, Enter, Space, Escape)
- ARIA attributes
- Icon support in options

#### `TimerControlToggle.tsx`
A checkbox component with label and description.

**Props:**
- `checked` - Whether checkbox is checked
- `onChange` - Callback with new checked state
- `disabled` - Whether checkbox is disabled
- `label` - Main label text
- `description` - Helper text below label
- `ariaLabel` - Accessibility label

#### `NumberInput.tsx`
A number input field with label and optional unit display.

**Props:**
- `id` - Input ID
- `label` - Label text
- `value` - Current number value
- `onChange` - Callback with new value
- `min` - Minimum value (default: 1)
- `max` - Maximum value
- `unit` - Unit text to display below input (e.g., "min", "cycles")
- `ariaLabel` - Accessibility label

### Specialized Components

#### `ModeSelector.tsx`
Radio button group for selecting timer mode (duration/pomodoro/deadline).

**Props:**
- `timerMode` - Current mode
- `onChange` - Callback with selected mode

#### `PomodoroSettings.tsx`
Grid of number inputs for Pomodoro timer configuration.

**Props:**
- `cycles` - Number of cycles
- `workMin` - Work duration in minutes
- `shortBreakMin` - Short break duration
- `longBreakMin` - Long break duration
- `onCyclesChange` - Callback for cycles change
- `onWorkMinChange` - Callback for work duration change
- `onShortBreakMinChange` - Callback for short break change
- `onLongBreakMinChange` - Callback for long break change

#### `TimerControlsSection.tsx`
Grid of timer control toggles (Auto Start, Notifications, Auto Reset, Allow Overdue).

**Props:**
- `timerMode` - Current timer mode (affects which controls are shown)
- `autoEnabled` - Auto start toggle state
- `playEnabled` - Notifications toggle state
- `autoResetEnabled` - Auto reset toggle state
- `overdueEnabled` - Allow overdue toggle state
- `onAutoEnabledChange` - Callback for auto start change
- `onPlayEnabledChange` - Callback for notifications change
- `onAutoResetEnabledChange` - Callback for auto reset change
- `onOverdueEnabledChange` - Callback for allow overdue change

#### `DetailsPanel.tsx`
Complete details panel that composes all the above components.

**Props:** (All props from child components, passed through)

## Usage

Import components from the barrel export:

```tsx
import { 
    Dropdown, 
    TimerControlToggle, 
    NumberInput,
    ModeSelector,
    PomodoroSettings,
    TimerControlsSection,
    DetailsPanel,
    type DropdownOption 
} from './components';
```

## Design Principles

1. **Single Responsibility**: Each component does one thing well
2. **Composition**: Complex components are built from simple ones
3. **Props-based API**: All behavior controlled through props
4. **Accessibility First**: ARIA labels and keyboard support built-in
5. **Type Safety**: Full TypeScript support with strict types

## Extending

To add new form components:

1. Follow the pattern of existing components
2. Accept necessary state and callbacks as props
3. Include proper TypeScript types
4. Add accessibility attributes
5. Use consistent Tailwind styling
6. Export from `index.ts`

## Testing

Components can be tested in isolation:

```tsx
import { render, fireEvent } from '@testing-library/react';
import { TimerControlToggle } from './TimerControlToggle';

test('calls onChange when clicked', () => {
    const onChange = jest.fn();
    const { getByRole } = render(
        <TimerControlToggle
            checked={false}
            onChange={onChange}
            label="Test"
            description="Test description"
            ariaLabel="Test checkbox"
        />
    );
    
    fireEvent.click(getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
});
```

