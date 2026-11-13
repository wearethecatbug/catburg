'use client';

import React, {useEffect, useState} from 'react';
import actionStyles from './TextureActionButton.module.css';
import styles from './MainTaskSavedSolution.module.css';

type Props = {
    readonly taskId: string;
    readonly draft: string;
    readonly onRestore: (code: string) => void;
};

// One browser-local snapshot belongs to each stable task identity.
const storageKey = (taskId: string) => `cattasks:saved-solution:v1:${encodeURIComponent(taskId)}`;

export default function MainTaskSavedSolution({taskId, draft, onRestore}: Props) {
    const [savedCode, setSavedCode] = useState<string | null>(null);
    const [storageError, setStorageError] = useState<string | null>(null);

    useEffect(() => {
        try {
            setSavedCode(window.localStorage.getItem(storageKey(taskId)));
        } catch {
            setStorageError('Saved solutions are unavailable in this browser.');
        }
    }, [taskId]);

    const saveCurrentCode = () => {
        try {
            window.localStorage.setItem(storageKey(taskId), draft);
            setSavedCode(draft);
            setStorageError(null);
        } catch {
            setStorageError('This solution could not be saved.');
        }
    };

    const restoreCode = () => {
        if (savedCode === null || savedCode === draft) return;
        if (!window.confirm('Replace the current code in the editor?')) return;
        onRestore(savedCode);
    };

    return (
        <section className={styles.panel} aria-labelledby="savedSolutionHeading">
            <h2 id="savedSolutionHeading">Saved solution</h2>
            {savedCode === null ? (
                <p className={styles.empty}>Save your current code to keep a copy for this task.</p>
            ) : (
                <pre tabIndex={0} className={styles.code} aria-label="Saved solution code"><code>{savedCode}</code></pre>
            )}
            {storageError && <p className={styles.error} role="alert">{storageError}</p>}
            <div className={styles.actions}>
                <button type="button" className={`${actionStyles.button} ${styles.action} ${styles.save}`} data-material="wood" onClick={saveCurrentCode}>
                    <span className={actionStyles.label}>Save current code</span>
                </button>
                <button type="button" className={`${actionStyles.button} ${styles.action} ${styles.restore}`} data-material="wood" onClick={restoreCode} disabled={savedCode === null}>
                    <span className={actionStyles.label}>Restore to editor</span>
                </button>
            </div>
        </section>
    );
}
