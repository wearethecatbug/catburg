'use client'

import styles from "./SafeMenu.module.css";

const menuButtons = [
    {name: 'Give Up', className: styles.giveUp},
    {name: 'New Game', className: styles.newGame},
    {name: 'Hint', className: styles.hint},
    {name: 'LOG', className: styles.log},
    ];

function ButtonsList({ onShowLogIsClicked, onNewGame, onGiveUp, onShowHint }) {
    function onButtonClick(event) {
        console.log('Button clicked', event.target);
        const { id } = event.target;

        switch ( id ) {
            case "LOG":
                console.log('log is clicked');
                onShowLogIsClicked();
                break;
            case "New Game":
                console.log('new game is clicked');
                onNewGame();
                break;
            case "Give Up":
                console.log('Give Up is clicked');
                onGiveUp();
                break;
            case "Hint":
                console.log('Hint is clicked');
                onShowHint();
                break;
            default:
                console.log('Unknown button clicked');
                break;
        }
    }


    function createButtons() {
        return menuButtons.map((button, index) => {
            return <ul key={index}>
                <button id={button.name} onClick={(target) => onButtonClick(target)} type={'button'} className={[styles.menuButton, button.className].join(' ')}>{button.name}</button>
            </ul>
        })
    }

    return <div>
        <li>
            {createButtons()}
        </li>
    </div>
}

export default function SafeMenu({onShowLogIsClicked, onNewGame, onGiveUp, onShowHint}) {
    return (
        <div>
            <ButtonsList onShowLogIsClicked={onShowLogIsClicked} onNewGame={onNewGame} onGiveUp={onGiveUp} onShowHint={onShowHint}/>
        </div>
    );

}