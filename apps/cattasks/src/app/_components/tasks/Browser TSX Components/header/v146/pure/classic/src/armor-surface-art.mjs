/** Shared native armor materials for the task dock and wide catalogue bays. */
export const ARMOR_SIDE_CHASSIS=Object.freeze({
 ember:{file:'armor-side-chassis-ember-v122.png',size:[2172,724],crop:[38,180,2097,402],focalX:910},
 green:{file:'armor-side-chassis-green-v122.png',size:[2172,724],crop:[30,180,2113,404],focalX:960},
 violet:{file:'armor-side-chassis-violet-v135.png',size:[2172,724],crop:[29,188,2122,396],focalX:900},
 blue:{file:'armor-side-chassis-blue-v122.png',size:[2172,724],crop:[8,167,2157,390],focalX:880}
});

// Preserve deep dents while allowing the rubbed creases to read as metal.
// The middle and upper stops become less saturated as more steel is exposed.
export const ARMOR_DOCK_TONES=Object.freeze({
 ember:{r:'.018 .075 .22 .45 .76',g:'.016 .065 .20 .41 .70',b:'.014 .055 .17 .35 .61'},
 blue:{r:'.012 .045 .16 .42 .72',g:'.018 .080 .21 .48 .77',b:'.035 .18 .34 .62 .87'},
 green:{r:'.018 .09 .22 .47 .74',g:'.025 .13 .28 .53 .76',b:'.014 .055 .16 .36 .61'},
 violet:{r:'.022 .11 .30 .62 .86',g:'.014 .065 .20 .51 .80',b:'.030 .13 .33 .65 .88'}
});

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Uniform material scale makes the short folds visible in narrow button
 * margins. Reflected neighbouring tiles share their actual edge pixels. */
export function renderArmorDockSurface(box,theme,options={}){
 const tone=ARMOR_DOCK_TONES[theme];
 if(!tone||box[2]<=0||box[3]<=0)return {defs:'',body:''};
 const prefix=String(options.idPrefix||'armor-dock').replace(/[^\w-]/g,'-');
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const href=file=>esc(options.resolveAsset?options.resolveAsset(file):base+'/'+file);
 const [x,y,w,h]=box,size=1254*.24,repeat=size*2;
 const toneId=prefix+'-tone',source=prefix+'-source',material=prefix+'-material',shade=prefix+'-shade';
 const enamel=options.enamelPattern||prefix+'-enamel';
 let defs=`<filter id="${toneId}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="table" tableValues="${tone.r}"/><feFuncG type="table" tableValues="${tone.g}"/><feFuncB type="table" tableValues="${tone.b}"/></feComponentTransfer></filter><image id="${source}" href="${href('armor-dock-texture-v135.png')}" width="${size}" height="${size}" filter="url(#${toneId})"/><pattern id="${material}" patternUnits="userSpaceOnUse" x="${x}" y="${y-32}" width="${repeat}" height="${repeat}" viewBox="0 0 ${repeat} ${repeat}"><use href="#${source}"/><use href="#${source}" transform="translate(${repeat} 0) scale(-1 1)"/><use href="#${source}" transform="translate(0 ${repeat}) scale(1 -1)"/><use href="#${source}" transform="translate(${repeat} ${repeat}) scale(-1 -1)"/></pattern><linearGradient id="${shade}" x2="0" y2="1"><stop stop-color="#080909" stop-opacity=".04"/><stop offset=".48" stop-color="#080909" stop-opacity=".05"/><stop offset="1" stop-color="#080909" stop-opacity=".06"/></linearGradient>`;
 if(!options.enamelPattern){
  const enamelSize=1254*.32;
  defs+=`<pattern id="${enamel}" patternUnits="userSpaceOnUse" width="${enamelSize}" height="${enamelSize}"><image href="${href('material-enamel-'+theme+'.png')}" width="${enamelSize}" height="${enamelSize}"/></pattern>`;
 }
 const enamelWash=theme==='ember'?'':`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${enamel})" opacity=".08"/>`;
 return {defs,body:`<g data-armor-forged-surface="dented"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${material})"/>${enamelWash}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${shade})"/></g>`};
}
