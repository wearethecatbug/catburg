import React, {useState} from "react/index";
import styles from "./HintContainer.module.css";
import HintMenu from "./HintMenu";

export default function HintContainer() {

    const [iSigns, setIsSigns] = useState(false);
    const [isNewHint, setIsNewHint] = useState(false);
    const [isGiveUpHint, setGiveUpHint] = useState(false);

    function onShowSigns() {
        setIsSigns((value) => !value);
    }

    function onNewHint() {
        setIsNewHint(value => !value);
        console.log('onNewHint click');
    }

    function onGiveUpHint() {
        setGiveUpHint(value => !value);
        console.log('onGiveUpHint click');
    }
    return (
        <div>
            <HintMenu onNewHint={onNewHint} onGiveUpHint={onGiveUpHint} onShowSigns={onShowSigns} />
        </div>
    );


}

