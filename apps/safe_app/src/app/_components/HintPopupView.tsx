import styles from './HintPopupView.module.css'




export default function HintPopupView({ onCloseHint }) {
    function onOkButtonClick() {




    }

    function onCloseButtonClick() {
        onCloseHint();
        console.log("the hint is closed");

    }

    return <>
        <div className={styles.popupContainer}>

            <button onClick={onCloseButtonClick} className={styles.closeButtonContainer}>
            </button>

            <div className={styles.hintInputContainer}>
                <div className={styles.textField}/>
                <div className={styles.equalsSymbol}>=</div>
                <input className={styles.textField} type={'text'}/>
            </div>
            <div className={styles.okButtonContainer}>
            <button onClick={onOkButtonClick}/>
            </div>
        </div>
    </>
}