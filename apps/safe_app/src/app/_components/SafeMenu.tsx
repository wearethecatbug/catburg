'use client'

import styles from "./SafeMenu.module.css";

const menuButtons = [
    {name: 'Give Up', className: styles.giveUp},
    {name: 'New Game', className: styles.newGame},
    {name: 'Hint', className: styles.hint},
    {name: 'LOG', className: styles.log},
    ];

function ButtonsList() {
    function onButtonClick(target) {
        console.log('Button clicked', target);
    }

    function createButtons() {
        return menuButtons.map((button, index) => {
            return <ul key={index}>
                <button onClick={(target) => onButtonClick(target)} type={'button'} className={[styles.menuButton, button.className].join(' ')}>{button.name}</button>
            </ul>
        })
    }

    return <div>
        <li>
            {createButtons()}
        </li>
    </div>
}

export default function SafeMenu() {

    return (
        <div>
            <ButtonsList/>
        </div>
    );
}