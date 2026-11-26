import { ASSETS } from './assets.mjs';
import { smoothstep } from './layout-utils.mjs';

export const DEITY_DECOR = {
  green: { god:'nurgle', left:'nurgle-left.png', right:'nurgle-right.png' },
  violet: { god:'slaanesh', left:'slaanesh-left.png', right:'slaanesh-right.png' },
  ember: { god:'khorne', left:'khorne-left.png', right:'khorne-right.png' },
  blue: { god:'tzeentch', left:'tzeentch-left.png', right:'tzeentch-right.png' }
};

/** One optional object anchors the title plaque. It stays above All tasks at
 * every width where its complete native silhouette can fit, so the exposed
 * metal below either plaque remains available for engraved rune clusters.
 * A slot too small for a 28px-tall object omits it; the next 3px introduce it
 * smoothly. The retained source asset has no hit area or duplicate copy.
 */
export function getDeityDecorPlacements(layout, theme='green') {
  if(layout.mode!=='catalog')return [];
  const R=layout.rects,config=DEITY_DECOR[theme]||DEITY_DECOR.green;
  const name=config.left,asset=ASSETS[name];
  if(!asset)return [];
  const b=asset.bounds,aspect=(b[2]-b[0])/(b[3]-b[1]);
  const availableHeight=Math.min(34,R.title[1]-3);
  const slot=[R.title[0]+8,R.title[1]+1-availableHeight,
    Math.max(0,R.title[2]-16),Math.max(0,availableHeight)];
  const height=Math.min(slot[3],slot[2]/aspect);
  const opacity=smoothstep((height-28)/3);
  if(opacity<=.0001)return [];
  const width=height*aspect;
  const side=R.title[0]<R.back[0]?'left':'right';
  return [{name,side,level:'upper',opacity,slot,
    rect:[slot[0]+(slot[2]-width)/2,slot[1]+slot[3]-height,width,height]}];
}

/** Engraved clusters occupy only exposed metal below the plaques. Their own
 * minimum height keeps complete marks legible; small fields fade before the
 * rail moves behind the controls. Stable side offsets avoid a mirrored row. */
export function getRunePlacements(layout, theme='green') {
  if(layout.mode!=='catalog')return [];
  const R=layout.rects;
  const [left,right]=R.title[0]<R.back[0]?[R.title,R.back]:[R.back,R.title];
  const bottom=R.beam[1]-4;
  const leftTop=left[1]+left[3]+4,rightTop=right[1]+right[3]+4;
  const leftX=left[0]+10,leftRight=Math.min(left[0]+left[2]-10,R.ventLeft[0]-8);
  const rightX=Math.max(right[0]+10,R.ventRight[0]+R.ventRight[2]+8),rightRight=right[0]+right[2]-10;
  const slots={
    left:[leftX,leftTop,leftRight-leftX,bottom-leftTop],
    right:[rightX,rightTop,rightRight-rightX,bottom-rightTop]
  };
  return Object.entries(slots).flatMap(([side,slot])=>{
    // Keep the marks at their native readable size. The real pocket reveals
    // them through a clip; resizing must not suddenly create 22px glyphs.
    const height=36;
    if(slot[2]<=30 || slot[3]<=24)return [];
    const opacity=smoothstep((slot[2]-30)/12)*smoothstep((slot[3]-24)/8);
    if(opacity<=.001)return [];
    const themePhase={green:0,violet:1,ember:2,blue:3}[theme]??0;
    return [{side,opacity,clip:slot,revealHeight:slot[3],phase:side==='left'?themePhase:themePhase+3,
      variantOffset:side==='left'?0:3,
      rect:[slot[0],slot[1]+(slot[3]-height)/2,slot[2],height]}];
  });
}
