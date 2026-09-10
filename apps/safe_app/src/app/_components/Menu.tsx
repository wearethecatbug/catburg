"use client";

import { memo } from "react";

export type ButtonConfiguration = { id: string; name: string; className: string; disabled?: boolean };
export type MenuConfiguration = { buttons: ButtonConfiguration[]; style: string };

const ButtonsList = memo(function ButtonsList({ onMenuClick, menuConfiguration, getButtonClass, disabledButtonIds }: { onMenuClick: (id: string) => void; menuConfiguration: MenuConfiguration; getButtonClass: (id: string) => string; disabledButtonIds: string[] }) {
  return <ul>{menuConfiguration.buttons.map((button) => {
    const disabled = Boolean(button.disabled) || disabledButtonIds.includes(button.id);
    return <li key={button.id}><button id={button.id} type="button" disabled={disabled} className={`${menuConfiguration.style} ${button.className} ${getButtonClass(button.id)}`} onClick={() => onMenuClick(button.id)}>{button.name}</button></li>;
  })}</ul>;
});

export default function Menu({ menuConfiguration, onMenuButtonClickAction, getButtonClass, disabledButtonIds = [] }: { menuConfiguration: MenuConfiguration; onMenuButtonClickAction: (id: string) => void; getButtonClass: (id: string) => string; disabledButtonIds?: string[] }) {
  return <nav aria-label="Safe game controls"><ButtonsList menuConfiguration={menuConfiguration} getButtonClass={getButtonClass} disabledButtonIds={disabledButtonIds} onMenuClick={onMenuButtonClickAction} /></nav>;
}
