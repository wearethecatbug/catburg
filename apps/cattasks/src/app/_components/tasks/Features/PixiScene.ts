import {AnimatedSprite, Application, Assets} from "pixi.js";
import {spriteSheetPaths} from "@/app/_components/tasks/Features/pixi/assets/manifest";

export const application = new Application();
const stage = application.stage;

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
	const doggyTextures = Assets.get('doggy');
	const idleTextures = doggyTextures?.animations['Idle'] || [];
	const doggy = new AnimatedSprite(idleTextures, true);
	stage.addChild(doggy);

	const wormTextures = Assets.get('monsterWorm');
	const wormIdleTextures = wormTextures?.animations['Attack'] || [];
	const worm = new AnimatedSprite(wormIdleTextures, true);
	stage.addChild(worm);
}



