import styles from './HeaderSearchContainer.module.css';


interface HeaderSearchContainerProps {
    readonly className?: string;
    // readonly children?: React.ReactNode;
}

export default function HeaderSearchContainer({className}: HeaderSearchContainerProps) {
    return (
        <div className={styles.searchContainer + ' ' + (className ?? '')}>
            <input
                className={styles.inputField}
                type="text"
                placeholder="Поиск..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
            />
        </div>
    )
}