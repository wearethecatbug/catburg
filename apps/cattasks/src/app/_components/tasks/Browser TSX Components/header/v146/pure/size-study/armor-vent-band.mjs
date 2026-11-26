/** Preview-only sizing study. Approved production sources remain untouched. */
/** One cast housing surrounds the red channel and its quieter enamel ends.
 * The two contours share the same calculated, eased shoulder transition.
 * Painted material supplies the surface; no framed fragment is repeated or
 * placed over another frame at the joint. Larger, less frequent louvers sit
 * in one uninterrupted dark slot; the native housing stays continuous.
 */
const ART={
 blue:{size:[2172,724],crop:[13,270,2146,183]},
 green:{size:[1659,948],crop:[23,402,1614,144]},
 violet:{size:[2172,724],crop:[13,280,2147,164]},
 ember:{size:[2172,724],crop:[15,277,2142,170]}
};
const TRANSITION_FRACTION=.24;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

export function getArmorVentGeometry(layout){
 const {width,decor:d}=layout,f=d.frame,q=clamp(d.q,0,1);
 const shoulderH=d.shoulderH??126+56*q,shoulderW=shoulderH*271/361;
 const shoulderX=d.shoulderX??Math.max(7,f[0]-shoulderW+3);
 const transition=smooth((width-430)/192),baseHeight=28*Math.min(1,(width-16)/414),h=baseHeight+(d.ventBandH-baseHeight)*transition;
 const x=shoulderX+shoulderW-28,y=f[1]-h+2;
 const inner=width/2+2,halfWidth=inner-x,blueWidth=halfWidth*TRANSITION_FRACTION;
 const left=[x,y,halfWidth,h],right=[width-inner,y,halfWidth,h];
 const segments={
  left:{transition:[x,y,blueWidth,h],red:[x+blueWidth,y,halfWidth-blueWidth,h]},
  right:{red:[width-inner,y,halfWidth-blueWidth,h],transition:[width-x-blueWidth,y,blueWidth,h]}
 };
 const detailMix=smooth((width-622)/418);
 return{left,right,segments,transitionFraction:TRANSITION_FRACTION,scale:h/ART[layout.theme].crop[3],
  detailMix,louverScaleFactor:1+detailMix};
}

