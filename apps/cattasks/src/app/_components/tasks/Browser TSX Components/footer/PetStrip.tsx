'use client';

import {useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent} from 'react';
import styles from './PetStrip.module.css';
import {isWarhammerTheme, useCatTasksTheme} from '../taskDashboard/CatTasksTheme';
import TyranidPixiCanvas, {projectTyranidBitePosition, TYRANID_BITE_OFFSET_PX} from './TyranidPixiCanvas';
import type {TyranidAnimation} from '../../feature/pixi/petstrip/TyranidActor';

const INITIAL_DOG_POSITION = 6;
const CENTRE_FEED_POSITION = 50;
const DISTANCE_EPSILON = 0.0001;
const SLEEP_DELAY_MS = 30_000;
const EATING_DURATION_MS = 600;
const PILE_DELAY_MS = 3_000;
const PILE_VISIBLE_MS = 7_000;
const ACID_PUDDLE_VISIBLE_MS = 1_500;
const TYRANID_BITE_DELAY_MS = 320;
const TYRANID_ACID_DURATION_MS = 740;
const TYRANID_ACID_PHASE_DURATIONS = [100, 110, 150, 120, 120, 140];

type PetState = 'idle' | 'running' | 'eating' | 'acid' | 'sleeping';
type DogDirection = 'left' | 'right';

type Food = { id: number; position: number };
type Pile = { id: number; anchor: number; direction: DogDirection; offset: number };
type Acid = {id: number; position: number; phase: number};
type TyranidTravel = {from: number; startedAt: number; duration: number} | null;

function clampPosition(position: number): number {
    return Math.min(100, Math.max(0, position));
}

function getTravelDuration(from: number, to: number, trackWidth: number): number {
    const logicalDistance = Math.abs(to - from);
    if (logicalDistance <= DISTANCE_EPSILON) return 0;
    const visualDistance = (trackWidth * logicalDistance) / 100;
    return Math.max(480, Math.round(visualDistance / 0.28), Math.round(logicalDistance * 17.5));
}

