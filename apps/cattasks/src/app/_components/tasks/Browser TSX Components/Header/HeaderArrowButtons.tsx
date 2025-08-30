import styles from './HeaderArrowButtons.module.css';

// TDHeaderArrowButtons component provides left and right arrow buttons for navigation
interface HeaderArrowButtonsProps {
    readonly className?: string;
    name?: 'arrowLeft' | 'arrowRight';
}

export default function HeaderArrowButtons({className, name}: HeaderArrowButtonsProps) {
    return (
        <button
            className={`${styles.arrowButton} ${name ? styles[name] : ''} ${className ?? ''}`}
        />
    );
}
