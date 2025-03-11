'use client'

import styles from "./Menu.module.css";

function ButtonsList({ onHintMenuClick, menuConfiguration }: {onHintMenuClick: (id: string) => void, menuConfiguration: MenuConfiguration}) {

    function onButtonClick(event) {
        console.log('Button clicked', event.target);
        const { id } = event.target;

        onHintMenuClick(id);
    }

    function createButtons() {
        return menuConfiguration.buttons.map((button, index) => {
            return <ul key={index}>
                <button id={button.id} onClick={(target) => onButtonClick(target)} type={'button'} className={[menuConfiguration.style, button.className].join(" ")}>{button.name}</button>
            </ul>
        })
    }

    return <div>
        <li>
            {createButtons()}
        </li>
    </div>
}

export type ButtonConfiguration = {
    id: string;
    name: string;
    className: string;
}

export type MenuConfiguration = {
    buttons : ButtonConfiguration[];
    style: string;
}

export default function Menu({ menuConfiguration, onMenuButtonClickAction }: {menuConfiguration: MenuConfiguration, onMenuButtonClickAction: (id: string) => void}) {
    return (
        <div>
            <ButtonsList onHintMenuClick={onMenuButtonClickAction} menuConfiguration={menuConfiguration}/>
        </div>
    );

}