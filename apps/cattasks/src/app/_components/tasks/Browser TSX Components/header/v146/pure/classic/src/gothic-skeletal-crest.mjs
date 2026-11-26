import { getGothicPaintedCrownAnchors } from './gothic-apex-skull.mjs';

/** Each god's whole canopy joins the outside cornice to the crown shoulder.
 * One uniform scale preserves its anatomy; narrowing fades the complete cast. */
export const GOTHIC_SKELETAL_CREST_ART={
 casts:{
  blue:{
   left:{file:'gothic-tzeentch-canopy-left-v132.png',size:[2172,724],crop:[39,188,2095,439],contactRects:[[396,550,99,69],[1020,550,49,69]],innerAnchor:[2100,430],innerEndRect:[1990,300,136,190],outerX:47},
   right:{file:'gothic-tzeentch-canopy-right-v132.png',size:[2172,724],crop:[13,117,2151,533],contactRects:[[1120,560,140,82],[1380,550,120,74]],innerAnchor:[80,450],innerEndRect:[21,240,210,290],outerX:2156}
  },
  green:{
   left:{file:'gothic-nurgle-tentacle-canopy-left-v131.png',size:[2172,724],crop:[25,91,2127,520],contactRects:[[450,565,175,46],[1325,560,190,51]],innerAnchor:[2090,400],innerEndRect:[1995,300,157,280],outerX:25},
   right:{file:'gothic-nurgle-tentacle-canopy-right-v131.png',size:[2172,724],crop:[21,113,2116,463],contactRects:[[1420,530,140,45]],innerAnchor:[85,400],innerEndRect:[21,285,210,275],outerX:2137}
  },
  ember:{
   left:{file:'gothic-khorne-canopy-left-v132.png',size:[2172,724],crop:[52,59,2085,618],contactRects:[[60,600,85,63],[459,605,80,72],[1335,605,75,72]],innerAnchor:[2060,430],innerEndRect:[1950,320,187,267],outerX:52},
   right:{file:'gothic-khorne-canopy-right-v132.png',size:[2172,724],crop:[12,162,2133,429],contactRects:[[426,520,70,66],[797,538,95,53],[2105,477,40,79]],innerAnchor:[95,385],innerEndRect:[12,192,250,346],outerX:2145}
  },
  violet:{
   left:{file:'gothic-slaanesh-canopy-left-v132.png',size:[2172,724],crop:[26,282,2132,330],contactRects:[[310,558,270,34],[1240,570,160,42]],innerAnchor:[2050,525],innerEndRect:[1950,400,208,180],outerX:26},
   right:{file:'gothic-slaanesh-canopy-right-v132.png',size:[2172,724],crop:[56,284,2059,405],contactRects:[[600,605,80,84],[1575,605,80,84],[2060,620,55,69]],innerAnchor:[100,520],innerEndRect:[56,410,220,240],outerX:2115}
  }
 }
};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** A complete, separately painted left or right casting spans the cornice.
 * Its source orientation is final: no reflected body or repeated extension.
 * One scale maps the native root and outer tip to their architectural seats. */
function getOrientedCanopyPose(layout,side,art){
 const d=layout.decor,c=d.catalogCrown,k=c[2]/1395,source=art.crop;
 const outside=13+d.towerW,outerX=side==='left'?outside:layout.width-outside;
 const anchor=getGothicPaintedCrownAnchors(layout)[side],sourceAnchor=art.innerAnchor;
 const scale=(anchor[0]-outerX)/(sourceAnchor[0]-art.outerX);
 const x=anchor[0]-(sourceAnchor[0]-source[0])*scale,y=anchor[1]-(sourceAnchor[1]-source[1])*scale;
 const drawRect=[x,y,source[2]*scale,source[3]*scale];
 const toWorld=r=>[x+(r[0]-source[0])*scale,y+(r[1]-source[1])*scale,r[2]*scale,r[3]*scale];
 const contactRects=art.contactRects.map(toWorld),railTop=c[1]+206*k;
 const available=Math.max(0,c[0]-8-(16+d.towerW));
 return{theme:layout.theme,source,sourceFile:art.file,sourceSize:art.size,sourceContacts:art.contactRects,applyPewter:false,
  sourceAnchor,sourceInnerEndRect:art.innerEndRect,drawRect,rect:drawRect.slice(),scale,mirrored:false,side,fullSpan:true,
  opacity:smooth((available-138)/40),anchor,contactRects,innerEndRect:toWorld(art.innerEndRect),
  support:'crown-and-cornice',supportY:anchor[1],railTop,
  contactDepth:Math.max(...contactRects.map(r=>r[1]+r[3]))-railTop,
  paintLayer:'over-cornice',span:[Math.min(outerX,anchor[0]),Math.max(outerX,anchor[0])],outside,available};
}

/** Left-hand pose, also returned at zero opacity for geometry consumers.
 * Source and world anchor points describe the same opaque inner joint. */
