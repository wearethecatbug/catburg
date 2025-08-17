import styles from './HeaderSearchContainer.module.css';


interface HeaderSearchContainerProps {
    readonly className?: string;
}

export default function HeaderSearchContainer({className}: HeaderSearchContainerProps) {
    return (
        <div className={`${styles.searchContainer} ${className ?? ''}`}>
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