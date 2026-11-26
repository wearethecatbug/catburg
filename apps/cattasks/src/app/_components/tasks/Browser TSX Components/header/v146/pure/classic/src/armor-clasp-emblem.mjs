import { CLASSIC_ASSETS } from './assets.mjs';

// Reuse the kit's existing sculpted deity insignia from its Gothic friezes.
// These are source-image crops, not replacement font glyphs or new drawings.
// Tzeentch already has its insignia painted into the Armor clasp and is left
// completely untouched. The other three crops retain their native bronze or
// silver highlights and wear; the old red enamel is removed only at render time.
export const ARMOR_CLASP_EMBLEMS=Object.freeze({
 ember:{god:'khorne',file:'atlas-gothic-ember.png',source:[551,982,106,107],atlasFace:[580,1009,92,81]},
 green:{god:'nurgle',file:'atlas-gothic-green.png',source:[541,977,119,111],atlasFace:[580,1009,94,81]},
 violet:{god:'slaanesh',file:'atlas-gothic-violet.png',source:[542,970,112,125],atlasFace:[581,1008,94,82]}
});
const THEMES={khorne:'ember',nurgle:'green',slaanesh:'violet',tzeentch:'blue',ember:'ember',green:'green',violet:'violet',blue:'blue'};
const REGISTERED_FACES={
 task:{ember:[1059,644,66,51],green:[1059,644,66,51],violet:[1059,644,66,51]},
 catalog:{ember:[1062,597,64,59],green:[1065,599,62,56],violet:[1054,599,67,56]}
};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=value=>Number(Number(value).toFixed(5));
const valid=rect=>Array.isArray(rect)&&rect.length===4&&rect.every(Number.isFinite)&&rect[2]>0&&rect[3]>0;
function project(value,source,destination){
 for(let i=0;i<source.length-1;i++)if(value<=source[i+1])return destination[i]+(value-source[i])/(source[i+1]-source[i])*(destination[i+1]-destination[i]);
 return destination.at(-1)+(value-source.at(-1));
}

/** Return the existing clear center of a clasp, without moving its painting.
 * The modular renderer passes its unchanged atlas-part destination; registered
 * compact artwork maps its own source face through the same source slices. */
export function getArmorClaspEmblemGeometry(layout,claspRect){
 const theme=THEMES[layout.theme]||layout.theme,art=ARMOR_CLASP_EMBLEMS[theme];
 if(layout.style!=='armor'||!art)return null;
 let face;
 if(valid(claspRect)){
  const sourcePlate=CLASSIC_ASSETS.armor[theme].parts.clasp;
  const scale=Math.min(claspRect[2]/sourcePlate[2],claspRect[3]/sourcePlate[3]);
  const x=claspRect[0]+(claspRect[2]-sourcePlate[2]*scale)/2;
  const y=claspRect[1]+(claspRect[3]-sourcePlate[3]*scale)/2;
  face=[x+(art.atlasFace[0]-sourcePlate[0])*scale,y+(art.atlasFace[1]-sourcePlate[1])*scale,art.atlasFace[2]*scale,art.atlasFace[3]*scale];
 }else if(layout.registeredArt){
  const a=layout.registeredArt,s=REGISTERED_FACES[layout.mode]?.[theme];
  if(!s)return null;
  const x1=project(s[0],a.xSource,a.xDestination),x2=project(s[0]+s[2],a.xSource,a.xDestination);
  const y1=project(s[1],a.ySource,a.yDestination),y2=project(s[1]+s[3],a.ySource,a.yDestination);
  face=[x1,y1,x2-x1,y2-y1];
 }
 if(!valid(face))return null;
 const scale=Math.min(face[2]/art.source[2],face[3]/art.source[3]);
 const width=art.source[2]*scale,height=art.source[3]*scale;
 return{theme,god:art.god,file:art.file,source:art.source.slice(),face,
  rect:[face[0]+(face[2]-width)/2,face[1]+(face[3]-height)/2,width,height]};
}

/** The alpha key removes the source frieze's dark red enamel, including the
 * spaces inside rings/loops. Native metal color and bevels remain unchanged;
 * a proportional contact shadow seats the cast insignia on the Armor plate.
 * No backing rectangle, glow, live control, or additional clasp is emitted. */
export function renderArmorClaspEmblem(layout,options={}){
 const geometry=getArmorClaspEmblemGeometry(layout,options.claspRect);
 if(!geometry)return{defs:'',body:'',geometry:null};
 const prefix=String(options.idPrefix||'armor-clasp').replace(/[^\w-]/g,'-');
 const imageId=prefix+'-source',filterId=prefix+'-cast-metal',sourceClip=prefix+'-source-regions';
 const base=String(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const href=options.resolveAsset?options.resolveAsset(geometry.file):base+'/'+geometry.file;
 const r=geometry.rect,blur=n(r[3]*.008),drop=n(r[3]*.016);
 const alphaKey=geometry.theme==='ember'
  ? `<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 5 0 0 -.75" result="metal"/>`
  : `<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 5 0 0 -.75" result="candidate"/>`+
    `<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -6 10 0 0 -.25" result="metal-seed"/>`+
    `<feComponentTransfer in="metal-seed" result="selected"><feFuncA type="discrete" tableValues="0 0 0 1 1"/></feComponentTransfer>`+
    `<feMorphology in="selected" operator="dilate" radius="${n(r[3]/geometry.source[3]*2.2)}" result="metal-silhouette"/>`+
    `<feComposite in="candidate" in2="metal-silhouette" operator="in" result="metal"/>`;
 // Generous source windows around the three original Nurgle rings exclude a
 // separate bright crack in the frieze's enamel. They do not draw or trace the
 // rings: the original photographed/cast rims and their shadows remain inside.
 const sourceRegions=geometry.theme==='green'?`<clipPath id="${sourceClip}" clipPathUnits="userSpaceOnUse"><circle cx="600" cy="1007" r="31"/><circle cx="572" cy="1054" r="31"/><circle cx="630" cy="1054" r="31"/></clipPath>`:'';
 const defs=`<image id="${imageId}" href="${esc(href)}" width="1254" height="1254"/>`+sourceRegions+
  `<filter id="${filterId}" x="-8%" y="-8%" width="116%" height="120%" color-interpolation-filters="sRGB">`+
  alphaKey+
  `<feGaussianBlur in="metal" stdDeviation="${blur}" result="soft"/><feOffset in="soft" dx="0" dy="${drop}" result="offset"/>`+
  `<feFlood flood-color="#100b08" flood-opacity=".78"/><feComposite operator="in" in2="offset" result="contact"/>`+
  `<feMerge><feMergeNode in="contact"/><feMergeNode in="metal"/></feMerge></filter>`;
 const crop=`<svg x="${n(r[0])}" y="${n(r[1])}" width="${n(r[2])}" height="${n(r[3])}" viewBox="${geometry.source.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><use href="#${imageId}"${sourceRegions?` clip-path="url(#${sourceClip})"`:''}/></svg>`;
 const body=`<g data-armor-clasp-emblem="${geometry.god}" data-emblem-material="${geometry.theme==='violet'?'silver':'brass'}" opacity=".94" filter="url(#${filterId})">${crop}</g>`;
 return{defs,body,geometry};
}
