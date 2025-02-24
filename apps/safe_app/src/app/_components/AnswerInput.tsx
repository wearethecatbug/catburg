import styles from './AnswerInput.module.css';

export default function AnswerInputBox() {

    function onOkButtonClick() {

    }

    return <>
        <div>
            <input type="text" id="fname" name="fname"/>
            <button onClick={onOkButtonClick}>OK</button>
        </div>
    </>
}