import styles from './HeaderSearchInput.module.css';

export default function HeaderSearchInput() {
    return (
        <div className={styles.searchInput}>
            <input
                className={styles.inputField}
                type="text"
                placeholder="Поиск..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
            />
        </div>
    );
}