'use client'

import styles from "./HintMenu.module.css";

const menuButtons = [
    {name: 'Give Up Hint', className: styles.giveUpHint},
    {name: 'New Hint', className: styles.newHint},
    {name: 'Signs', className: styles.signs},
];
// type HintMenuProps = {
//     onNewHint: () => void;
//     onGiveUpHint: () => void;
//     onShowSigns: () => void;
// };

function ButtonsList({ onNewHint, onGiveUpHint, onShowSigns }) {
    function onButtonClick(event) {
        console.log('Button clicked', event.target);
        const { id } = event.target;

        switch ( id ) {

            case 'Give Up Hint':
                console.log('Give Up Hint is clicked');
                onGiveUpHint();
                break;
            case 'New Hint':
                console.log('new hint is clicked');
                onNewHint();
                break;
            case 'Signs':
                console.log('Signs is clicked');
                onShowSigns();
                break;
            default:
                console.log('Unknown button clicked');
                break;
        }
    }


    function createButtons() {
        return menuButtons.map((button, index) => {
            return <ul key={index}>
                <button id={button.name} onClick={(target) => onButtonClick(target)} type={'button'} className={[styles.menuButton, button.className].join(" ")}>{button.name}</button>
            </ul>
        })
    }

    return <div>
        <li>
            {createButtons()}
        </li>
    </div>
}

export default function HintMenu({ onNewHint, onGiveUpHint, onShowSigns}) {
    return (
        <div>
            <ButtonsList  onNewHint={onNewHint} onGiveUpHint={onGiveUpHint} onShowSigns={onShowSigns}/>

        </div>
    );

}