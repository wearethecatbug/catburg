"use client";

import {
  forwardRef,
  type ComponentPropsWithRef,
  type CSSProperties,
} from "react";
import styles from "./AllTasksControlsV3.module.css";

type Bounds = readonly [number, number, number, number];

type Artwork = {
  readonly source: string;
  readonly width: number;
  readonly height: number;
  readonly bounds: Bounds;
};

const artwork = {
  wideButton: {
    source: "/cattasks/themes/shared/task-header/button-wide.png",
    width: 2172,
    height: 724,
    bounds: [96, 108, 2076, 616],
  },
  compactButton: {
    // This installed file is the kit's measured visible crop: 1642 × 430.
    source: "/cattasks/themes/shared/all-tasks/button-compact-frame.png",
    width: 1642,
    height: 430,
    bounds: [0, 0, 1642, 430],
  },
  metalFace: {
    source: "/cattasks/themes/khorne/task-header/control-metal-face.png",
    width: 2022,
    height: 778,
    bounds: [109, 118, 1915, 655],
  },
  headingStrip: {
    source: "/cattasks/themes/shared/all-tasks/panel-strip-metal.png",
    width: 1586,
    height: 992,
    bounds: [26, 448, 1561, 541],
  },
  fieldFrame: {
    source: "/cattasks/themes/shared/all-tasks/field-frame.png",
    width: 2172,
    height: 724,
    bounds: [75, 220, 2098, 505],
  },
  numberBadge: {
    source: "/cattasks/themes/shared/all-tasks/number-badge.png",
    width: 1429,
    height: 1101,
    bounds: [208, 172, 1217, 927],
  },
  selectedRow: {
    // This installed file is the kit's measured visible crop: 1335 × 80.
    source: "/cattasks/themes/khorne/chrome/selected-row-frame-cropped.png",
    width: 1335,
    height: 80,
    bounds: [0, 0, 1335, 80],
  },
} as const satisfies Record<string, Artwork>;

function cropStyle(art: Artwork, bounds: Bounds): CSSProperties {
  const [left, top, right, bottom] = bounds;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  return {
    width: `${(art.width / width) * 100}%`,
    height: `${(art.height / height) * 100}%`,
    left: `${(-left / width) * 100}%`,
    top: `${(-top / height) * 100}%`,
  };
}

type ArtCropProps = {
  art: Artwork;
  bounds?: Bounds;
};

function ArtCrop({ art, bounds }: ArtCropProps) {
  const visible = bounds ?? art.bounds;
  return (
    <span className={styles.artCrop} aria-hidden="true">
      <img alt="" draggable={false} src={art.source} style={cropStyle(art, visible)} />
    </span>
  );
}

/** End caps are kept intact while only the middle art is allowed to extend. */
type MetalStripProps = {
  art: Artwork;
  cap?: number;
  className?: string;
};

function MetalStrip({ art, cap = 0.12, className }: MetalStripProps) {
  const [left, top, right, bottom] = art.bounds;
  const cut = (right - left) * cap;
  const cells: readonly Bounds[] = [
    [left, top, left + cut, bottom],
    [left + cut, top, right - cut, bottom],
    [right - cut, top, right, bottom],
  ];

  return (
    <span
      className={`${styles.metalStrip} ${className ?? ""}`}
      style={{ "--ct-controls-cap": cut / Math.max(1, bottom - top) } as CSSProperties}
      aria-hidden="true"
    >
      {cells.map((bounds, index) => <ArtCrop art={art} bounds={bounds} key={index} />)}
    </span>
  );
}

/** Corners are separate slices so a selected row keeps its rivets and bevels. */
type MetalFrameProps = {
  art: Artwork;
  edge?: number;
};

function MetalFrame({ art, edge = 18 }: MetalFrameProps) {
  const [left, top, right, bottom] = art.bounds;
  const horizontal = Math.min(edge, (right - left) / 3);
  const vertical = Math.min(edge, (bottom - top) / 3);
  const xs = [left, left + horizontal, right - horizontal, right];
  const ys = [top, top + vertical, bottom - vertical, bottom];

  return (
    <span className={styles.metalFrame} style={{ "--ct-controls-frame-edge": `${edge}px` } as CSSProperties} aria-hidden="true">
      {ys.slice(0, -1).flatMap((startY, row) => xs.slice(0, -1).map((startX, column) => (
        <ArtCrop
          art={art}
          bounds={[startX, startY, xs[column + 1], ys[row + 1]]}
          key={`${row}-${column}`}
        />
      )))}
    </span>
  );
}

export type CatalogueMetalButtonProps = ComponentPropsWithRef<"button"> & {
  tone?: "neutral" | "accent" | "selected";
  frame?: "wide" | "compact";
};

/** A real button: art is visual only, while all supplied native button behaviour remains intact. */
export const CatalogueMetalButton = forwardRef<HTMLButtonElement, CatalogueMetalButtonProps>(function CatalogueMetalButton(
  { children, className = "", frame = "compact", tone = "neutral", type = "button", ...buttonProps },
  ref,
) {
  return (
    <button
      {...buttonProps}
      className={`${styles.button} ${styles[`buttonTone${tone[0].toUpperCase()}${tone.slice(1)}`]} ${styles[`buttonFrame${frame[0].toUpperCase()}${frame.slice(1)}`]} ${className}`}
      ref={ref}
      type={type}
    >
      <span className={styles.buttonVisual} aria-hidden="true">
        <span className={styles.buttonCoat} />
        <MetalStrip art={artwork.metalFace} className={styles.buttonTexture} />
        <MetalStrip art={frame === "wide" ? artwork.wideButton : artwork.compactButton} cap={frame === "wide" ? 0.19 : 0.08} className={styles.buttonFrame} />
      </span>
      <span className={styles.buttonLabel}>{children}</span>
    </button>
  );
});

CatalogueMetalButton.displayName = "CatalogueMetalButton";

/** Place inside a position:relative search or file wrapper. It never receives pointer input. */
export function CatalogueFieldArt() {
  return <MetalStrip art={artwork.fieldFrame} className={styles.fieldArt} />;
}

/** Decorative, visible file-button layer; the host must retain its real file input above it. */
export function CatalogueFileChoose() {
  return (
    <span className={styles.fileChoose} aria-hidden="true">
      <MetalStrip art={artwork.numberBadge} cap={0.2} className={styles.fileChooseFrame} />
      <span className={styles.fileChooseLabel}>Choose file</span>
    </span>
  );
}

/** Place first in the selected row, which must be position:relative. */
export function CatalogueSelectedRowArt() {
  return (
    <span className={styles.selectedRowArt} aria-hidden="true">
      <span className={styles.selectedRowCoat} />
      <MetalFrame art={artwork.selectedRow} edge={9} />
    </span>
  );
}

/** Put inside the table-heading element, whose live labels stay ordinary HTML above it. */
export function CatalogueHeadingArt() {
  return <MetalStrip art={artwork.headingStrip} cap={0.04} className={styles.headingArt} />;
}

export function CataloguePlus() {
  return <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

export type CatalogueOpenArrowProps = {
  full?: boolean;
};

export function CatalogueOpenArrow({ full = false }: CatalogueOpenArrowProps) {
  return <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={full ? "M5 12h14m-6-6 6 6-6 6" : "m10 6 6 6-6 6"} /></svg>;
}
