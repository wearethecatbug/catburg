'use client';

import {useEffect, useRef, useState} from "react";
import {Application} from "pixi.js";
import {initPixiApp} from "@/app/_components/tasks/Features/PixiScene";


export default function Page() {

    /**
     * Посмотри как работает тут стейты и эфекты
     * Вот мы сделали еррор стейт, лоадин стейт
     */
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState(true);
    const pixiApplicationRef = useRef<Application>(null);
    const pixiContainerRef = useRef<HTMLDivElement>(null);

    /**
     * Пока идет загрузка пикси тут у нас будето отображатся лоадер
     */
    useEffect(() => {
        console.log('Initializing Pixi application...');
        console.log('pixi container ref', pixiContainerRef.current);

        let pixiContainer = pixiContainerRef.current
        if (!pixiContainer) {
            return;
        }

        if (!pixiApplicationRef.current) {
            // Инициализируем пикси апп
            initPixiApp(pixiContainer).then(app => {
                pixiApplicationRef.current = app;
                setLoading(false);
            }).catch(err => {
                console.error("Failed to initialize Pixi application:", err);
                setError(err);
                setLoading(false);
            });
        }
    }, []);

    /**
     * Если еррор не NULL то мы отображаем див эррор, а контент старницы нет, можно это проверить если сделать throw new Error('test error') например в useEffect
     */
    if (error) {
        return <div>Error... {error.message}</div>;
    }

    /**
     * Демострация того как работает ПУЛЛ РЕКВЕСТ.
     */
    return (
        <div>
        {loading && (<div>Loading...</div>)}
            <div ref={pixiContainerRef}>
                {/*{JSON.stringify(parseTasksArr(tasksW))};*/}
            </div>
        </div>
    );
}