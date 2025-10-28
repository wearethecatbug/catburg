import styles from './HeaderArrowButtons.module.css';

// TDHeaderArrowButtons component provides left and right arrow buttons for navigation
interface HeaderArrowButtonsProps {
    readonly className?: string;
    name?: 'arrowLeft' | 'arrowRight';
    onClick?: () => void;
    disabled?: boolean;
    readonly ariaLabel?: string;
}


export default function HeaderArrowButtons({className, name, onClick, disabled}: HeaderArrowButtonsProps) {
    return (
        <button
            type="button"
            className={`${styles.arrowButton} ${name ? styles[name] : ''} ${className ?? ''}`}
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled}
        />
    );
}