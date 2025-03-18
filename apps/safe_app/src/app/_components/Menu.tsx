'use client'

import styles from "./Menu.module.css";
import { SafeState, SafeAction  } from "@/app/_components/SafeContainer";
import {memo} from "react";



const ButtonsList = memo(function ButtonsList({ onHintMenuClick, menuConfiguration, getButtonClass }: {onHintMenuClick: (id: string) => void, menuConfiguration: MenuConfiguration, getButtonClass: (id: string) => string}) {
    function onButtonClick(event) {
        const { id } = event.currentTarget;
        onHintMenuClick(id);
    }

    function createButtons() {
        return (
            <ul>
                {menuConfiguration.buttons.map((button) => (
                    <li key={button.id}>
                        <button
                           id={button.id}
                            onClick={onButtonClick}
                            type="button"
                            className={`${menuConfiguration.style} ${button.className} ${getButtonClass(button.id)}`}
                        >
                            {button.name}
                        </button>
                    </li>
                ))}
            </ul>
        );
    }

    return <div>{createButtons()}</div>;
});

export type ButtonConfiguration = {
    id: string;
    name: string;
    className: string;
}

export type MenuConfiguration = {
    buttons : ButtonConfiguration[];
    style: string;
}

export default function Menu({ menuConfiguration, onMenuButtonClickAction,   state , getButtonClass }: {menuConfiguration: MenuConfiguration, onMenuButtonClickAction: (id: string) => void,  state: SafeState,  getButtonClass: (id: string) => string}) {
    return (
        <div>
            <ButtonsList getButtonClass={getButtonClass} onHintMenuClick={onMenuButtonClickAction} menuConfiguration={menuConfiguration} />
        </div>
    );

}