export function renderArmorVentBand(layout,options={}){
 if(layout.style!=='armor'||layout.composition==='compact')return{defs:'',body:''};
 const {theme,width}=layout,art=ART[theme],g=getArmorVentGeometry(layout);
 const prefix=String(options.idPrefix||'armor').replace(/[^\w-]/g,'-')+'-vent-band';
 const base=(options.assetBase||'./classic/assets').replace(/\/$/,'');
 const href=file=>esc(options.resolveAsset?options.resolveAsset(file):base+'/'+file);
 const red=g.segments.right.red,quiet=g.segments.right.transition;
 const [x,y,,h]=red,end=quiet[0]+quiet[2],s=h/44;
 // Both outlines begin and finish their transition at the same x coordinates.
 // Horizontal tangents remove the abrupt notch left by the old pasted elbow.
 const a=quiet[0]-.34*h,b=quiet[0]+.80*h,c=(b-a)*.38;
 const contour=(inset,quietInset)=>{
  const top=y+inset,btm=y+h-inset,qt=y+quietInset,qb=y+h-quietInset;
  return`M${x} ${top}H${a}C${a+c} ${top} ${b-c} ${qt} ${b} ${qt}H${end}V${qb}H${b}C${b-c} ${qb} ${a+c} ${btm} ${a} ${btm}H${x}Z`;
 };
 const outer=contour(1.3*s,7.3*s),opening=contour(.26*h,.26*h+6*s);
 const materialScale=.38,materialSize=1254*materialScale;
 let defs=`<image id="${prefix}-source" href="${href(`armor-vent-rail-${theme}.png`)}" width="${art.size[0]}" height="${art.size[1]}"/>
 <pattern id="${prefix}-enamel" patternUnits="userSpaceOnUse" x="${x}" y="${y-70}" width="${materialSize}" height="${materialSize}"><image href="${href(`material-enamel-${theme}.png`)}" width="${materialSize}" height="${materialSize}"/></pattern>
 <clipPath id="${prefix}-opening"><path d="${opening}"/></clipPath>
 <linearGradient id="${prefix}-red-end" gradientUnits="userSpaceOnUse" x1="${quiet[0]-.08*h}" x2="${quiet[0]+.36*h}" y1="0" y2="0"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
 <mask id="${prefix}-red-mask" maskUnits="userSpaceOnUse" x="${x-1}" y="${y-1}" width="${end-x+2}" height="${h+2}"><rect x="${x-1}" y="${y-1}" width="${end-x+2}" height="${h+2}" fill="url(#${prefix}-red-end)"/></mask>`;
 // Crop only the uninterrupted interior of the purpose-painted rail. Its old
 // rectangular frame and closed caps never participate in the new geometry.
 const railWidth=quiet[0]+.4*h-x,sourceStart=art.crop[0]+100,sourceSpan=art.crop[2]-200,tileWidth=sourceSpan*g.scale;
 // Only the inner louver painting is enlarged uniformly. Its vertical centre
 // is cropped back to the opening; housing rivets and mouldings keep their
 // former scale. At desktop the diagonal pitch is 2x the original pitch.
 const sourceH=art.crop[3]/g.louverScaleFactor,louverTileWidth=tileWidth*g.louverScaleFactor;
 const source=[sourceStart,art.crop[1]+(art.crop[3]-sourceH)/2,sourceSpan,sourceH];
 defs+=`<pattern id="${prefix}-native-louvers" patternUnits="userSpaceOnUse" x="${x}" y="${y}" width="${louverTileWidth}" height="${h}"><svg width="${louverTileWidth}" height="${h}" viewBox="${source.join(' ')}" preserveAspectRatio="xMinYMin meet"><use href="#${prefix}-source"/></svg></pattern>`;
 const louvers=`<rect x="${x}" y="${y}" width="${railWidth}" height="${h}" fill="url(#${prefix}-native-louvers)"/>`;
 // Continue the SAME painted moulding across the bend. Sampling consecutive
 // source columns preserves its chipped edges and optical pitch. Only the
 // short curved part needs affine strips; every endpoint meets its neighbour.
 // These are adjacent columns of one painting, not repeated decorative tiles.
 const offset=at=>6*s*smooth((at-a)/(b-a));
 const nativeMoulding=(bottom=false)=>{
  const ratio=bottom?.74:0,sourceY=art.crop[1]+art.crop[3]*ratio,sourceH=art.crop[3]*.26;
  const y0=y+h*ratio,dh=h*.26,direction=bottom?-1:1;
  const points=[x];
  for(let at=x;at<end-.001;){
   const phase=((at-x)%tileWidth+tileWidth)%tileWidth,remaining=tileWidth-phase;
   at=Math.min(end,at+Math.min(4,remaining<.001?tileWidth:remaining));points.push(at);
  }
  let painted='';
  for(let i=0;i<points.length-1;i++){
   const from=points[i],to=points[i+1],dx=to-from,dy=direction*offset(from),slope=direction*(offset(to)-offset(from))/dx;
   const sourceX=sourceStart+(((from-x)%tileWidth+tileWidth)%tileWidth)/g.scale;
   painted+=`<g transform="matrix(1 ${slope} 0 1 0 ${dy-slope*from})"><svg x="${from-.08}" y="${y0}" width="${dx+.16}" height="${dh}" viewBox="${sourceX-.08/g.scale} ${sourceY} ${(dx+.16)/g.scale} ${sourceH}" preserveAspectRatio="xMinYMin meet" overflow="hidden"><use href="#${prefix}-source"/></svg></g>`;
  }
  return painted;
 };
 const right=`<g data-armor-junction="continuous-casting" data-louver-pitch-scale="${g.louverScaleFactor}"><path d="${outer}" fill="url(#${prefix}-enamel)"/><path d="${opening}" fill="#080a0c"/><g clip-path="url(#${prefix}-opening)" mask="url(#${prefix}-red-mask)">${louvers}</g><g data-native-moulding="continuous">${nativeMoulding()}${nativeMoulding(true)}</g><g data-armor-transition="enamel" data-transition-fraction="${TRANSITION_FRACTION}"/></g>`;
 return{defs,body:`<g data-armor-vent-band="transitioned">${right}<g transform="translate(${width} 0) scale(-1 1)">${right}</g></g>`};
}
