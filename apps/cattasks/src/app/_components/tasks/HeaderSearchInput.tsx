import styles from './HeaderSearchInput.module.css';

interface HeaderSearchInputProps {
    readonly className?: string;
}

export default function HeaderSearchInput({className}: HeaderSearchInputProps) {
    return (
        <div className={`${styles.searchInput} ${className ?? ''}`}>
            <input
                className={styles.inputField}
                type="text"
                placeholder="Search..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
            />
        </div>
    );
}