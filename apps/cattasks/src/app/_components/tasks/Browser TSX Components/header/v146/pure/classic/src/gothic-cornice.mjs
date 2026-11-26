/** Continuous painted Gothic mouldings.
 * Each palette is one long, purpose-painted strip. The crop uses a fixed
 * height-driven, uniform scale. Wider spans continue the long plain material
 * with a short blended join; sculpted modules are never stretched or repeated.
 */
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const GOTHIC_CORNICE_ART={
 file:'gothic-cornice-continuous-atlas.png',size:[1774,887],
 rows:{blue:[32,110,1712,112],green:[32,301,1712,116],violet:[32,499,1712,116],ember:[32,698,1712,116]}
};
export const GOTHIC_CATALOG_CORNICE_ART={
 file:'gothic-catalog-cornice-continuous-atlas.png',size:[1774,887],
 rows:{blue:[32,78,1712,145],green:[32,286,1712,147],violet:[32,486,1712,146],ember:[32,694,1712,147]}
};
export function renderGothicCornice({x,y,width,height,theme='blue',catalog=false},options={}){
 if(width<=0||height<=0)return{defs:'',body:''};
 const id=String(options.idPrefix||'cornice').replace(/[^\w-]/g,'-');
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const art=catalog?GOTHIC_CATALOG_CORNICE_ART:GOTHIC_CORNICE_ART;
 const file=art.file,href=esc(options.resolveAsset?options.resolveAsset(file):base+'/'+file),source=art.rows[theme]||art.rows.blue;
 const scale=height/source[3],nativeWidth=source[2]*scale;
 let defs=`<image id="${id}-atlas" href="${href}" width="1774" height="887"/><clipPath id="${id}-extent"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath>`;
 const strip=at=>`<svg x="${at}" y="${y}" width="${nativeWidth}" height="${height}" viewBox="${source.join(' ')}" preserveAspectRatio="xMinYMin meet" overflow="hidden"><use href="#${id}-atlas"/></svg>`;
 let painted=strip(x);
 // The wide catalogue can exceed the long native strip. Continue its plain
 // moulding at the same height and grain size, blending only the material seam.
 if(width>nativeWidth){
  const overlap=Math.min(18,nativeWidth/4),step=nativeWidth-overlap;
  for(let offset=step,index=1;offset<width;offset+=step,index++){
   const at=x+offset,fade=`${id}-join-${index}`,mask=fade+'-mask';
   defs+=`<linearGradient id="${fade}" gradientUnits="userSpaceOnUse" x1="${at}" x2="${at+overlap}" y1="0" y2="0"><stop stop-color="black"/><stop offset="1" stop-color="white"/></linearGradient><mask id="${mask}" maskUnits="userSpaceOnUse" x="${at}" y="${y}" width="${nativeWidth}" height="${height}"><rect x="${at}" y="${y}" width="${nativeWidth}" height="${height}" fill="url(#${fade})"/></mask>`;
   painted+=`<g mask="url(#${mask})">${strip(at)}</g>`;
  }
 }
 const body=`<g data-gothic-cornice="continuous" data-material-scale="${scale}" clip-path="url(#${id}-extent)">${painted}</g>`;
 return{defs,body};
}