export default function PetStrip() {
    const {theme} = useCatTasksTheme();
    const usesTyranid = isWarhammerTheme(theme);
    const [isReady, setIsReady] = useState(false);
    const [dogPosition, setDogPosition] = useState(INITIAL_DOG_POSITION);
    const [dogDirection, setDogDirection] = useState<DogDirection>('right');
    const [dogState, setDogState] = useState<PetState>('idle');
    const [tyranidPosition, setTyranidPosition] = useState(INITIAL_DOG_POSITION);
    const [tyranidDirection, setTyranidDirection] = useState<DogDirection>('right');
    const [tyranidState, setTyranidState] = useState<PetState>('idle');
    const [tyranidBiteTarget, setTyranidBiteTarget] = useState<number | null>(null);
    const [tyranidStateStartedAt, setTyranidStateStartedAt] = useState<number | null>(null);
    const [travelDuration, setTravelDuration] = useState(320);
    const [foods, setFoods] = useState<Food[]>([]);
    const [piles, setPiles] = useState<Pile[]>([]);
    const [acidEffects, setAcidEffects] = useState<Acid[]>([]);
    const [tyranidTravel, setTyranidTravel] = useState<TyranidTravel>(null);
    const [dogStatus, setDogStatus] = useState('Pet is waiting for food');
    const [tyranidStatus, setTyranidStatus] = useState('Pet is waiting for food');
    const trackRef = useRef<HTMLSpanElement | null>(null);
    const dogRef = useRef<HTMLSpanElement | null>(null);
    const dogPositionRef = useRef(INITIAL_DOG_POSITION);
    const dogDirectionRef = useRef<DogDirection>('right');
    const tyranidPositionRef = useRef(INITIAL_DOG_POSITION);
    const tyranidDirectionRef = useRef<DogDirection>('right');
    const tyranidBiteTargetRef = useRef<number | null>(null);
    const foodsRef = useRef<Food[]>([]);
    const activeTargetRef = useRef<Food | null>(null);
    const nextIdRef = useRef(0);
    const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
    const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const usesTyranidRef = useRef(usesTyranid);
    const activeMealUsesTyranidRef = useRef<boolean | null>(null);
    const reducedMotionRef = useRef(false);
    useLayoutEffect(() => { usesTyranidRef.current = usesTyranid; }, [usesTyranid]);

    const setProjectionState = (usesTyranidProjection: boolean, state: PetState) => {
        if (usesTyranidProjection) setTyranidState(state);
        else setDogState(state);
    };

    const setProjectionStatus = (usesTyranidProjection: boolean, nextStatus: string) => {
        if (usesTyranidProjection) setTyranidStatus(nextStatus);
        else setDogStatus(nextStatus);
    };

    const currentTyranidPosition = () => projectTyranidBitePosition(tyranidBiteTargetRef.current, tyranidDirectionRef.current, trackRef.current?.getBoundingClientRect().width ?? 0, tyranidPositionRef.current);
    const currentProjectionPosition = () => usesTyranidRef.current ? currentTyranidPosition() : dogPositionRef.current;

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

    const sleepIfQuiet = useCallback(() => {
        if (activeTargetRef.current !== null || foodsRef.current.length !== 0) return;
        setDogState('sleeping');
        setTyranidState('sleeping');
        setDogStatus('Pet is sleeping');
        setTyranidStatus('Pet is sleeping');
    }, []);

    const scheduleSleep = () => {
        cancelSleep();
        sleepTimerRef.current = setTimeout(() => {
            sleepTimerRef.current = null;
            sleepIfQuiet();
        }, SLEEP_DELAY_MS);
    };

    const chooseNearestFood = () => {
        const dogAt = currentProjectionPosition();
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
            setProjectionState(usesTyranidRef.current, 'idle');
            setProjectionStatus(usesTyranidRef.current, 'Pet is waiting for food');
            scheduleSleep();
            return;
        }

        activeTargetRef.current = target;
        const trackWidth = trackRef.current?.getBoundingClientRect().width ?? 0;
        // Capture the renderer for this meal. A later theme switch only changes
        // the next projection and never reinterprets an in-flight action.
        const mealUsesTyranid = usesTyranidRef.current;
        activeMealUsesTyranidRef.current = mealUsesTyranid;
        const departure = currentProjectionPosition();
        const biteOffset = TYRANID_BITE_OFFSET_PX / Math.max(trackWidth, 1) * 100;
        const rightDestination = target.position - biteOffset;
        const leftDestination = target.position + biteOffset;
        const direction = mealUsesTyranid
            ? Math.abs(rightDestination - departure) <= Math.abs(leftDestination - departure) ? 'right' : 'left'
            : target.position < departure ? 'left' : 'right';
        const destination = mealUsesTyranid ? (direction === 'right' ? rightDestination : leftDestination) : target.position;
        const calculatedTravelDuration = getTravelDuration(departure, destination, trackWidth);
        const travelDuration = mealUsesTyranid && calculatedTravelDuration === 0 ? 180 : calculatedTravelDuration;
        cancelSleep();
        setProjectionState(mealUsesTyranid, 'running');
        setProjectionStatus(mealUsesTyranid, 'Pet is running to food');
        if (mealUsesTyranid) {
            const startedAt = performance.now();
            tyranidDirectionRef.current = direction;
            tyranidBiteTargetRef.current = target.position;
            tyranidPositionRef.current = destination;
            setTyranidDirection(direction);
            setTyranidBiteTarget(target.position);
            setTyranidPosition(destination);
            setTyranidTravel({from: departure, startedAt, duration: travelDuration});
        } else {
            dogDirectionRef.current = direction;
            dogPositionRef.current = destination;
            setDogDirection(direction);
            setDogPosition(destination);
            setTravelDuration(travelDuration);
        }

        schedule(() => {
            if (activeTargetRef.current?.id !== target.id) return;
            setProjectionState(mealUsesTyranid, 'eating');
            if (mealUsesTyranid) setTyranidStateStartedAt(performance.now());
            setProjectionStatus(mealUsesTyranid, 'Pet is eating');
            const consumeFood = () => {
                foodsRef.current = foodsRef.current.filter((food) => food.id !== target.id);
                setFoods(foodsRef.current);
            };
            if (mealUsesTyranid) schedule(consumeFood, TYRANID_BITE_DELAY_MS);
            else consumeFood();
            schedule(() => {
                if (activeTargetRef.current?.id !== target.id) return;
                if (mealUsesTyranid) {
                    const currentWidth = trackRef.current?.getBoundingClientRect().width ?? 0;
                    const acidPosition = currentTyranidPosition() + (tyranidDirectionRef.current === 'right' ? -1 : 1) * 44 / Math.max(currentWidth, 1) * 100;
                    setProjectionState(true, 'acid');
                    setTyranidStateStartedAt(performance.now());
                    setProjectionStatus(true, 'Tyranid releases acid');
                    setTyranidTravel(null);
                    setAcidEffects((current) => [...current, {id: target.id, position: acidPosition, phase: reducedMotionRef.current ? 2 : 0}]);
                    if (!reducedMotionRef.current) {
                        let elapsed = 0;
                        TYRANID_ACID_PHASE_DURATIONS.forEach((duration, phase) => {
                            if (phase > 0) schedule(() => {
                                if (reducedMotionRef.current) return;
                                setAcidEffects((current) => current.map((acid) => acid.id === target.id ? {...acid, phase: Math.max(acid.phase, phase)} : acid));
                            }, elapsed);
                            elapsed += duration;
                        });
                    }
                    schedule(() => {
                        if (activeTargetRef.current?.id !== target.id) return;
                        setAcidEffects((current) => current.map((acid) => acid.id === target.id ? {...acid, phase: 5} : acid));
                        const settledPosition = currentTyranidPosition();
                        tyranidPositionRef.current = settledPosition;
                        tyranidBiteTargetRef.current = null;
                        setTyranidPosition(settledPosition);
                        setTyranidBiteTarget(null);
                        activeTargetRef.current = null;
                        activeMealUsesTyranidRef.current = null;
                        setProjectionState(true, 'idle');
                        setProjectionStatus(true, 'Tyranid finished eating');
                        startNextMeal();
                    }, TYRANID_ACID_DURATION_MS);
                    schedule(() => setAcidEffects((current) => current.filter((acid) => acid.id !== target.id)), TYRANID_ACID_DURATION_MS + ACID_PUDDLE_VISIBLE_MS);
                    return;
                }
                activeTargetRef.current = null;
                activeMealUsesTyranidRef.current = null;
                setProjectionState(false, 'idle');
                setProjectionStatus(false, 'Pet finished eating');
                schedule(() => {
                    const trackBounds = trackRef.current?.getBoundingClientRect();
                    const dog = dogRef.current;
                    const dogBounds = dog?.getBoundingClientRect();
                    if (!trackBounds || !dog || !dogBounds || trackBounds.width <= 0) return;
                    const directionAtBirth = dog.dataset.petDirection === 'left' ? 'left' : dogDirectionRef.current;
                    const rear = directionAtBirth === 'right' ? dogBounds.left - trackBounds.left : dogBounds.right - trackBounds.left;
                    const offset = ((dogBounds.width / 2) + 4 + 10) / trackBounds.width * 100;
                    const anchor = (rear + (directionAtBirth === 'right' ? -14 : 14)) / trackBounds.width * 100;
                    const pile = {id: target.id, anchor, direction: directionAtBirth, offset};
                    setPiles((currentPiles) => [...currentPiles, pile]);
                    setProjectionStatus(false, 'Pet left a little pile');
                    schedule(() => setPiles((currentPiles) => currentPiles.filter((currentPile) => currentPile.id !== pile.id)), PILE_VISIBLE_MS);
                }, PILE_DELAY_MS);
                startNextMeal();
            }, mealUsesTyranid ? 1_080 : EATING_DURATION_MS);
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
        setProjectionStatus(usesTyranidRef.current, 'Food appeared');
        startNextMeal();
    };

    useEffect(() => {
        setIsReady(true);
        const timers = timersRef.current;
        sleepTimerRef.current = setTimeout(() => {
            sleepTimerRef.current = null;
            sleepIfQuiet();
        }, SLEEP_DELAY_MS);
        return () => {
            if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        };
    }, [sleepIfQuiet]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => {
            reducedMotionRef.current = mediaQuery.matches;
            if (mediaQuery.matches) setAcidEffects((current) => current.map((acid) => ({...acid, phase: 5})));
        };
        sync();
        mediaQuery.addEventListener('change', sync);
        return () => mediaQuery.removeEventListener('change', sync);
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
    const activeMealIsVisible = activeMealUsesTyranidRef.current === usesTyranid;
    const visibleFoods = foods.filter((food) => activeTargetRef.current?.id !== food.id || activeMealIsVisible);
    const visibleState = usesTyranid ? tyranidState : dogState;
    const visibleStatus = usesTyranid ? tyranidStatus : dogStatus;

    return (
        <section aria-label="Pet feeding strip" className={styles.petStrip} data-pet-state={visibleState}>
            <span aria-hidden="true" className={styles.track} ref={trackRef}>
                <span className={styles.grassOne}/>
                <span className={styles.grassTwo}/>
                <span className={styles.grassThree}/>
                <span className={styles.grassFour}/>
                <span className={styles.grassFive}/>
                <span className={styles.grassSix}/>
                <span className={`${styles.dog}${usesTyranid ? ` ${styles.hiddenDogProjection}` : ''}`} data-pet={usesTyranid ? undefined : 'dog'} data-pet-direction={dogDirection} data-pet-state={dogState} data-pet-target={activeMealIsVisible ? activeTargetRef.current?.position : undefined} ref={dogRef} style={dogStyle}/>
                {visibleFoods.map((food) => usesTyranid ? <span className={styles.armoredForearm} data-pet="food" data-pet-position={food.position} data-pet-direction={activeMealIsVisible && activeTargetRef.current?.id === food.id ? tyranidDirection : undefined} key={food.id} style={{'--pet-position': `${food.position}%`} as CSSProperties}><svg aria-hidden="true" viewBox="310 160 930 720"><image height="1024" href="/cattasks/themes/shared/tyranid/armored-forearm.png" width="1536"/></svg></span> : <span className={styles.food} data-pet="food" data-pet-position={food.position} key={food.id} style={{'--pet-position': `${food.position}%`} as CSSProperties}/>)}
                {usesTyranid && acidEffects.map((acid) => <span className={styles.acid} data-pet="acid" data-pet-position={acid.position} data-pet-phase={acid.phase} key={acid.id} style={{'--pet-position': `${acid.position}%`} as CSSProperties}><svg aria-hidden="true" viewBox="0 0 512 512"><image height="1024" href="/cattasks/themes/shared/tyranid/acid.png" width="1536" x={-(acid.phase % 3) * 512} y={-Math.floor(acid.phase / 3) * 512}/></svg></span>)}
                {!usesTyranid && piles.map((pile) => (
                    <span className={styles.pile} data-pet="pile" data-pet-anchor={pile.anchor} data-pet-direction={pile.direction} data-pet-rear-offset={pile.offset} key={pile.id} style={{'--pet-position': `${pile.anchor}%`} as CSSProperties}>
                        <span className={styles.odor}/><span className={styles.fly}/>
                    </span>
                ))}
            </span>
            {usesTyranid && <TyranidPixiCanvas trackRef={trackRef} position={tyranidPosition} biteTarget={tyranidBiteTarget} direction={tyranidDirection} state={tyranidState as TyranidAnimation} stateStartedAt={tyranidStateStartedAt} travel={tyranidTravel}/>}
            <button aria-label="Feed pet" className={styles.feedButton} disabled={!isReady} onClick={handleFeedClick} type="button">Feed pet</button>
            <span className={styles.status} role="status">{visibleStatus}</span>
        </section>
    );
}
