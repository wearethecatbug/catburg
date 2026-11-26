import { ASSETS } from './assets.mjs';
import { DEITY_DECOR, getDeityDecorPlacements, getRunePlacements } from './decor-layout.mjs';
import { renderDeitySigil, renderRunePanel, RUNE_PALETTES } from './rune-art.mjs';

export const THEMES = {
  green: { surface:'#202617', light:'#363a22', deep:'#0d110b', edge:'#b8914d', text:'#f7ecd1', muted:'#d2c6a2', red:'#45571c', hot:'#829536', hue:78, silver:false },
  ember: { surface:'#201815', light:'#3a2520', deep:'#0d0908', edge:'#bc894b', text:'#f7ead2', muted:'#d8b890', red:'#8a1410', hot:'#c32a1c', hue:0, silver:false },
  violet: { surface:'#2a2031', light:'#453047', deep:'#140f1c', edge:'#cbb9cf', text:'#f7e8f4', muted:'#dbc3df', red:'#653452', hot:'#a75e91', hue:300, silver:true },
  blue: { surface:'#142337', light:'#294059', deep:'#090f1d', edge:'#b99960', text:'#f4e9d3', muted:'#c6cce0', red:'#144862', hot:'#3487ad', hue:235, silver:false }
};
export function resolveTheme(value) {
  const aliases={nurgle:'green',khorne:'ember',slaanesh:'violet',tzeentch:'blue'};
  return THEMES[value] ? value : aliases[value] || 'green';
}
export function escapeXML(value) {
  return String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const n = value => Number(Number(value).toFixed(4));
const baseAssets=['forged-iron-backing.png','back-button-housing.png','back-button-mount.png','beam.png','control-metal-face.png','crest-gem.png','crest-metal.png','panel-strip-metal.png','right-armor-cap.png','title-frame.png','vent-frame.png','glowing-arches.png','theme-badge.png'];
const catalogMaterial='daemon-iron-support-v1.png';
const usedAssets=[...baseAssets,catalogMaterial,...Object.values(DEITY_DECOR).flatMap(d=>[d.left,d.right])];

export function makeAssetDefinitions(options={}) {
  if(typeof options.resolveAsset!=='function')throw new Error('v146 industrial artwork requires the closed asset resolver');
  const imagePrefix=options.imagePrefix || 'wh7-images-';
  return (options.selectedNames || usedAssets).map(name=>{
    const asset=ASSETS[name];
    const href=options.resolveAsset(name);
    return `<image id="${imagePrefix+name.replace(/\W/g,'-')}" width="${asset.width}" height="${asset.height}" href="${escapeXML(href)}"/>`;
  }).join('');
}

/** Paints only decoration by default. Runtime owns the live semantic text/buttons.
 * Source image coordinates, geometry and renderer are shared with exported proofs.
 */
export function renderHeaderArtwork(layout, options={}) {
  const p=String(options.idPrefix || 'wh7-art').replace(/[^\w-]/g,'-');
  const imagePrefix=options.imagePrefix || `${p}-images-`;
  const themeName=resolveTheme(options.theme);
  const t=THEMES[themeName];
  // Local navigation enamel adds material contrast without recoloring the
  // energy arches, jewel or brass: wine for Nurgle, oxblood/copper for Khorne,
  // and amethyst for Tzeentch, matching its Gothic and Armor navigation.
  const taskBackFaces={
    green:{red:'#4b1424',hot:'#7c3548',deep:'#1a090f'},
    ember:{red:'#501a17',hot:'#79402d',deep:'#150f0d'},
    blue:{red:'#3d1858',hot:'#704391',deep:'#180d27'}
  };
  const backFace=layout.mode==='task'?(taskBackFaces[themeName]||t):t;
  // Match Nurgle's brighter yellow-green Classic crystals without tinting
  // the surrounding wings or changing the green energy arches.
  const gemTone=themeName==='green'
    ? {hue:72,saturation:'1.2',gain:'1.55',exponent:'.64'}
    : {hue:t.hue,saturation:'1.35',gain:'1.32',exponent:'.76'};
  const sharedShell=layout.shell==='industrial-shared';
  const decor=DEITY_DECOR[themeName];
  const selectedNames=layout.mode==='catalog'&&!sharedShell?[...baseAssets,catalogMaterial,decor.left]:baseAssets;
  let defs=options.defineImages===false ? '' : makeAssetDefinitions({...options,imagePrefix,selectedNames});
  let serial=0;
  const imgId=name=>imagePrefix+name.replace(/\W/g,'-');
  const rectString=rect=>rect.map(n).join(' ');
  function crop(name,src,dst) {
    if(dst[2]<=0 || dst[3]<=0)return '';
    return `<svg x="${n(dst[0])}" y="${n(dst[1])}" width="${n(dst[2])}" height="${n(dst[3])}" viewBox="${rectString(src)}" preserveAspectRatio="none" overflow="hidden"><use href="#${imgId(name)}"/></svg>`;
  }
  function fit(name,dst) {
    const b=ASSETS[name].bounds,src=[b[0],b[1],b[2]-b[0],b[3]-b[1]];
    const scale=Math.min(dst[2]/src[2],dst[3]/src[3]);
    return crop(name,src,[dst[0]+(dst[2]-src[2]*scale)/2,dst[1]+(dst[3]-src[3]*scale)/2,src[2]*scale,src[3]*scale]);
  }
  function repeat(name,src,dst,scale) {
    if(dst[2]<=0 || dst[3]<=0)return '';
    const id=`${p}-tile-${++serial}`,tw=src[2]*scale,th=src[3]*scale;
    defs+=`<pattern id="${id}" x="${n(dst[0])}" y="${n(dst[1])}" width="${n(tw)}" height="${n(th)}" patternUnits="userSpaceOnUse">${crop(name,src,[0,0,tw,th])}</pattern>`;
    return `<rect x="${n(dst[0])}" y="${n(dst[1])}" width="${n(dst[2])}" height="${n(dst[3])}" fill="url(#${id})"/>`;
  }
  function threeSlice(name,left,mid,right,dst,mirror=false) {
    const [x,y,w,h]=dst,scale=h/left[3],lw=left[2]*scale,rw=right[2]*scale;
    const inner=Math.max(0,w-lw-rw);
    const painted=crop(name,left,[x,y,lw,h])+repeat(name,mid,[x+lw,y,inner,h],scale)+crop(name,right,[x+w-rw,y,rw,h]);
    return mirror ? `<g transform="translate(${n(2*x+w)} 0) scale(-1 1)">${painted}</g>` : painted;
  }
  function housingScale(dst,scale) {
    return Math.min(scale,dst[3]/(2*177)*.95,dst[2]/(2*229)*.95);
  }
  function housing(dst,scale) {
    const [x,y,w,h]=dst;
    scale=housingScale(dst,scale);
    const cw=229*scale,ch=177*scale;
    const name='back-button-housing.png';
    return crop(name,[71,101,229,177],[x,y,cw,ch])+
      repeat(name,[600,101,100,177],[x+cw,y,w-2*cw,ch],scale)+
      crop(name,[1590,101,229,177],[x+w-cw,y,cw,ch])+
      repeat(name,[71,320,229,100],[x,y+ch,cw,h-2*ch],scale)+
      repeat(name,[1590,320,229,100],[x+w-cw,y+ch,cw,h-2*ch],scale)+
      crop(name,[71,543,229,177],[x,y+h-ch,cw,ch])+
      repeat(name,[600,543,100,177],[x+cw,y+h-ch,w-2*cw,ch],scale)+
      crop(name,[1590,543,229,177],[x+w-cw,y+h-ch,cw,ch]);
  }
  function insideHousing(rect,scale,paint) {
    const [x,y,w,h]=rect,s=housingScale(rect,scale);
    // Follow the PNG's inner gold lip, in the same source units as its
    // nine-slice. The small underlap is hidden by the lip and seals AA seams.
    // The bottom corner is shallower because the source includes a lower foot.
    const points=[
      [x+188*s,y+90*s],[x+w-188*s,y+90*s],
      [x+w-110*s,y+171*s],[x+w-110*s,y+h-176*s],
      [x+w-187*s,y+h-132*s],[x+187*s,y+h-132*s],
      [x+110*s,y+h-176*s],[x+110*s,y+171*s]
    ];
    const id=`${p}-housing-interior-${++serial}`;
    defs+=`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><polygon points="${points.map(a=>a.map(n).join(',')).join(' ')}"/></clipPath>`;
    return `<g clip-path="url(#${id})">${paint}</g>`;
  }
  function panelFace(rect,red=false,kind='cut') {
    const [x,y,w,h]=rect;
    const cut=Math.min(12,h*.22);
    const points=kind==='hex'
      ? [[x+h*.32,y],[x+w-h*.32,y],[x+w,y+h*.46],[x+w-h*.32,y+h],[x+h*.32,y+h],[x,y+h*.46]]
      : [[x+cut,y],[x+w-cut,y],[x+w,y+cut],[x+w,y+h-cut],[x+w-cut,y+h],[x+cut,y+h],[x,y+h-cut],[x,y+cut]];
    const id=`${p}-face-${++serial}`;
    defs+=`<clipPath id="${id}"><polygon points="${points.map(a=>a.map(n).join(',')).join(' ')}"/></clipPath>`;
    return `<g clip-path="url(#${id})"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${p}-${red?'red':'surface'})"/>`+
      `<g opacity="${red?.68:.48}" style="mix-blend-mode:soft-light">${threeSlice('control-metal-face.png',[109,118,190,537],[580,118,300,537],[1725,118,190,537],rect)}</g>`+
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${p}-glaze)"/>`+
      `<path d="M${n(x+cut+3)} ${n(y+5)}H${n(x+w-cut-3)}" stroke="${red?'#ffd68d':t.edge}" stroke-width="1" opacity=".48"/>`+
      `<path d="M${n(x+cut+3)} ${n(y+h-4)}H${n(x+w-cut-3)}" stroke="#040302" stroke-width="2" opacity=".8"/></g>`;
  }
  function arch(rect,index) {
    const source=[[431,99,308,482],[739,99,297,482],[1036,99,305,482]][index%3];
    // Geometry preserves this complete source arch's aspect ratio.
    return crop('glowing-arches.png',source,rect);
  }
  function ironMaterial(rect) {
    const [,,w,h]=rect;
    if(w<=0 || h<=0)return '';
    const s=h/234;
    // Material height controls the texture scale. Narrow joints expose a crop;
    // wider supports use the same end caps and a continuous interior strip.
    if(w<320*s)return crop('forged-iron-backing.png',[900,255,w/s,234],rect);
    return threeSlice('forged-iron-backing.png',
      [55,255,160,234],[215,255,1742,234],[1957,255,160,234],rect);
  }
  function connectorPlate(rect,side) {
    if(!rect || rect[2]<=0)return '';
    const [x,y,w,h]=rect,id=`${p}-iron-${side}`;
    // A straight inner end underlaps the vent: no second beveled hole can
    // coincide with the vent's bevel and expose the page through the seam.
    const bevel=Math.min(4,h*.1,w*.15);
    const points=side==='left'
      ? [[x+bevel,y],[x+w,y],[x+w,y+h],[x+bevel,y+h],[x,y+h-bevel],[x,y+bevel]]
      : [[x,y],[x+w-bevel,y],[x+w,y+bevel],[x+w,y+h-bevel],[x+w-bevel,y+h],[x,y+h]];
    defs+=`<clipPath id="${id}"><polygon points="${points.map(a=>a.map(n).join(',')).join(' ')}"/></clipPath>`;
    // The generated relief is one continuous iron surface. Height sets its
    // physical scale; a narrower support crops it rather than stretching faces.
    // Only the exposed outer end receives a collar. Its inner end runs under
    // the existing vent frame, avoiding a second floating cap at that join.
    const scale=h/236,cap=Math.min(w,(side==='left'?136:124)*scale),interior=Math.max(0,w-cap);
    const material=side==='left'
      ? crop(catalogMaterial,[48,256,136,236],[x,y,cap,h])+
        repeat(catalogMaterial,[184,256,1816,236],[x+cap,y,interior,h],scale)
      : repeat(catalogMaterial,[660,256,1340,236],[x,y,interior,h],scale)+
        crop(catalogMaterial,[2000,256,124,236],[x+w-cap,y,cap,h]);
    return `<g data-daemon-support="${side}" data-closed-outer-end="true" clip-path="url(#${id})"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${t.deep}"/><g opacity=".68" filter="url(#${p}-metal)">${material}</g></g>`;
  }
  function titleSeat(rect) {
    if(!rect || rect[3]<=0)return '';
    const [x,y,w,h]=rect,id=`${p}-title-seat`;
    defs+=`<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath>`;
    // Show the forged upper lip behind the source mount's transparent feet;
    // do not squeeze the whole material into this short visible slit.
    return `<g clip-path="url(#${id})">${ironMaterial([x,y,w,44])}</g>`;
  }
  function titleMount(rect) {
    return threeSlice('back-button-mount.png',[61,103,250,506],[600,103,140,506],[1861,103,250,506],rect);
  }
  function backSection(rect,divider) {
    if(!rect || !divider)return '';
    const [x,y,,h]=rect;
    const cx=divider[0]+divider[2]/2,skew=Math.min(6,h*.11),cut=Math.min(11,h*.2);
    const points=[[x+cut,y+3],[cx+skew,y+3],[cx-skew,y+h-3],[x+cut,y+h-3],[x+3,y+h-cut],[x+3,y+cut]];
    return `<polygon points="${points.map(a=>a.map(n).join(',')).join(' ')}" fill="url(#${p}-arrow-face)"/>`+
      `<path d="M${n(cx+skew)} ${n(y+7)}L${n(cx-skew)} ${n(y+h-7)}" stroke="#080503" stroke-width="4"/>`+
      `<path d="M${n(cx+skew-1)} ${n(y+7)}L${n(cx-skew-1)} ${n(y+h-7)}" stroke="${t.edge}" stroke-width="1.8"/>`;
  }
  function navigationEnd(key) {
    const nav=layout.navigation?.[key];
    if(!nav)return '';
    const id=`${p}-end-${key}`,points=nav.polygon.map(a=>a.map(n).join(',')).join(' ');
    defs+=`<clipPath id="${id}"><polygon points="${points}"/></clipPath>`;
    const r=layout.hits[key]||layout.rects[key==='previous'?'previousFace':'nextFace'],separator=nav.separator;
    return `<g data-wh7-control="${key}"><g clip-path="url(#${id})">`+
      `<rect x="${n(r[0])}" y="${n(r[1])}" width="${n(r[2])}" height="${n(r[3])}" fill="url(#${p}-end-face)"/>`+
      `<g opacity=".16" style="mix-blend-mode:soft-light">${fit('control-metal-face.png',r)}</g></g>`+
      `<path d="M${separator.map(a=>a.map(n).join(' ')).join('L')}" fill="none" stroke="#030302" stroke-width="3.6"/>`+
      `<path d="M${separator.map(a=>a.map(n).join(' ')).join('L')}" fill="none" stroke="${t.edge}" stroke-width="1" opacity=".85"/>`+
      `<polygon class="wh7-focus-edge" points="${points}" fill="none" stroke="${t.text}" stroke-width="2" opacity="0"/></g>`;
  }
  function taskPlaque() {
    const interior=layout.titleInterior;
    if(!interior)return panelFace(R.title,false,'hex')+`<g filter="url(#${p}-metal)">${taskTitleFrame(R.title)}</g>`;
    const id=`${p}-title-interior`;
    defs+=`<clipPath id="${id}"><polygon points="${interior.map(a=>a.map(n).join(',')).join(' ')}"/></clipPath>`;
    const [x,y,w,h]=R.title;
    let material;
    if(layout.mode==='task'){
      // Reuse the same unlettered stone opening as the Classic Armor frame.
      // A uniform cover crop preserves the veins; the existing interior clip,
      // navigation end faces and native gold frame retain their exact geometry.
      const stoneId=`${p}-task-stone`,depthId=`${p}-task-stone-depth`;
      const stoneFile=`panel-armor-${themeName}.png`,stonePath=`classic/${stoneFile}`;
      const stoneHref=options.resolveAsset?.(stonePath);
      if(!stoneHref)throw new Error('v146 industrial artwork requires the closed asset resolver');
      defs+=`<image id="${stoneId}" href="${escapeXML(stoneHref)}" width="2172" height="724"/><linearGradient id="${depthId}" x2="0" y2="1"><stop stop-color="#080707" stop-opacity=".34"/><stop offset=".22" stop-color="#080707" stop-opacity=".05"/><stop offset=".65" stop-color="#080707" stop-opacity="0"/><stop offset="1" stop-color="#080707" stop-opacity=".30"/></linearGradient>`;
      material=`<g data-industrial-task-material="classic-stone"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#181616"/><svg x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" viewBox="510 315 1140 270" preserveAspectRatio="xMidYMid slice" overflow="hidden"><use href="#${stoneId}"/></svg><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${depthId})"/></g>`;
    }else{
      material=`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${p}-surface)"/>`+
        `<g opacity=".27" style="mix-blend-mode:soft-light">${threeSlice('control-metal-face.png',[109,118,190,537],[580,118,300,537],[1725,118,190,537],R.title)}</g>`;
    }
    return `<g clip-path="url(#${id})">${material}</g>${navigationEnd('previous')}${navigationEnd('next')}<g filter="url(#${p}-metal)">${taskTitleFrame(R.title)}</g>`;
  }
  function taskThemeSocket() {
    if(layout.showTheme===false || !R.themeSocket)return '';
    const socket=R.themeSocket,points=layout.themeSocketPolygon;
    const [x,y,w,h]=socket;
    const usesTerminal=layout.armorVisibility>0 && layout.terminalOutline;
    const shape=points?`<polygon points="${points.map(a=>a.map(n).join(',')).join(' ')}"`:`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"`;
    // Exactly one opaque housing: compact socket OR the morphing terminal.
    // The sigil and semantic control are never duplicated during a resize.
    const compactFace=usesTerminal?'':`${shape} fill="url(#${p}-end-face)" stroke="${t.edge}" stroke-width="1.2"/>`+
      `<path d="M${n(x+5)} ${n(y+5)}V${n(y+h-5)}" stroke="#070604" stroke-width="2"/>`;
    return `<g data-wh7-control="theme">${compactFace}`+
      renderDeitySigil(themeName,[R.theme[0]+9,R.theme[1]+9,R.theme[2]-18,R.theme[3]-18],{idPrefix:`${p}-theme-sigil`,glow:true})+`</g>`;
  }
  function taskTerminalArmor() {
    if(!R.rightArmorCap || !(layout.armorVisibility>0) || !layout.terminalOutline)return '';
    const amount=layout.armorVisibility,outline=layout.terminalOutline;
    const points=outline.map(a=>a.map(n).join(',')).join(' ');
    const [x,y,w,h]=R.rightArmorCap,s=w/1338;
    const xs=outline.map(a=>a[0]),ys=outline.map(a=>a[1]);
    const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)];
    const shellId=`${p}-terminal-shell`,faceId=`${p}-terminal-native-face`,rimId=`${p}-terminal-rim`;
    // Exclude the PNG's outside rim from its interior layer. Its rim is then
    // allowed only along the CURRENT outside contour, never as a second old
    // diagonal floating inside the new face at an intermediate width.
    const sourceInterior=[[75,62],[807,62],[1268,492],[492,492]];
    defs+=`<clipPath id="${shellId}" clipPathUnits="userSpaceOnUse"><polygon points="${points}"/></clipPath>`+
      `<clipPath id="${faceId}" clipPathUnits="userSpaceOnUse"><polygon points="${sourceInterior.map(([px,py])=>[n(x+px*s),n(y+py*s)].join(',')).join(' ')}"/></clipPath>`+
      `<mask id="${rimId}" maskUnits="userSpaceOnUse" x="${n(x-8)}" y="${n(y-8)}" width="${n(w+16)}" height="${n(h+16)}"><polygon points="${points}" fill="none" stroke="white" stroke-width="12"/></mask>`;
    const stroke=1.2+amount*1.8;
    return `<g data-wh7-part="terminal-armor"><g clip-path="url(#${shellId})">`+
      `<polygon points="${points}" fill="url(#${p}-end-face)"/>`+
      `<g opacity="${n(amount*.65)}" filter="url(#${p}-metal)">${ironMaterial(bounds)}</g>`+
      `<g clip-path="url(#${faceId})" opacity="${n(amount)}" filter="url(#${p}-metal)">${fit('right-armor-cap.png',R.rightArmorCap)}</g></g>`+
      `<polygon points="${points}" fill="none" stroke="#15120c" stroke-width="${n(stroke+1.4)}"/>`+
      `<polygon points="${points}" fill="none" stroke="${t.edge}" stroke-width="${n(stroke)}"/>`+
      `<g clip-path="url(#${shellId})" mask="url(#${rimId})" opacity="${n(amount)}" filter="url(#${p}-metal)">${fit('right-armor-cap.png',R.rightArmorCap)}</g></g>`;
  }
  function catalogThemeSocket() {
    if(layout.mode!=='catalog' || sharedShell || layout.showTheme===false || !R.themeSocket)return '';
    const [x,y,w,h]=R.themeSocket,divider=R.themeDivider;
    const dx=divider[0]+divider[2]/2;
    return `<g data-wh7-control="theme"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${p}-end-face)"/>`+
      `<g opacity=".2" style="mix-blend-mode:soft-light">${fit('control-metal-face.png',R.themeSocket)}</g>`+
      `<path d="M${n(dx)} ${n(divider[1])}V${n(divider[1]+divider[3])}" stroke="#060504" stroke-width="3.5"/>`+
      `<path d="M${n(dx+.7)} ${n(divider[1])}V${n(divider[1]+divider[3])}" stroke="${t.edge}" stroke-width="1"/>`+
      renderDeitySigil(themeName,R.themeArt,{idPrefix:`${p}-catalog-theme-sigil`,glow:true,padding:0})+`</g>`;
  }
  function crest(rect) {
    const [x,y,w,h]=rect;
    const gem=[x+w*.4452,y+h*.164,w*.111,h*.697];
    const [gx,gy,gw,gh]=gem;
    return `<ellipse cx="${n(gx+gw/2)}" cy="${n(gy+gh*.64)}" rx="${n(gw*.82)}" ry="${n(gh*.57)}" fill="url(#${p}-gem-aura)" opacity=".5"/>`+
      `<g filter="url(#${p}-jewel)">${fit('crest-gem.png',gem)}</g>`+
      `<g filter="url(#${p}-metal)">${fit('crest-metal.png',rect)}</g>`+
      `<path d="M${n(gx+gw*.42)} ${n(gy+gh*.24)}L${n(gx+gw*.31)} ${n(gy+gh*.45)}" stroke="#fffbe6" stroke-width="${n(Math.max(.5,w/180))}" stroke-linecap="round" opacity=".78"/>`+
      `<circle cx="${n(gx+gw*.43)}" cy="${n(gy+gh*.24)}" r="${n(Math.max(.45,w/210))}" fill="#fffde9" opacity=".92"/>`;
  }
  function drawBeam(rect) {
    const [x,y,w,h]=rect,scale=h/63;
    let beam=threeSlice('beam.png',[28,520,122,63],[285,520,55,63],[1340,520,116,63],rect);
    // A fixed set of circular rivets; no breakpoint creates another metal layer.
    const margin=Math.max(18,135*scale),diam=20*scale;
    for(let i=0;i<8;i++)beam+=crop('beam.png',[348,522,20,22],[x+margin+(w-2*margin)*i/7-diam/2,y+2*scale,diam,22*scale]);
    return beam;
  }
  function taskTitleFrame(rect) {
    return threeSlice('title-frame.png',[78,132,252,437],[600,132,150,437],[1840,132,252,437],rect);
  }
  const R=layout.rects;
  const ornaments=sharedShell?[]:getDeityDecorPlacements(layout,themeName);
  const runePlacements=sharedShell?[]:getRunePlacements(layout,themeName);
  const ornamentArt=level=>ornaments.filter(a=>a.level===level).map(a=>`<g data-catalog-ornament="${a.side}" opacity="${n(a.opacity)}">${fit(a.name,a.rect)}</g>`).join('');
  defs+=`<linearGradient id="${p}-surface" x2=".2" y2="1"><stop stop-color="${t.light}"/><stop offset=".55" stop-color="${t.surface}"/><stop offset="1" stop-color="${t.deep}"/></linearGradient>`+
    `<linearGradient id="${p}-red" x2=".15" y2="1"><stop stop-color="${backFace.hot}"/><stop offset=".22" stop-color="${backFace.red}"/><stop offset=".72" stop-color="${backFace.red}"/><stop offset="1" stop-color="${backFace.deep}"/></linearGradient>`+
    `<linearGradient id="${p}-glaze" x1="0" y1="0" x2=".35" y2="1"><stop stop-color="#ffdfaa" stop-opacity=".13"/><stop offset=".18" stop-color="#fff0c9" stop-opacity=".025"/><stop offset=".45" stop-color="#fff0c9" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".24"/></linearGradient>`+
    `<linearGradient id="${p}-arrow-face" x2="1" y2="1"><stop stop-color="${backFace.deep}"/><stop offset=".7" stop-color="${backFace.red}"/><stop offset="1" stop-color="${backFace.deep}"/></linearGradient>`+
    `<linearGradient id="${p}-end-face" x2=".6" y2="1"><stop stop-color="${t.deep}"/><stop offset=".55" stop-color="${t.surface}"/><stop offset="1" stop-color="#080806"/></linearGradient>`+
    `<radialGradient id="${p}-gem-aura"><stop stop-color="${RUNE_PALETTES[themeName].glow}" stop-opacity=".85"/><stop offset=".5" stop-color="${RUNE_PALETTES[themeName].glow}" stop-opacity=".32"/><stop offset="1" stop-color="${RUNE_PALETTES[themeName].glow}" stop-opacity="0"/></radialGradient>`+
    `<filter id="${p}-jewel" color-interpolation-filters="sRGB"><feColorMatrix type="hueRotate" values="${gemTone.hue}"/><feColorMatrix type="saturate" values="${gemTone.saturation}"/><feComponentTransfer><feFuncR type="gamma" amplitude="${gemTone.gain}" exponent="${gemTone.exponent}" offset="0"/><feFuncG type="gamma" amplitude="${gemTone.gain}" exponent="${gemTone.exponent}" offset="0"/><feFuncB type="gamma" amplitude="${gemTone.gain}" exponent="${gemTone.exponent}" offset="0"/></feComponentTransfer></filter>`+
    `<filter id="${p}-accent" color-interpolation-filters="sRGB"><feColorMatrix type="hueRotate" values="${t.hue}"/></filter>`+
    `<filter id="${p}-metal" color-interpolation-filters="sRGB">${t.silver?'<feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.2" intercept=".02"/><feFuncG type="linear" slope="1.19" intercept=".02"/><feFuncB type="linear" slope="1.28" intercept=".03"/></feComponentTransfer>':'<feColorMatrix type="saturate" values=".86"/>'}</filter>`;
  let body=panelFace(R.body);
  body+=`<g filter="url(#${p}-metal)">${threeSlice('panel-strip-metal.png',[26,448,10,93],[600,448,120,93],[1551,448,10,93],R.body)}</g>`;
  body+=`<rect x="${n(R.body[0])}" y="${n(R.body[1])}" width="${n(R.body[2])}" height="${n(R.body[3])}" fill="${t.surface}" opacity=".28"/>`;
  if(layout.mode==='catalog'&&!sharedShell)body+=titleSeat(R.titleSeat)+connectorPlate(R.connectorLeft,'left')+connectorPlate(R.connectorRight,'right');
  const runeArt=runePlacements.map(a=>{
    const art=renderRunePanel(themeName,a.rect,{idPrefix:`${p}-runes-${a.side}`,opacity:a.opacity,glow:true,animate:true,side:a.side,phase:a.phase,variantOffset:a.variantOffset,revealHeight:a.revealHeight});
    const [x,y,w,h]=a.clip,id=`${p}-rune-pocket-${a.side}`;
    defs+=`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath>`;
    return `<g data-rune-pocket="${a.side}" clip-path="url(#${id})">${art}</g>`;
  }).join('');
  body+=runeArt;
  body+=ornamentArt('lower');
  // The texture stays as tall as the cavity. Only the metal window reveals it;
  // resizing never scales a fixed count of arches down to fit a narrow slot.
  for(const side of ['left','right']) {
    const r=layout.fields[side],clipId=`${p}-arches-${side}`;
    const polygon=layout.cavities?.[side];
    const shape=polygon
      ? `<polygon points="${polygon.map(a=>a.map(n).join(',')).join(' ')}"/>`
      : `<rect x="${n(r[0])}" y="${n(r[1])}" width="${n(r[2])}" height="${n(r[3])}"/>`;
    defs+=`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${shape}</clipPath>`;
    const row=layout.arches.filter(a=>a.key.startsWith(`${side}-`));
    body+=`<g clip-path="url(#${clipId})"><g filter="url(#${p}-accent)">${row.map((a,i)=>arch(a.rect,a.sourceIndex??i)).join('')}</g></g>`;
  }
  // The original metal hides the seam of the exact polygon-shaped openings.
  const leftFrame=R.ventLeft;
  const rightFrame=R.ventRight;
  body+=`<g filter="url(#${p}-metal)">`+
    threeSlice('vent-frame.png',[60,164,220,379],[300,164,120,379],[1680,164,430,379],leftFrame)+
    threeSlice('vent-frame.png',[60,164,220,379],[300,164,120,379],[1680,164,430,379],rightFrame,true)+`</g>`;
  // The desktop terminal has a sloping upper edge. Clip all underlying rail
  // layers together so no rectangular backing/arch scrap shows past the cap.
  if((layout.mode==='task'||sharedShell) && layout.armorVisibility>0 && layout.railOutline) {
    const railId=`${p}-rail-outline`;
    defs+=`<clipPath id="${railId}" clipPathUnits="userSpaceOnUse"><polygon points="${layout.railOutline.map(a=>a.map(n).join(',')).join(' ')}"/></clipPath>`;
    body=`<g clip-path="url(#${railId})">${body}</g>`;
  }
  const faceScale=layout.metrics?.housingScale ?? (.09+layout.t*.054);
  if(layout.mode==='task'||sharedShell) {
    body+=taskTerminalArmor();
    body+=taskPlaque();
    body+=taskThemeSocket();
  } else {
    const titleFace=[R.title[0]+2,R.title[1]+2,R.title[2]-4,R.title[3]*.85];
    body+=panelFace(titleFace)+`<g filter="url(#${p}-metal)">${titleMount(R.title)}</g>`;
  }
  body+=`<g data-wh7-control="back">`+insideHousing(R.back,faceScale,panelFace(R.back,true)+backSection(R.back,R.backDivider)+catalogThemeSocket())+`<g filter="url(#${p}-metal)">${housing(R.back,faceScale)}</g></g>`;
  body+=`<g filter="url(#${p}-metal)">${drawBeam(R.beam)}</g>`;
  body+=crest(R.crest);
  body+=ornamentArt('upper');
  if(options.includeLabels) {
    for(const [key,label] of Object.entries(layout.labels)) {
      const r=label.rect,size=label.fontSize;
      if(!r || !label.text)continue;
      const font=key==='title' ? 'DejaVu Serif,Georgia,serif' : 'Liberation Sans,Arial,sans-serif';
      const lines=label.lines || [label.text],lineHeight=label.lineHeight || size*1.08;
      const baseY=r[1]+r[3]/2-(lines.length-1)*lineHeight/2;
      body+=`<text text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${n(size)}" font-weight="700" fill="${key==='number'?t.muted:t.text}">${lines.map((line,i)=>`<tspan x="${n(r[0]+r[2]/2)}" y="${n(baseY+i*lineHeight)}">${escapeXML(line)}</tspan>`).join('')}</text>`;
    }
    for(const [key,dir] of [['backArrow','back'],['arrowPrevious','previous'],['arrowNext','next']]) {
      const r=R[key];if(!r)continue;
      const path=dir==='back'?'M19 12H5m6-6-6 6 6 6':dir==='next'?'m9 5 7 7-7 7':'m15 5-7 7 7 7';
      body+=`<svg x="${n(r[0])}" y="${n(r[1])}" width="${n(r[2])}" height="${n(r[3])}" viewBox="0 0 24 24"><path d="${path}" stroke="${t.text}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(layout.width)}" height="${n(layout.height)}" viewBox="0 0 ${n(layout.width)} ${n(layout.height)}" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
}
