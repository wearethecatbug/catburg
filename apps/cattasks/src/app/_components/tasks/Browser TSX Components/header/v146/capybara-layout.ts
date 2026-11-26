import {getWorkspaceCapybaraAnchors} from './pure/workspace/header-placement.mjs';

export type Rect = readonly [number, number, number, number];

type Decorations = Record<string, Rect>;
type FoxContour = readonly [number, number, number, number];

const FOX = {
    width: 1041,
    height: 1511,
    pawX: 830,
    pawY: 621,
    footY: 1490,
    contour: [
        [532, 10, 176, 90], [197, 100, 549, 100], [197, 200, 608, 100],
        [210, 300, 651, 100], [227, 400, 618, 100], [106, 500, 885, 120],
        [25, 620, 766, 180], [13, 800, 543, 300], [80, 1100, 444, 390],
    ] as readonly FoxContour[],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const onShelf = (x: number, bottom: number, width: number, ratio: number, visibleBottom = 1): Rect => [x, bottom - width * ratio * visibleBottom, width, width * ratio];
const intersects = (a: Rect, b: Rect, gap = 0) => a[0] < b[0] + b[2] + gap && a[0] + a[2] > b[0] - gap && a[1] < b[1] + b[3] + gap && a[1] + a[3] > b[1] - gap;

/** Typed port of the kit's control geometry inside the shared header envelope. */
function getControls(width: number) {
    const anchors = getWorkspaceCapybaraAnchors(width);
    const compact = anchors.compact;
    const shelfTop = anchors.baseline - (compact ? 10 : 12);
    const navGrowth = clamp((width - 834) / 606, 0, 1);
    const navWidth = compact ? 52 : 56 + 24 * navGrowth;
    const navHeight = compact ? 48 : 52 + 6 * navGrowth;
    const backWidth = compact ? anchors.back[2] : clamp(width * .18, 132, 224);
    const titleWidth = compact ? anchors.title[2] : Math.min(anchors.title[2], width - 2 * (backWidth + navWidth + 46));
    const titleHeight = Math.min(56, anchors.title[3]);
    const titleX = (width - titleWidth) / 2;
    const titleY = shelfTop - titleHeight - 5;
    const previousX = titleX - navWidth - (compact ? 8 : 12);
    const nextX = titleX + titleWidth + (compact ? 8 : 12);
    const backX = compact ? anchors.back[0] : Math.min(anchors.back[0], previousX - backWidth - 18);
    const back: Rect = [backX, compact ? anchors.back[1] + 2 : shelfTop - 48, backWidth, compact ? 40 : 48];
    const number: [number, number, number, number] = [(width - (compact ? 80 : 104)) / 2, titleY - (compact ? 23 : 27), compact ? 80 : 104, compact ? 18 : 22];
    if (compact && intersects(number, back, 4)) number[0] = Math.max(number[0], back[0] + back[2] + 6);
    return {
        ...anchors,
        shelfTop,
        shelfHeight: compact ? 10 : 12,
        inset: compact ? 4 : 10,
        back,
        title: [titleX, titleY, titleWidth, titleHeight] as Rect,
        number: number as Rect,
        previous: [previousX, shelfTop - navHeight, navWidth, navHeight] as Rect,
        next: [nextX, shelfTop - navHeight, navWidth, navHeight] as Rect,
    };
}

function getDecorations(width: number, controls: ReturnType<typeof getControls>) {
    const {compact, shelfTop, inset, back, title, number, previous, next} = controls;
    const poseScale = compact ? .245 : clamp(width * .0002, .25, .30);
    const task: Decorations = {};
    const catalog: Decorations = {};
    const foxScale = (previous[3] - 2) / (FOX.footY - FOX.pawY);
    const fox: Rect = [previous[0] + (compact ? 18 : 24) - FOX.pawX * foxScale, shelfTop + 1 - FOX.footY * foxScale, FOX.width * foxScale, FOX.height * foxScale];
    const foxClear = FOX.contour.every(([x, y, contourWidth, contourHeight]) => !intersects([fox[0] + x * foxScale, fox[1] + y * foxScale, contourWidth * foxScale, contourHeight * foxScale], back, .5));
    const foxFits = compact ? width >= 320 && fox[0] >= inset + 2 : fox[0] >= back[0] + back[2] + 12;

    if (!compact) {
        const studyWidth = Math.min(166, back[2] * .78);
        task.study = onShelf(back[0] + (back[2] - studyWidth) / 2, back[1] + 1, studyWidth, 740 / 1452, 736 / 740);
    }
    const rightStart = next[0] + next[2] + 15;
    const rightSpace = width - 22 - rightStart;
    if (!compact && rightSpace >= 125) {
        const nookWidth = Math.min(184, rightSpace * .88);
        task.nook = onShelf(rightStart + (rightSpace - nookWidth) / 2, shelfTop + 1, nookWidth, 802 / 1250, 798 / 802);
    }
    const pose: Rect = [previous[0] + previous[2] / 2 + 106 * poseScale - 280 * poseScale, previous[1] + 16 * poseScale - 216 * poseScale + 10 * poseScale, 264 * poseScale, 190 * poseScale];
    const mascot = pose[0] >= inset + 2 && pose[1] >= 0 && pose[0] + pose[2] <= width - inset - 2 && [back, title, number, task.study, task.nook].filter((box): box is Rect => Boolean(box)).every(box => !intersects(pose, box, 3));
    if (!mascot && foxFits && foxClear) task.fox = fox;

    if (compact) {
        const rabbitWidth = Math.min(82, title[0] - inset - 12);
        const samoyedWidth = Math.min(98, width - title[0] - title[2] - 14);
        if (rabbitWidth >= 42) catalog.rabbit = onShelf(inset + 4, shelfTop + 1, rabbitWidth, 165 / 310, 164 / 165);
        if (samoyedWidth >= 42) catalog.samoyed = onShelf(width - inset - samoyedWidth - 4, shelfTop + 1, samoyedWidth, 731 / 990, 730 / 731);
    } else {
        const capybaraWidth = Math.min(126, back[2] * .66);
        catalog.capybara = onShelf(back[0] + (back[2] - capybaraWidth) / 2, back[1] + 1, capybaraWidth, 495 / 704, 487 / 495);
        catalog.leaves = onShelf(catalog.capybara[0] - 18, back[1] + 2, 32, 154 / 177);
        const bayStart = title[0] + title[2] + 26;
        const bayWidth = width - 24 - bayStart;
        const samoyedWidth = Math.min(143, bayWidth * .66);
        const yarnWidth = Math.min(34, bayWidth * .18);
        const groupX = bayStart + (bayWidth - (samoyedWidth + yarnWidth - 2)) / 2;
        catalog.samoyed = onShelf(groupX, shelfTop + 1, samoyedWidth, 731 / 990, 730 / 731);
        catalog.yarn = onShelf(groupX + samoyedWidth - 2, shelfTop + 2, yarnWidth, 209 / 219, 199 / 209);
    }

    return {
        shelfTop,
        shelfHeight: controls.shelfHeight,
        inset,
        bracketWidth: Math.min(compact ? 40 : 62, Math.max(0, controls.height - shelfTop - 4) * 720 / 504),
        poseWidth: 336 * poseScale,
        poseHeight: 216 * poseScale,
        poseAnchor: 106 * poseScale,
        poseFoot: 16 * poseScale,
        foxScale,
        mascot,
        task,
        catalog,
    };
}

export function getCapybaraLayout(availableWidth: number) {
    const width = Math.round(clamp(availableWidth, 288, 1600));
    const controls = getControls(width);
    return {
        width,
        compact: controls.compact,
        height: controls.height,
        baseline: controls.baseline,
        back: controls.back,
        title: controls.title,
        number: controls.number,
        previous: controls.previous,
        next: controls.next,
        ...getDecorations(width, controls),
    };
}
