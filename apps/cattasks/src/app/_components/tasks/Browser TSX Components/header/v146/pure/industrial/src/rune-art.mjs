/**
 * Small engraved marks for the free metal joints and the integrated theme key.
 * These are original decorative drawings inspired by the four Chaos themes,
 * not a transcription of a canonical alphabet. Nurgle's three-part motif and
 * the existence of distinct god sigils are documented by Warhammer Community.
 * All artwork is path/circle geometry; no font glyphs or opaque backing image.
 */
export const RUNE_PALETTES = {
  green: { god:'nurgle', glow:'#95b83e', core:'#c8d98c', highlight:'#edf4c6', metal:'#8f9565' },
  violet: { god:'slaanesh', glow:'#b55bc5', core:'#d4a7df', highlight:'#f4def5', metal:'#aaa1b5' },
  ember: { god:'khorne', glow:'#ba351d', core:'#df8051', highlight:'#f5b982', metal:'#a18458' },
  blue: { god:'tzeentch', glow:'#2a9cce', core:'#83cee6', highlight:'#d8f5fa', metal:'#83969e' }
};

const runeClamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const runeNumber=value=>Number(Number(value).toFixed(4));
const runeTheme=value=>RUNE_PALETTES[value]?value:
  ({nurgle:'green',slaanesh:'violet',khorne:'ember',tzeentch:'blue'}[value]||'green');
let runeSerial=0;

// 32 × 32 design cells with an inset around their complete silhouettes.
export const RUNE_SHAPES = {
  green: [
    '<circle cx="16" cy="9" r="5.4"/><circle cx="9.2" cy="22" r="5.4"/><circle cx="22.8" cy="22" r="5.4"/><path d="M16 14.4v2.4M13.7 20.2h4.6M6.6 26.8l-1.2 2M25.4 26.8l1.2 2"/>',
    '<path d="M16 4v6M10 7l6 3 6-3M16 10v4M16 24v4"/><circle cx="16" cy="19" r="5"/>',
    '<path d="M9 5c-6 4-5 13 2 17M23 5c6 4 5 13-2 17M11 22c0 8 10 8 10 0M12 5l4-3 4 3"/><circle cx="16" cy="16" r="4"/>',
    '<path d="M16 15C9 14 7 8 11 4M16 15c7-2 12 2 11 8M16 15c-1 8-6 13-11 9M11 4l4 1M27 23l-3 3M5 24l1-4"/><circle cx="16" cy="15" r="3"/>',
    '<path d="M11 4C4 7 3 17 8 23M8 23l-1-6M8 23l6-2M21 28c7-4 8-14 2-20M23 8l1 6M23 8l-6 2"/><circle cx="16" cy="16" r="3.7"/>',
    '<path d="M16 3c-2 6-8 8-8 15 0 5 4 9 8 11 4-2 8-6 8-11 0-7-6-9-8-15ZM16 12v17M10 16l6 5 6-5M7 6l4 3M25 6l-4 3"/>'
  ],
  violet: [
    '<path d="M18 6C10 3 5 8 5 14c0 7 9 11 15 6 4-4 1-9-3-8M16 22v7M11 26h10M18 6l5-4M21 4l7 1M21 4l2 7"/>',
    '<path d="M20 4c-8 0-12 6-10 12 2 6 9 7 11 2M15 21v7M11 25h8M20 4l4 3-4 3"/>',
    '<path d="M16 3c-1 6-7 7-7 13 0 4 3 7 7 9 4-2 7-5 7-9 0-6-6-7-7-13ZM16 10v15M12 28h8"/>',
    '<path d="M13 4C3 7 4 21 14 24M19 8c10 3 9 17-1 20M13 4c8 4 8 15 1 20M19 8c-7 4-7 15-1 20M11 14h10"/>',
    '<path d="M16 3v26M16 7l-7 8 7 9 7-9-7-8ZM8 8C3 8 3 15 8 17M24 8c5 0 5 7 0 9M11 28h10"/>',
    '<path d="M9 4c0 7 14 8 14 16 0 4-4 8-8 8M23 4c0 7-14 8-14 16 0 4 4 8 8 8M9 4h14M16 10v11"/>'
  ],
  ember: [
    '<path d="M6 4l5 6h10l5-6v9l-6 5 5 10h-7l-2-5-2 5H7l5-10-6-5V4ZM11 14l5 4 5-4"/>',
    '<path d="M16 3v25M9 8l7-5 7 5-7 5-7-5ZM10 18l6 5 6-5M12 28h8"/>',
    '<path d="M6 6l10 9L26 6v7l-10 9-10-9V6ZM16 22v7M11 26h10"/>',
    '<path d="M5 5l6 5v7l5 4 5-4v-7l6-5M5 5v10l6 5M27 5v10l-6 5M16 7v22M11 27l5-5 5 5"/>',
    '<path d="M6 5l10 10L26 5M6 5v8l10 10 10-10V5M10 26l6-7 6 7M16 3v5M13 29h6"/>',
    '<path d="M8 3l7 7-4 4-7-7 4-4ZM24 3l-7 7 4 4 7-7-4-4ZM11 14l13 13M21 14L8 27M5 24l6 5M21 29l6-5"/>'
  ],
  blue: [
    '<path d="M4 19Q16 7 28 19 16 29 4 19ZM16 12l3 7-3 6-3-6 3-7ZM15 10C11 4 19 2 23 4c-5 1-4 5 1 6"/>',
    '<path d="M11 27c11 0 13-9 4-12-8-3-4-10 4-10M15 15c8 0 13-4 11-8M8 24l3 3-3 2"/>',
    '<path d="M6 18Q16 7 26 18 16 28 6 18ZM16 11v14M11 5l5 4 5-4M11 28h10"/>',
    '<path d="M16 3c6 7-7 11-2 18M16 3c-10 7-12 15-5 24M16 3c2 9 13 13 8 22M11 27c5 4 12 1 13-2M14 21l4 5"/>',
    '<path d="M16 3l4 9 8 4-8 4-4 9-4-9-8-4 8-4 4-9ZM16 11v10M12 16h8M4 5l4 3M28 27l-4-3"/>',
    '<path d="M24 7C18 0 6 5 6 16c0 9 12 15 19 7M24 7l-1 6-6-1M25 23l-6 1M11 18c-1-7 9-9 11-3 2 6-8 10-9 4"/>'
  ]
};

