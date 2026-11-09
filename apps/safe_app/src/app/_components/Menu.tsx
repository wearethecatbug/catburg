"use client";

import type { SafeState } from "@/components/safe/SafeContainerReducer";
import { memo } from "react";

const ButtonsList = memo(function ButtonsList({
  onHintMenuClick,
  menuConfiguration,
  getButtonClass,
}: {
  onHintMenuClick: (id: string) => void;
  menuConfiguration: MenuConfiguration;
  getButtonClass: (id: string) => string;
}) {
  //Обработчик нажатия на кнопку
  function onButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    const { id } = event.currentTarget;
    onHintMenuClick(id);
  }

  // Генерация кнопок на основе конфигурации
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

  // Обёртка над списком кнопок
  return <div>{createButtons()}</div>;
});

export type ButtonConfiguration = {
  id: string;
  name: string;
  className: string;
};

export type MenuConfiguration = {
  buttons: ButtonConfiguration[];
  style: string;
};

// Основной компонент Menu
export default function Menu({
  menuConfiguration,
  onMenuButtonClickAction,
  state,
  getButtonClass,
}: {
  menuConfiguration: MenuConfiguration;
  onMenuButtonClickAction: (id: string) => void;
  state?: SafeState;
  getButtonClass: (id: string) => string;
}) {
  return (
    <div>
      <ButtonsList
        getButtonClass={getButtonClass}
        onHintMenuClick={onMenuButtonClickAction}
        menuConfiguration={menuConfiguration}
      />
    </div>
  );
}
