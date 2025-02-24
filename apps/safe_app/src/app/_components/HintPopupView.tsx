import styles from './HintPopupView.module.css'

export default function HintPopupView() {

    function onOkButtonClick() {

    }

    return <>
        <div className={styles.popupContainer}>
            <div className={styles.closeButtonContainer}>
                <button>[X]</button>
            </div>

            <div className={styles.hintInputContainer}>
                <div className={styles.textField}>10 + 8 = </div>
                <input className={styles.textField} type={'text'}/>
            </div>

            <button onClick={onOkButtonClick}>OK</button>
        </div>
    </>
}