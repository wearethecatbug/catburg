import styles from "./SignsMenuButtons.module.css";
import React, {createContext, useContext, useCallback, useEffect, useState, type ReactNode} from "react";
import Menu, {MenuConfiguration} from "@/components/Menu";
import SafeSettings from "./SettingButtonView";


enum HintSignsButtons {
    Signs_Plus = 'signsPlus',
    Signs_Minus = 'signsMinus',
    Signs_Multiple = 'signsMultiple',
    Signs_Devision = 'signsDevision',
}

export const signsButtons: MenuConfiguration = {
    buttons: [
        {id: HintSignsButtons.Signs_Plus, name: '+', className: styles.buttonPlus},
        {id: HintSignsButtons.Signs_Minus, name: '-', className: styles.buttonMinus},
        {id: HintSignsButtons.Signs_Multiple, name: '*', className: styles.buttonMultiple},
        {id: HintSignsButtons.Signs_Devision, name: '÷', className: styles.buttonDevision},
    ],
    style: styles.signsMenuButton
};

type SignsContextType = {
    activeSign: string | null;
    setActiveSign: React.Dispatch<React.SetStateAction<string | null>>;
};

// Создаем контекст для передачи состояния активного знака 
const SignsContext = createContext<SignsContextType | undefined>(undefined);

export function SignsProvider({children}: { children: ReactNode }) {
    const [activeSign, setActiveSign] = useState<string | null>(null);

    return (
        <SignsContext.Provider value={{activeSign, setActiveSign}}>
            {children}
        </SignsContext.Provider>
    );
}

// Хук для удобного использования контекста
export function useSigns() {
    const context = useContext(SignsContext);
    if (!context) {
        throw new Error("useSigns must be used within a SignsProvider");
    }
    return context;
}

export default function SignsPopUpView({
                                           getButtonClass,
                                           isSignsVisible
                                       }: { getButtonClass: (buttonId: string) => string, isSignsVisible: boolean }) {

    const {activeSign, setActiveSign} = useSigns();


    const signHandlers = {
        [HintSignsButtons.Signs_Plus]: onSignPlus,
        [HintSignsButtons.Signs_Minus]: onSignMinus,
        [HintSignsButtons.Signs_Multiple]: onSignMultiple,
        [HintSignsButtons.Signs_Devision]: onSignDevision,
    };

    function onSignPlus() {

        console.log("Нажата кнопка +");
    }

    function onSignMinus() {
        console.log("Нажата кнопка -");
    }

    function onSignMultiple() {
        console.log("Нажата кнопка *");
    }

    function onSignDevision() {
        console.log("Нажата кнопка ÷");
    }


    function getSignsButtonClass(buttonId: string) {
        const button = signsButtons.buttons.find(btn => btn.id === buttonId);
        if (!button) return ""; // Если кнопка не найдена, возвращаем пустую строку

        return `${getButtonClass(buttonId)} 
            ${isSignsVisible ? '' : styles.hiddenSigns} 
            ${activeSign === button.name ? styles.activeButtonSign : ''}`.trim();
    }

// Обработчик клика по кнопке SignsMenu
    const onSignsMenuClick = useCallback((id: string) => {
        const button = signsButtons.buttons.find(btn => btn.id === id);
        if (!button) return;

        setActiveSign(prev => (prev === button.name ? null : button.name)); // ⬅️ Сбрасываем при повторном клике
        signHandlers[id as HintSignsButtons]?.();
    }, [signHandlers]);


    useEffect(() => {
        console.log("useEffect activeSign:", activeSign);
    }, [activeSign]);


    return (
        <>
            <div className={`${styles.signsContainer} ${isSignsVisible ? "" : styles.hiddenSigns}`}>
                <Menu menuConfiguration={signsButtons} onMenuButtonClickAction={onSignsMenuClick}
                      getButtonClass={getSignsButtonClass}/>
            </div>

        </>
    )
}
