import styles from './HeaderArrowButtons.module.css';

// TDHeaderArrowButtons component provides left and right arrow buttons for navigation
interface HeaderArrowButtonsProps {
    readonly className?: string;
    name?: 'arrowLeft' | 'arrowRight';
    readonly onClick?: React.MouseEventHandler<HTMLButtonElement>;
    readonly ariaLabel?: string;
}

export default function HeaderArrowButtons({className, name, onClick, ariaLabel}: HeaderArrowButtonsProps) {

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel ?? name}
            className={`${styles.arrowButton} ${name ? styles[name] : ''} ${className ?? ''}`}
        />
    );
}
