import { renderArmorDockSurface } from './armor-surface-art.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** A broad armored chassis around three independent content areas. The open
 * catalog mechanism keeps its native proportions beneath the common frame. */
export function renderArmorCatalogPanels(layout,options={}){
 const d=layout.decor,progress=d.catalogWideProgress;
 if(layout.style!=='armor'||layout.mode!=='catalog'||!progress)return {defs:'',body:''};
 const art=ARMOR_CATALOG_INSETS[layout.theme],b=d.catalogInscription,right=d.catalogRightBay;
 const prefix=String(options.idPrefix||'armor-catalog').replace(/[^\w-]/g,'-');
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const href=file=>esc(options.resolveAsset?options.resolveAsset(file):base+'/'+file);
 const shoulderW=d.shoulderH*271/361,outer=d.shoulderX+shoulderW*.48;
 const field=[outer,b[1]-4,layout.width-outer*2,b[3]+12];
 const surface=renderArmorDockSurface(field,layout.theme,{...options,idPrefix:prefix+'-surface'});
 const panel=prefix+'-panel',chassis=prefix+'-chassis',rightClip=prefix+'-right',inscriptionClip=prefix+'-inscription';
 const [x,y,w,h]=b,k=h/367,cap=86*k,cut=23*k;
 const silhouette=`M${x+cap} ${y+2}H${x+w-cap}L${x+w-2} ${y+cut+2}V${y+h-cut-2}L${x+w-cap} ${y+h-2}H${x+cap}L${x+2} ${y+h-cut-2}V${y+cut+2}Z`;
 let defs=surface.defs+`<image id="${panel}" href="${href('panel-armor-'+layout.theme+'.png')}" width="2172" height="724"/><image id="${chassis}" href="${href(art.file)}" width="${art.size[0]}" height="${art.size[1]}"/><clipPath id="${rightClip}"><rect x="${x+w-cap}" y="${field[1]}" width="${Math.max(0,layout.width-outer-x-w+cap)}" height="${field[3]}"/></clipPath><clipPath id="${inscriptionClip}"><path d="${silhouette}"/></clipPath>`;
 const crop=(id,source,dest,aspect='xMidYMid meet')=>`<svg x="${dest[0]}" y="${dest[1]}" width="${dest[2]}" height="${dest[3]}" viewBox="${source.join(' ')}" preserveAspectRatio="${aspect}" overflow="hidden"><use href="#${id}"/></svg>`;
 const rect=[right[0]-40,right[1]-4,right[2]+80,right[3]+12];
 const scale=rect[3]/art.crop[3],sourceW=Math.min(art.crop[2],rect[2]/scale);
 const sourceX=clamp(art.focalX-sourceW/2,art.crop[0],art.crop[0]+art.crop[2]-sourceW);
 const relief=`<g data-armor-catalog-relief="${layout.theme}" data-armor-catalog-inset="open-mechanism-v136" data-armor-catalog-side="right" data-native-scale="${scale}" opacity="${d.catalogInsetOpacity??1}" clip-path="url(#${rightClip})">${crop(chassis,[sourceX,art.crop[1],sourceW,art.crop[3]],rect)}</g>`;
 // Reuse the original inner frame caps, without its navigation compartments.
 // Only quiet native rail segments repeat; the stone remains a uniform crop.
 let inscription=crop(panel,[510,315,1140,270],[x,y,w,h],'xMidYMid slice');
 for(const source of [[600,276,240,38],[600,623,240,40]]){
  const yy=y+(source[1]-273)*k,hh=source[3]*k,step=source[2]*k;
  for(let at=x+cap-1;at<x+w-cap+1;at+=step-.3)inscription+=crop(panel,source,[at,yy,step,hh]);
 }
 inscription+=crop(panel,[432,273,86,367],[x,y,cap,h])+crop(panel,[1658,273,86,367],[x+w-cap,y,cap,h]);
 const plate=`<g data-armor-catalog-inscription="native-slate" clip-path="url(#${inscriptionClip})">${inscription}</g>`;
 return {defs,body:`<g data-armor-catalog-composition="three-bays" opacity="${progress}">${surface.body}${relief}${plate}</g>`};
}


// Co-located from classic/src/armor-catalog-insets.mjs; sole consumer above.
/** Catalog-only open mechanisms. Native atlas pixels stay intact; each row is
 * uniformly scaled and its mounting ends tuck beneath the shared frame. */
const file='armor-catalog-insets-v136.png';
const size=[1254,1254];

export const ARMOR_CATALOG_INSETS=Object.freeze({
 blue:{file,size,crop:[3,103,1241,218],focalX:624},
 green:{file,size,crop:[10,381,1229,235],focalX:624},
 ember:{file,size,crop:[10,657,1233,238],focalX:626},
 violet:{file,size,crop:[15,944,1224,233],focalX:620}
});
