import styles from './AnswerInput.module.css';

export default function AnswerInputBox() {

    function onOkButtonClick() {

    }

    return <>
        <div className={styles.AnswerInputContainer} >
            <input className={styles.AnswerInput} type="text" id="fname" name="fname"/>
            <button className={styles.AnswerInputButton}  onClick={onOkButtonClick}>OK</button>
        </div>
    </>
}