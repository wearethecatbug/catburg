import {Application, Assets} from "pixi.js";
import {spriteSheetPaths} from "@/app/_components/tasks/Features/pixi/assets/manifest";
import {Scene} from "@/app/_components/tasks/Features/pixi/scene/Scene";
import {Direction} from "@/app/_components/tasks/Features/pixi/scene/Actor";
import {DOG_ANIMATION_NAME_MAP} from "@/app/_components/tasks/Features/pixi/entities/doggy/animations";
import {WORM_ANIMATION_NAME_MAP} from "@/app/_components/tasks/Features/pixi/entities/wormMonster/animations";
import {keyboardControllerSingleton} from "@/app/_components/tasks/Features/pixi/interactive/KeyboardController";
import {ActorFactory} from "@/app/_components/tasks/Features/pixi/factories/ActorFactory";

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
	const dogActor = ActorFactory.createPlayerActor({
		spritesheet: 'doggy',
		nameMap: DOG_ANIMATION_NAME_MAP,
		initialPosition: {
			x: application.renderer.width / 2,
			y: application.renderer.height - 50
		},
		direction: Direction.Right,
		alignToBottom: true,
		speed: 150,
		keyboardController: keyboardControllerSingleton,
		sceneBounds: {
			width: application.renderer.width,
			height: application.renderer.height
		},
		animationConfigs: [
			{ state: 'Idle', fps: 8, loop: true },
			{ state: 'Walk', fps: 12, loop: true },
		],
	});

	const wormActor = ActorFactory.createStaticActor({
		spritesheet: 'monsterWorm',
		nameMap: WORM_ANIMATION_NAME_MAP,
		initialPosition: {
			x: dogActor.model.position.x + 150,
			y: dogActor.model.position.y
		},
		direction: Direction.Left,
		alignToBottom: true,
	});

	if (WORM_ANIMATION_NAME_MAP.Attack) {
		wormActor.setState(WORM_ANIMATION_NAME_MAP.Attack);
	}

	scene.addActor(dogActor);
	scene.addActor(wormActor);


	application.ticker.add((t) => {
		scene.update(t.deltaMS);
	});
}
