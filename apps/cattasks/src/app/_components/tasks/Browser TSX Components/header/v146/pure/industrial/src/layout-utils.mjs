/**
 * Continuous catalogue-header geometry. All rectangles are CSS pixels:
 * [x, y, width, height]. Artwork and live HTML controls share these rectangles.
 * No viewport breakpoints, image data, browser APIs, or theme colours live here.
 */

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const mix = (start, end, progress) => start + (end - start) * progress;
export const smoothstep = value => {
  const p = clamp(value, 0, 1);
  return p * p * (3 - 2 * p);
};

// Conservative fallback for bold Latin labels. The browser adapter can supply
// measureText(text, fontSize) using the actual font for the full-label decision.
function estimatedTextWidth(text, size) {
  let units = 0;
  for (const character of String(text)) {
    if (/\s/.test(character)) units += 0.29;
    else if (/[ilI'.,:;!|]/.test(character)) units += 0.30;
    else if (/[MW@%]/.test(character)) units += 0.96;
    else if (/[mw]/.test(character)) units += 0.84;
    else if (/[ftjr]/.test(character)) units += 0.40;
    else if (/[A-Z]/.test(character)) units += 0.73;
    else units += 0.58;
  }
  return units * size;
}

export function makeMeasure(options) {
  return (text, size, role = 'title') => {
    if (typeof options.measureText === 'function') {
      const measured = Number(options.measureText(text, size, role));
      if (Number.isFinite(measured) && measured >= 0) return measured;
    }
    return estimatedTextWidth(text, size);
  };
}

export function fittedFont(measure, text, preferred, available, minimum, role) {
  const measured = measure(text, preferred, role);
  const fitted = measured > 0 ? preferred * (available - 2) / measured : preferred;
  return Math.max(minimum, Math.min(preferred, fitted));
}

/** A shared line decision for live HTML and exported SVG proofs. */
export function fittedHeading(measure, originalText, preferred, width, height) {
  const text = String(originalText).replace(/\s+/g, ' ').trim();
  const available = Math.max(1, width - 2);
  const lineRatio = 1.12;
  const cuts = [];
  for (let index = 1; index < text.length; index += 1) {
    if (text[index] === ' ') cuts.push(index);
  }
  // A single long identifier may wrap between characters, like overflow-wrap.
  if (!cuts.length) for (let index = 1; index < text.length; index += 1) cuts.push(index);

  const at = size => {
    const lineHeight = size * lineRatio;
    if (lineHeight <= height && measure(text, size, 'title') <= available)
      return { lines: [text], fontSize: size, lineHeight };
    if (2 * lineHeight > height) return null;
    let best = null;
    for (const cut of cuts) {
      const lines = [text.slice(0, cut).trimEnd(), text.slice(cut).trimStart()];
      const widths = lines.map(line => measure(line, size, 'title'));
      if (Math.max(...widths) <= available) {
        const score = Math.abs(widths[0] - widths[1]);
        if (!best || score < best.score) best = { lines, fontSize: size, lineHeight, score };
      }
    }
    return best;
  };

  const initial = at(preferred);
  if (initial) return initial;
  const minimum = 20;
  let best = at(minimum);
  if (best) {
    let low = minimum, high = preferred;
    for (let iteration = 0; iteration < 16; iteration += 1) {
      const size = (low + high) / 2;
      const candidate = at(size);
      if (candidate) { low = size; best = candidate; }
      else high = size;
    }
    return best;
  }

  // Extremely long/custom headings retain their full accessible text while the
  // two visible lines are ellipsized identically in HTML and the proof renderer.
  const ellipsize = value => {
    if (measure(value, minimum, 'title') <= available) return value;
    let low = 0, high = value.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (measure(`${value.slice(0, middle)}…`, minimum, 'title') <= available) low = middle;
      else high = middle - 1;
    }
    return `${value.slice(0, low).trimEnd()}…`;
  };
  const middle = cuts.reduce((closest, cut) =>
    Math.abs(cut - text.length / 2) < Math.abs(closest - text.length / 2) ? cut : closest,
  Math.floor(text.length / 2));
  return { lines: [ellipsize(text.slice(0, middle).trimEnd()), ellipsize(text.slice(middle).trimStart())],
    fontSize: minimum, lineHeight: minimum * lineRatio, truncated: true };
}

/** Native-size repeating niches, anchored beside the central crest. Only the
 * last exposed slice changes when a field widens; no row is scaled to fit. */
export function nativeArchGroups(leftStart,leftEnd,rightStart,rightEnd,openingY,openingHeight) {
  const sourceWidths=[308,297,305],sourceHeight=482,gap=.5;
  const height=openingHeight,arches=[],counts={left:0,right:0};
  const slots={left:Math.max(0,leftEnd-leftStart),right:Math.max(0,rightEnd-rightStart)};
  for(const side of ['left','right']) {
    let cursor=side==='left'?leftEnd:rightStart,index=0;
    while(index<64 && (side==='left'?cursor>leftStart:cursor<rightEnd)) {
      const sourceIndex=index%3,width=height*sourceWidths[sourceIndex]/sourceHeight;
      const x=side==='left'?cursor-width:cursor;
      arches.push({key:`${side}-${index}`,sourceIndex,rect:[x,openingY,width,height]});
      cursor+=side==='left'?-(width+gap):(width+gap);index++;
    }
    counts[side]=index;
  }
  return {arches,archGap:gap,archHeight:height,archY:openingY,
    archWidth:height*sourceWidths[1]/sourceHeight,
    archWidths:{left:height*sourceWidths[0]/sourceHeight,right:height*sourceWidths[0]/sourceHeight},
    archGroupWidth:Math.max(slots.left,slots.right),archCountPerSide:Math.max(counts.left,counts.right),archCounts:counts};
}