/** Names describe this UI kit's original drawings, not a canonical alphabet. */
export const RUNE_MOTIF_NAMES = {
  green:['Знак темы','Росток','Печать распада','Споры','Разомкнутый круг','Семя'],
  violet:['Знак темы','Полумесяц','Капля','Двойной серп','Шип','Переплетение'],
  ember:['Знак темы','Остриё','Насечка','Рога','Разлом','Клинки'],
  blue:['Знак темы','Змеиный штрих','Око','Пламя','Искра','Спираль']
};

function runeRect(rect) {
  if(!Array.isArray(rect)||rect.length<4)return null;
  const values=rect.slice(0,4).map(Number);
  return values.every(Number.isFinite)&&values[2]>0&&values[3]>0?values:null;
}

function runeOptions(options,defaultGlow,defaultOpacity) {
  const glow=typeof options.glow==='number'?runeClamp(options.glow,0,1):
    options.glow===false?0:options.glow===true?.38:defaultGlow;
  const opacity=typeof options.opacity==='number'?runeClamp(options.opacity,0,1):defaultOpacity;
  const prefix=String(options.idPrefix||'wh-rune').replace(/[^\w-]/g,'-');
  return {glow,opacity,id:`${prefix}-${++runeSerial}`};
}

function runeLayers(shape,key,id,glow) {
  const palette=RUNE_PALETTES[key];
  // Filter has generous bounds, but even its faint halo remains within the
  // requested cell margin. The final sharp line is always the legible layer.
  const glowLayer=glow?`<g filter="url(#${id}-halo)" stroke="${palette.glow}" stroke-width="4" opacity="${runeNumber(glow)}">${shape}</g>`:'';
  return `<defs><filter id="${id}-halo" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.3"/></filter></defs>`+
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`+
      `<g stroke="#060707" stroke-width="3.8" opacity=".95">${shape}</g>`+
      `<g transform="translate(0 .7)" stroke="${palette.metal}" stroke-width="2.6" opacity=".29">${shape}</g>`+
      glowLayer+
      `<g stroke="${palette.core}" stroke-width="1.65" opacity=".88">${shape}</g>`+
      `<g stroke="${palette.highlight}" stroke-width=".48" opacity=".56">${shape}</g>`+
    `</g>`;
}

/**
 * A single theme mark, centred and uniformly fitted in rect [x,y,width,height].
 * Options: idPrefix, glow (false/true or0..1), opacity0..1, padding in CSS px.
 * Returns an SVG fragment with local defs. No hit area or background is drawn.
 */
export function renderDeitySigil(theme,rect,options={}) {
  const r=runeRect(rect);if(!r)return '';
  const [x,y,w,h]=r,key=runeTheme(theme),o=runeOptions(options,.28,1);
  const padding=Math.max(0,Number(options.padding??2)||0);
  const size=Math.min(w-2*padding,h-2*padding);
  if(size<22||o.opacity===0)return '';
  const scale=size/32,tx=x+(w-size)/2,ty=y+(h-size)/2;
  return `<g data-deity-sigil="${RUNE_PALETTES[key].god}" opacity="${runeNumber(o.opacity)}" transform="translate(${runeNumber(tx)} ${runeNumber(ty)}) scale(${runeNumber(scale)})">`+
    runeLayers(RUNE_SHAPES[key][0],key,o.id,o.glow)+'</g>';
}

/** Stable positions around the panel centre: adding a mark never redistributes
 * existing marks. Entire glyphs enter only after their cell clears both edges.
 * There is no random offset or breakpoint shuffle on each resize. */
export function getRuneGlyphLayout(theme,rect,options={}) {
  const r=runeRect(rect),key=runeTheme(theme);
  if(!r)return {theme:key,glyphs:[],count:0};
  const [x,y,w,h]=r,padding=Math.max(2,Number(options.padding??6)||0);
  const preferred=runeClamp(Number(options.glyphSize??24)||24,22,28);
  const size=Math.min(preferred,h-8);
  if(size<22)return {theme:key,rect:r,glyphs:[],count:0};
  const phase=((Math.trunc(Number(options.phase)||0)%5)+5)%5;
  const base=((Math.trunc(Number(options.variantOffset??(options.side==='right'?3:0)))%6)+6)%6;
  const anchors=[['center',0],['near-left',-38],['near-right',34],['far-left',-75],['far-right',73]];
  const vertical=[.55,-.95,.85,-.5,.7],glyphs=[];
  const revealHeight=Number.isFinite(options.revealHeight)?Math.max(0,options.revealHeight):Infinity;
  const exitThresholds=[18,20,22,24,26];
  for(let index=0;index<anchors.length;index++) {
    const [name,dx]=anchors[index],cell=index===0?size:Math.max(22,size-2);
    const centre=x+w/2+dx*size/24,left=centre-cell/2;
    const clearance=Math.min(left-(x+padding),x+w-padding-(left+cell));
    const entrance=runeClamp(clearance/4,0,1);
    if(entrance<=0)continue;
    const verticalEntrance=runeClamp((revealHeight-exitThresholds[index])/10,0,1);
    const fade=entrance*entrance*(3-2*entrance)*verticalEntrance*verticalEntrance*(3-2*verticalEntrance);
    if(fade<=.00001)continue;
    const offsetY=vertical[(index+phase)%5]*Math.min(3.5,Math.max(0,(h-cell)/2-3));
    const variant=(base+index)%6;
    glyphs.push({key:name,variant,name:RUNE_MOTIF_NAMES[key][variant],
      rect:[left,y+(h-cell)/2+offsetY,cell,cell],offsetY,
      opacity:fade*(index===0?1:.8),entrance:fade});
  }
  return {theme:key,rect:r,glyphs,count:glyphs.length};
}

/** An individual original motif, used by the asset sheet and exported SVGs. */
export function renderRuneMotif(theme,variant,rect,options={}) {
  const r=runeRect(rect);if(!r)return '';
  const [x,y,w,h]=r,key=runeTheme(theme),o=runeOptions(options,.23,1);
  const index=((Math.trunc(Number(variant)||0)%6)+6)%6;
  const padding=Math.max(0,Number(options.padding??3)||0),size=Math.min(w,h)-2*padding;
  if(size<22 || o.opacity===0)return '';
  return `<g data-rune-motif="${RUNE_PALETTES[key].god}-${index}" opacity="${runeNumber(o.opacity)}" transform="translate(${runeNumber(x+(w-size)/2)} ${runeNumber(y+(h-size)/2)}) scale(${runeNumber(size/32)})">`+
    runeLayers(RUNE_SHAPES[key][index],key,o.id,o.glow)+'</g>';
}

/** A loose engraved group, with whole motifs at slightly different heights. */
export function renderRunePanel(theme,rect,options={}) {
  const layout=getRuneGlyphLayout(theme,rect,options);
  const key=layout.theme,o=runeOptions(options,.23,.84);
  if(!layout.count || !o.opacity)return '';
  const shapes=layout.glyphs.map((glyph,index)=>{
    const [x,y,size]=glyph.rect;
    const delay=-(index*1.17+(Number(options.phase)||0)*.63);
    return `<g data-rune="${glyph.variant}" data-rune-key="${glyph.key}" opacity="${runeNumber(glyph.opacity)}"${options.animate?` style="animation-delay:${runeNumber(delay)}s"`:''} transform="translate(${runeNumber(x)} ${runeNumber(y)}) scale(${runeNumber(size/32)})">`+
      runeLayers(RUNE_SHAPES[key][glyph.variant],key,`${o.id}-${glyph.key}`,o.glow)+'</g>';
  }).join('');
  // Keep the engraved base light in the artwork. Dashboard AmbientCanvas owns
  // the optional runtime pulse, so this renderer never attaches a CSS clock.
  const animation='';
  return `${animation}<g id="${o.id}" data-rune-panel="${RUNE_PALETTES[key].god}" data-glyph-count="${layout.count}" opacity="${runeNumber(o.opacity)}">${shapes}</g>`;
}
