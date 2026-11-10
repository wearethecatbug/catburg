import styles from './HeaderArrowButtons.module.css';

// TDHeaderArrowButtons component provides left and right arrow buttons for navigation
interface HeaderArrowButtonsProps {
    readonly className?: string;
    name?: 'arrowLeft' | 'arrowRight';
    onClick?: () => void;
    disabled?: boolean;
    readonly ariaLabel?: string;
}


export default function HeaderArrowButtons({className, name, onClick, disabled, ariaLabel}: HeaderArrowButtonsProps) {
    return (
        <button
            type="button"
            className={`${styles.arrowButton} ${name ? styles[name] : ''} ${className ?? ''}`}
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled}
            aria-label={ariaLabel}
        >
            <span className={styles.mascotCanvas} aria-hidden="true">
                <img
                    className={styles.mascotNormal}
                    src="/cattasks/capybara-navigation-normal.png"
                    alt=""
                    loading="eager"
                />
                <img
                    className={styles.mascotReveal}
                    src="/cattasks/capybara-navigation-reveal.png"
                    alt=""
                    loading="eager"
                />
            </span>
            <span className={styles.directionArrow} aria-hidden="true" />
        </button>
    );
}