export function getGothicRibCanopyPose(layout,side='left'){
 if(layout.style!=='gothic'||layout.mode!=='catalog'||!layout.decor?.catalogCrown||layout.width<=622)return null;
 const d=layout.decor,c=d.catalogCrown,k=c[2]/1395;
 const casts=GOTHIC_SKELETAL_CREST_ART.casts,theme=Object.hasOwn(casts,layout.theme)?layout.theme:'green';
 if(casts[theme][side])return getOrientedCanopyPose(layout,side,casts[theme][side]);
 const art=casts[theme],crop=art.crop;
 // Retain the accepted tablet cast, then let the primary sculpture gain some
 // weight on a wider chassis. The remaining outer span receives a second
 // complete cast below, instead of magnifying one claw/tentacle to twice size.
 const wide=smooth((layout.width-1040)/560),outside=16+d.towerW+Math.max(0,layout.width-1040)/2;
 const available=Math.max(0,c[0]-8-outside);
 const railTop=c[1]+206*k,mirrored=side==='right',anchor=getGothicPaintedCrownAnchors(layout)[mirrored?'right':'left'];
 const drawAnchorX=mirrored?layout.width-anchor[0]:anchor[0];
 const sourceAnchor=art.innerAnchor,baseX=outside-3;
 const scale=(drawAnchorX-baseX)/(sourceAnchor[0]-crop[0])*(1+.18*wide);
 const x=drawAnchorX-(sourceAnchor[0]-crop[0])*scale;
 const y=anchor[1]-(sourceAnchor[1]-crop[1])*scale;
 const drawRect=[x,y,crop[2]*scale,crop[3]*scale];
 const toWorld=r=>{const rx=x+(r[0]-crop[0])*scale,rw=r[2]*scale;return[mirrored?layout.width-rx-rw:rx,y+(r[1]-crop[1])*scale,rw,r[3]*scale];};
 const contactRects=art.contactRects.map(toWorld);
 return{theme,source:crop,sourceFile:art.file,sourceSize:art.size,sourceContacts:art.contactRects,applyPewter:art.applyPewter!==false,
  sourceAnchor,sourceInnerEndRect:art.innerEndRect,drawRect,rect:mirrored?[layout.width-x-drawRect[2],y,drawRect[2],drawRect[3]]:drawRect.slice(),scale,mirrored,side,
  opacity:smooth((available-138)/40),anchor,contactRects,innerEndRect:toWorld(art.innerEndRect),
  support:'crown',supportY:anchor[1],railTop,
  contactDepth:Math.max(...contactRects.map(r=>r[1]+r[3]))-railTop,
  paintLayer:'over-cornice',span:[outside,c[0]-8],outside,available};
}

export function getGothicSkeletalPlacements(layout){
 const pose=getGothicRibCanopyPose(layout);
 if(!pose||pose.opacity<=.0001)return[];
 const main=['left','right'].map(side=>({...getGothicRibCanopyPose(layout,side),kind:'ribs',variant:0}));
 if(pose.fullSpan||layout.width<1280)return main;
 const art=GOTHIC_SKELETAL_CREST_ART.casts[pose.theme],source=art.crop;
 const x=13+layout.decor.towerW,joinX=pose.drawRect[0]+48;
 const scale=(joinX-x)/(art.innerAnchor[0]-source[0]);
 const railBottom=pose.railTop+112*layout.decor.catalogCrown[2]/1395;
 const foot=Math.max(...art.contactRects.map(r=>r[1]+r[3]));
 // The outer sculpture grips the same cornice. Its inner root passes under
 // the first hook of the primary sculpture, joining the two painted bodies.
 const y=railBottom-2-(foot-source[1])*scale;
 const drawRect=[x,y,source[2]*scale,source[3]*scale];
 const extensions=['left','right'].map(side=>{
  const mirrored=side==='right',toWorld=r=>{
   const rx=x+(r[0]-source[0])*scale,rw=r[2]*scale;
   return[mirrored?layout.width-rx-rw:rx,y+(r[1]-source[1])*scale,rw,r[3]*scale];
  };
  return{...pose,side,mirrored,kind:'outer-extension',variant:1,scale,drawRect,
   rect:mirrored?[layout.width-x-drawRect[2],y,drawRect[2],drawRect[3]]:drawRect.slice(),
   contactRects:art.contactRects.map(toWorld),innerEndRect:toWorld(art.innerEndRect),opacity:1,
   support:'cornice',supportY:railBottom,anchor:[mirrored?layout.width-joinX:joinX,y+(art.innerAnchor[1]-source[1])*scale]};
 });
 return [...extensions,...main];
}

export function renderGothicSkeletalCrest(layout,options={}){
 const placements=getGothicSkeletalPlacements(layout);
 if(!placements.length)return{defs:'',body:'',overlay:''};
 const prefix=String(options.idPrefix||'gothic-skeletal').replace(/[^\w-]/g,'-');
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,''),sources=new Map();
 for(const a of placements)if(!sources.has(a.sourceFile))sources.set(a.sourceFile,{id:`${prefix}-source-${sources.size}`,size:a.sourceSize});
 let defs=[...sources].map(([file,{id,size}])=>{
  const href=esc(options.resolveAsset?options.resolveAsset(file):base+'/'+file);
  return`<image id="${id}" href="${href}" width="${size[0]}" height="${size[1]}"/>`;
 }).join('');
 const pewter=layout.theme==='violet'&&placements.every(a=>a.applyPewter);
 if(pewter)defs+=`<filter id="${prefix}-pewter" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="0 .10 .30 .57 .81 .98 1"/><feFuncG type="table" tableValues="0 .095 .29 .56 .80 .96 .99"/><feFuncB type="table" tableValues="0 .09 .28 .55 .79 .95 .98"/><feFuncA type="identity"/></feComponentTransfer></filter>`;
 const filter=pewter?` filter="url(#${prefix}-pewter)"`:'';
 const casting=a=>{
  const r=a.drawRect,mirror=a.mirrored?` transform="translate(${layout.width} 0) scale(-1 1)"`:'';
  return`<g data-gothic-skeletal-casting="${a.side}-${a.kind}" opacity="${a.opacity}"${mirror}><svg x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" viewBox="${a.source.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><use href="#${sources.get(a.sourceFile).id}"/></svg></g>`;
 };
 const overlay=placements.map(casting).join('');
 return{defs,body:'',overlay:`<g data-gothic-rib-canopy="crown-anchored-cornice-grip"${filter}>${overlay}</g>`};
}
