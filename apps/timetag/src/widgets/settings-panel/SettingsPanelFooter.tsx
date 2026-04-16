interface SettingsPanelFooterProps {
  isDirty: boolean;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function SettingsPanelFooter({
  isDirty,
  onReset,
  onCancel,
  onSave,
}: SettingsPanelFooterProps) {
  return (
    <div
      className="flex items-center justify-between border-t px-8 py-4"
      style={{ borderColor: 'var(--tt-border)', background: 'var(--tt-surface)' }}
    >
      <button
        type="button"
        onClick={onReset}
        className="rounded-md px-3 py-2 text-sm transition-colors"
        style={{ color: 'var(--tt-text-muted)' }}
      >
        Reset
      </button>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            borderColor: 'var(--tt-border)',
            color: 'var(--tt-text)',
            background: 'var(--tt-surface-subtle)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty}
          className="rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed"
          style={{
            background: isDirty ? 'var(--tt-accent)' : 'var(--tt-accent-soft)',
            color: isDirty ? 'var(--tt-accent-contrast)' : 'var(--tt-text-soft)',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

