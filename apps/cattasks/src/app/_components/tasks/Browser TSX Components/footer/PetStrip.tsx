'use client';

import {useEffect, useRef, useState, type CSSProperties, type MouseEvent} from 'react';
import styles from './PetStrip.module.css';

const INITIAL_DOG_POSITION = 6;
const CENTRE_FEED_POSITION = 50;
const DISTANCE_EPSILON = 0.0001;
const SLEEP_DELAY_MS = 30_000;
const EATING_DURATION_MS = 600;
const PILE_DELAY_MS = 3_000;
const PILE_VISIBLE_MS = 7_000;

type PetState = 'idle' | 'running' | 'eating' | 'sleeping';
type DogDirection = 'left' | 'right';

type Food = { id: number; position: number };
type Pile = { id: number; position: number };

function clampPosition(position: number): number {
    return Math.min(100, Math.max(0, position));
}

function getTravelDuration(from: number, to: number): number {
    return Math.min(1_100, Math.max(320, Math.round(Math.abs(to - from) * 14)));
}

export default function PetStrip() {
    const [isReady, setIsReady] = useState(false);
    const [petState, setPetState] = useState<PetState>('idle');
    const [dogPosition, setDogPosition] = useState(INITIAL_DOG_POSITION);
    const [dogDirection, setDogDirection] = useState<DogDirection>('right');
    const [travelDuration, setTravelDuration] = useState(320);
    const [foods, setFoods] = useState<Food[]>([]);
    const [piles, setPiles] = useState<Pile[]>([]);
    const [status, setStatus] = useState('Pet is waiting for food');
    const trackRef = useRef<HTMLSpanElement | null>(null);
    const dogPositionRef = useRef(INITIAL_DOG_POSITION);
    const foodsRef = useRef<Food[]>([]);
    const activeTargetRef = useRef<Food | null>(null);
    const nextIdRef = useRef(0);
    const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
    const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const schedule = (callback: () => void, delay: number) => {
        const timer = setTimeout(() => {
            timersRef.current.delete(timer);
            callback();
        }, delay);
        timersRef.current.add(timer);
    };

    const cancelSleep = () => {
        if (sleepTimerRef.current) {
            clearTimeout(sleepTimerRef.current);
            sleepTimerRef.current = null;
        }
    };

    const scheduleSleep = () => {
        cancelSleep();
        sleepTimerRef.current = setTimeout(() => {
            sleepTimerRef.current = null;
            if (activeTargetRef.current === null && foodsRef.current.length === 0) {
                setPetState('sleeping');
                setStatus('Pet is sleeping');
            }
        }, SLEEP_DELAY_MS);
    };

    const chooseNearestFood = () => {
        const dogAt = dogPositionRef.current;
        return foodsRef.current.reduce<Food | null>((nearest, food) => {
            if (nearest === null) return food;
            const distance = Math.abs(food.position - dogAt);
            const nearestDistance = Math.abs(nearest.position - dogAt);
            return distance < nearestDistance - DISTANCE_EPSILON ? food : nearest;
        }, null);
    };

    const startNextMeal = () => {
        if (activeTargetRef.current !== null) return;
        const target = chooseNearestFood();
        if (target === null) {
            setPetState('idle');
            setStatus('Pet is waiting for food');
            scheduleSleep();
            return;
        }

        activeTargetRef.current = target;
        const travelDuration = getTravelDuration(dogPositionRef.current, target.position);
        cancelSleep();
        setDogDirection(target.position < dogPositionRef.current ? 'left' : 'right');
        setTravelDuration(travelDuration);
        setPetState('running');
        setStatus('Pet is running to food');
        dogPositionRef.current = target.position;
        setDogPosition(target.position);

        schedule(() => {
            if (activeTargetRef.current?.id !== target.id) return;
            foodsRef.current = foodsRef.current.filter((food) => food.id !== target.id);
            setFoods(foodsRef.current);
            setPetState('eating');
            setStatus('Pet is eating');
            schedule(() => {
                if (activeTargetRef.current?.id !== target.id) return;
                activeTargetRef.current = null;
                setPetState('idle');
                setStatus('Pet finished eating');
                schedule(() => {
                    const pile = {id: target.id, position: target.position};
                    setPiles((currentPiles) => [...currentPiles, pile]);
                    setStatus('Pet left a little pile');
                    schedule(() => setPiles((currentPiles) => currentPiles.filter((currentPile) => currentPile.id !== pile.id)), PILE_VISIBLE_MS);
                }, PILE_DELAY_MS);
                startNextMeal();
            }, EATING_DURATION_MS);
        }, travelDuration);
    };

    const feedAt = (requestedPosition: number) => {
        cancelSleep();
        const food = {
            id: ++nextIdRef.current,
            position: clampPosition(requestedPosition),
        };
        foodsRef.current = [...foodsRef.current, food];
        setFoods(foodsRef.current);
        setStatus('Food appeared');
        startNextMeal();
    };

    useEffect(() => {
        setIsReady(true);
        const timers = timersRef.current;
        sleepTimerRef.current = setTimeout(() => {
            sleepTimerRef.current = null;
            if (activeTargetRef.current === null && foodsRef.current.length === 0) {
                setPetState('sleeping');
                setStatus('Pet is sleeping');
            }
        }, SLEEP_DELAY_MS);
        return () => {
            if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        };
    }, []);

    const handleFeedClick = (event: MouseEvent<HTMLButtonElement>) => {
        if (event.detail === 0) {
            feedAt(CENTRE_FEED_POSITION);
            return;
        }

        if (event.button !== 0) return;
        const trackBounds = trackRef.current?.getBoundingClientRect();
        if (!trackBounds || trackBounds.width <= 0) return;
        feedAt(((event.clientX - trackBounds.left) / trackBounds.width) * 100);
    };

    const dogStyle = {
        '--pet-position': `${dogPosition}%`,
        '--pet-travel-duration': `${travelDuration}ms`,
    } as CSSProperties;

    return (
        <section aria-label="Pet feeding strip" className={styles.petStrip} data-pet-state={petState}>
            <span aria-hidden="true" className={styles.track} ref={trackRef}>
                <span className={styles.dog} data-pet="dog" data-pet-direction={dogDirection} data-pet-state={petState} data-pet-target={activeTargetRef.current?.position} style={dogStyle}/>
                {foods.map((food) => <span className={styles.food} data-pet="food" data-pet-position={food.position} key={food.id} style={{'--pet-position': `${food.position}%`} as CSSProperties}/>)}
                {piles.map((pile) => (
                    <span className={styles.pile} data-pet="pile" data-pet-position={pile.position} key={pile.id} style={{'--pet-position': `${pile.position}%`} as CSSProperties}>
                        <span className={styles.odor}/><span className={styles.fly}/>
                    </span>
                ))}
            </span>
            <button aria-label="Feed pet" className={styles.feedButton} disabled={!isReady} onClick={handleFeedClick} type="button">Feed pet</button>
            <span className={styles.status} role="status">{status}</span>
        </section>
    );
}
