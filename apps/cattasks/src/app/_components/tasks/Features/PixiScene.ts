import {Application, Assets, Spritesheet} from "pixi.js";
import {spriteSheetPaths} from "@/app/_components/tasks/Features/pixi/assets/manifest";
import {Scene} from "@/app/_components/tasks/Features/pixi/scene/Scene";
import {Actor, Direction} from "@/app/_components/tasks/Features/pixi/scene/Actor";
import {DOG_ANIMATION_NAME_MAP} from "@/app/_components/tasks/Features/pixi/entities/doggy/animations";
import {WORM_ANIMATION_NAME_MAP} from "@/app/_components/tasks/Features/pixi/entities/wormMonster/animations";
import {keyboardControllerSingleton} from "@/app/_components/tasks/Features/pixi/interactive/KeyboardController";

export const application = new Application();
const stage = application.stage;

let scene: Scene = new Scene(stage);

export async function initPixiApp(canvasReference?: HTMLDivElement) {
	if (!canvasReference) {
		throw new Error('Canvas reference is null or undefined.');
	}

	// Инициализация приложения PixiJS патом загружаем ассеты и т.д
	await application.init({autoStart: false, backgroundAlpha: 0, clearBeforeRender: true});
	canvasReference.appendChild(application.canvas);
	application.resizeTo = window;
	application.start();

	await loadAssets();

	buildScene();

	return application;
}

export function disposePixiApp() {
	// stop scene ticker listener first
	scene.destroy();
	application.stop();
	application.stage.removeChildren();
	application.ticker.stop();
	application.renderer.destroy();
	application.canvas.remove();
	application.destroy(true, {children: true});
}

async function loadAssets() {
	Assets.addBundle('default',{
		'doggy': spriteSheetPaths.doggy,
		'monsterWorm': spriteSheetPaths.monsterWorm,
	});

	await Assets.loadBundle('default', (progress) => {
		console.log(`Assets loading progress: ${Math.round(progress * 100)}%`);
	});
}

function buildScene() {
	const doggySheet = Assets.get<Spritesheet>('doggy');
	const wormSheet = Assets.get<Spritesheet>('monsterWorm');

	const dogActor = new Actor({
		asset: doggySheet!,
		animations: doggySheet?.animations || {},
		nameMap: DOG_ANIMATION_NAME_MAP,
		initialState: 'Idle',
		alignToBottom: true,
		direction: Direction.Right,
	});

	const wormActor = new Actor({
		asset: wormSheet!,
		animations: wormSheet?.animations || {},
		nameMap: WORM_ANIMATION_NAME_MAP,
		initialState: 'Idle',
		alignToBottom: true,
		direction: Direction.Left,
	});

	scene.addActor(dogActor);
	scene.addActor(wormActor);

	// initial positioning
	dogActor.centerInScene(application.renderer.width, application.renderer.height);
	wormActor.setPosition(dogActor.view.x + 150, dogActor.view.y);

	// start scene loop via ticker
	application.ticker.add((t) => {
		if (keyboardControllerSingleton.getPressedKeys().length)
			console.log(keyboardControllerSingleton.getPressedKeys());
		scene.update(t.deltaMS);

		if (keyboardControllerSingleton.isKeyPressed('ArrowLeft')) {
			dogActor.setDirection(Direction.Left);
		} else if (keyboardControllerSingleton.isKeyPressed('ArrowRight')) {
			dogActor.setDirection(Direction.Right);
		}
	});
}
