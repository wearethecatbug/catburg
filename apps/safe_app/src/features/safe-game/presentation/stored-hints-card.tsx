import type { EarnedHintFact } from "../domain";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import styles from "./stored-hints-card.module.css";

const CARD_GUTTER = 12;
const ABOVE_CARD_GAP = 12;
const MIN_USABLE_CARD_HEIGHT = 80;

type CardLayout = Pick<CSSProperties, "left" | "maxHeight" | "top">;

type SidePlacement = {
  left: number;
  maxHeight: number;
  top: number;
};

type StoredHintsCardProps = {
  facts: readonly EarnedHintFact[];
  historyPanelRef?: RefObject<HTMLElement | null>;
  onHistoryCovered?: (covered: boolean) => void;
};

function overlaps(
  left: number,
  top: number,
  width: number,
  height: number,
  box: DOMRect,
) {
  return (
    left < box.right &&
    left + width > box.left &&
    top < box.bottom &&
    top + height > box.top
  );
}

export function factText(fact: EarnedHintFact) {
  if (fact.kind === "parity") return `The code is ${fact.parity}.`;
  if (fact.kind === "divisibility")
    return fact.relation === "divisible"
      ? `The code is divisible by ${fact.divisor}.`
      : `The code is not divisible by ${fact.divisor}.`;
  return `The code is between ${fact.minimum} and ${fact.maximum}.`;
}

function scrollStoredHints(event: KeyboardEvent<HTMLUListElement>) {
  const list = event.currentTarget;
  const card = list.closest<HTMLElement>("section");
  if (!card) return;
  const rowStep = 28;
  const nextTop =
    event.key === "End"
      ? card.scrollHeight
      : event.key === "Home"
        ? 0
        : event.key === "PageDown"
          ? card.scrollTop + card.clientHeight
          : event.key === "PageUp"
            ? card.scrollTop - card.clientHeight
            : event.key === "ArrowDown"
              ? card.scrollTop + rowStep
              : event.key === "ArrowUp"
                ? card.scrollTop - rowStep
                : null;
  if (nextTop === null) return;
  event.preventDefault();
  card.scrollTop = nextTop;
}

export function StoredHintsCard({
  facts,
  historyPanelRef,
  onHistoryCovered,
}: StoredHintsCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<CardLayout>();

  useLayoutEffect(() => {
    const card = cardRef.current;
    const wrapper = card?.parentElement;
    const trigger = wrapper?.querySelector("button");
    if (!card || !wrapper || !trigger) return;

    const updateLayout = () => {
      const wrapperBox = wrapper.getBoundingClientRect();
      const triggerBox = trigger.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const paintedSurface = card.closest("main")?.parentElement;
      const paintedBox = paintedSurface?.getBoundingClientRect();
      const scaleX = wrapper.offsetWidth ? wrapperBox.width / wrapper.offsetWidth : 1;
      const scaleY = wrapper.offsetHeight ? wrapperBox.height / wrapper.offsetHeight : 1;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const surfaceLeft = Math.max(
        CARD_GUTTER,
        (paintedBox?.left ?? 0) + CARD_GUTTER,
      );
      const surfaceRight = Math.min(
        viewportWidth - CARD_GUTTER,
        (paintedBox?.right ?? viewportWidth) - CARD_GUTTER,
      );
      const surfaceTop = Math.max(
        CARD_GUTTER,
        (paintedBox?.top ?? 0) + CARD_GUTTER,
      );
      const surfaceBottom = Math.min(
        viewportHeight - CARD_GUTTER,
        (paintedBox?.bottom ?? viewportHeight) - CARD_GUTTER,
      );
      const cardWidth = cardBox.width;
      const cardStyle = getComputedStyle(card);
      const borderHeight =
        (Number.parseFloat(cardStyle.borderTopWidth) || 0) +
        (Number.parseFloat(cardStyle.borderBottomWidth) || 0);
      const preferredHeight =
        Number.parseFloat(
          cardStyle.getPropertyValue("--stored-hints-preferred-height"),
        ) || 128;
      const naturalHeight = Math.min(
        card.scrollHeight + borderHeight,
        preferredHeight,
      ) * scaleY;
      const belowGap =
        viewportWidth >= 1280 ? triggerBox.height + 36 : 16;
      const belowSpace = surfaceBottom - (triggerBox.bottom + belowGap);
      const aboveSpace = triggerBox.top - surfaceTop - ABOVE_CARD_GAP;
      const anchoredLeft = Math.min(
        Math.max(triggerBox.left, surfaceLeft),
        surfaceRight - cardWidth,
      );
      const codeInput = document.getElementById("safe-code");
      const codeForm = codeInput?.closest("form");
      const inputBox = codeInput?.getBoundingClientRect();
      const submitBox = codeForm
        ?.querySelector('button[type="submit"]')
        ?.getBoundingClientRect();
      const codeLeft = Math.min(
        inputBox?.left ?? Number.POSITIVE_INFINITY,
        submitBox?.left ?? Number.POSITIVE_INFINITY,
      );
      const codeRight = Math.max(
        inputBox?.right ?? Number.NEGATIVE_INFINITY,
        submitBox?.right ?? Number.NEGATIVE_INFINITY,
      );
      const codeBottom = Math.max(
        inputBox?.bottom ?? Number.NEGATIVE_INFINITY,
        submitBox?.bottom ?? Number.NEGATIVE_INFINITY,
      );
      const placeAbove =
        belowSpace < naturalHeight && aboveSpace > belowSpace;
      const menu = card.closest("nav");
      const newGameBox = menu
        ?.querySelector("button")
        ?.getBoundingClientRect();
      const menuAboveSpace = newGameBox
        ? newGameBox.top -
          Math.max(surfaceTop, codeBottom + CARD_GUTTER) -
          ABOVE_CARD_GAP
        : Number.NEGATIVE_INFINITY;
      const placeAboveMenu =
        placeAbove && menuAboveSpace >= MIN_USABLE_CARD_HEIGHT;
      const overlapsNewGame =
        placeAbove &&
        !placeAboveMenu &&
        newGameBox !== undefined &&
        anchoredLeft < newGameBox.right &&
        anchoredLeft + cardWidth > newGameBox.left &&
        triggerBox.top - ABOVE_CARD_GAP - naturalHeight < newGameBox.bottom;
      const newGameRight = (newGameBox?.right ?? Number.NEGATIVE_INFINITY) +
        CARD_GUTTER;
      const placeRightOfNewGame =
        overlapsNewGame && newGameRight + cardWidth <= surfaceRight;
      const cardLeft = placeRightOfNewGame ? newGameRight : anchoredLeft;
      const intersectsCodeControls =
        placeAbove &&
        cardLeft < codeRight &&
        cardLeft + cardWidth > codeLeft;
      const protectedAboveSpace = intersectsCodeControls
        ? triggerBox.top - Math.max(surfaceTop, codeBottom + CARD_GUTTER) - ABOVE_CARD_GAP
        : aboveSpace;
      const sideCandidates = [
        codeLeft - CARD_GUTTER - cardWidth,
        codeRight + CARD_GUTTER,
      ].filter(
        (left) =>
          Number.isFinite(left) &&
          left >= surfaceLeft &&
          left + cardWidth <= surfaceRight,
      );
      const sideLeft = sideCandidates.sort(
        (left, right) =>
          Math.abs(left - triggerBox.left) - Math.abs(right - triggerBox.left),
      )[0];
      const placeSide =
        placeAbove &&
        !placeAboveMenu &&
        protectedAboveSpace < MIN_USABLE_CARD_HEIGHT &&
        sideLeft !== undefined;
      const availableHeight = Math.max(
        1,
        placeAboveMenu
          ? menuAboveSpace
          : placeSide
          ? surfaceBottom - surfaceTop
          : placeAbove
          ? protectedAboveSpace >= MIN_USABLE_CARD_HEIGHT
            ? protectedAboveSpace
            : Math.max(MIN_USABLE_CARD_HEIGHT, aboveSpace)
          : belowSpace,
      );
      const visibleHeight = Math.min(naturalHeight, availableHeight);
      const visualLeft = placeSide ? sideLeft : cardLeft;
      const visualTop = placeSide
        ? Math.min(
            Math.max(triggerBox.bottom + belowGap, surfaceTop),
            surfaceBottom - visibleHeight,
          )
        : placeAboveMenu
          ? newGameBox!.top - ABOVE_CARD_GAP - visibleHeight
        : placeAbove
          ? triggerBox.top - ABOVE_CARD_GAP - visibleHeight
          : triggerBox.bottom + belowGap;
      const historyPanel = historyPanelRef?.current;
      const historyBox = historyPanel?.getBoundingClientRect();
      const controls = [
        ...Array.from(menu?.querySelectorAll("button") ?? []),
        codeInput,
        submitBox ? codeForm?.querySelector('button[type="submit"]') : null,
      ]
        .filter((control): control is HTMLElement => control instanceof HTMLElement)
        .map((control) => control.getBoundingClientRect());
      const sidePlacement = historyBox
        ? [
            historyBox.left - CARD_GUTTER - cardWidth,
            historyBox.right + CARD_GUTTER,
          ]
            .filter(
              (left) => left >= surfaceLeft && left + cardWidth <= surfaceRight,
            )
            .map((left): SidePlacement | undefined => {
              const sideTop = Math.max(surfaceTop, historyBox.top);
              const sideBottom = Math.min(surfaceBottom, historyBox.bottom);
              const sideHeight = Math.min(naturalHeight, sideBottom - sideTop);
              const minimumSideHeight = Math.min(
                naturalHeight,
                MIN_USABLE_CARD_HEIGHT * scaleY,
              );
              if (sideHeight < minimumSideHeight) return undefined;

              const highestTop = sideBottom - sideHeight;
              const possibleTops = [
                sideTop,
                Math.min(
                  Math.max(sideTop, codeBottom + CARD_GUTTER),
                  highestTop,
                ),
                highestTop,
              ];
              const top = possibleTops.find(
                (candidateTop) =>
                  !controls.some((control) =>
                    overlaps(left, candidateTop, cardWidth, sideHeight, control),
                  ),
              );
              return top === undefined
                ? undefined
                : { left, maxHeight: sideHeight, top };
            })
            .filter((placement): placement is SidePlacement => placement !== undefined)
            .sort(
              (left, right) =>
                Math.abs(left.left - historyBox.left) -
                Math.abs(right.left - historyBox.left),
            )[0]
        : undefined;
      const historyCovered = Boolean(historyBox && !sidePlacement);
      onHistoryCovered?.(historyCovered);
      const finalLeft = sidePlacement?.left ?? visualLeft;
      const finalTop = sidePlacement?.top ?? visualTop;
      const finalHeight = sidePlacement?.maxHeight ?? visibleHeight;
      const nextLayout = {
        left: `${(finalLeft - wrapperBox.left) / scaleX}px`,
        maxHeight: `${finalHeight / scaleY}px`,
        top: `${(finalTop - wrapperBox.top) / scaleY}px`,
      };

      setLayout((current) =>
        current?.left === nextLayout.left &&
        current?.maxHeight === nextLayout.maxHeight &&
        current?.top === nextLayout.top
          ? current
          : nextLayout,
      );
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(card);
    observer.observe(wrapper);
    const historyPanel = historyPanelRef?.current;
    let historyPositionObserver: MutationObserver | undefined;
    if (historyPanel) {
      observer.observe(historyPanel);
      historyPositionObserver = new MutationObserver(updateLayout);
      historyPositionObserver.observe(historyPanel, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    window.visualViewport?.addEventListener("resize", updateLayout);
    window.visualViewport?.addEventListener("scroll", updateLayout);
    return () => {
      observer.disconnect();
      historyPositionObserver?.disconnect();
      onHistoryCovered?.(false);
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
      window.visualViewport?.removeEventListener("resize", updateLayout);
      window.visualViewport?.removeEventListener("scroll", updateLayout);
    };
  }, [facts, historyPanelRef, onHistoryCovered]);

  return (
    <section
      id="stored-hints-card"
      ref={cardRef}
      className={styles.card}
      aria-label="Stored hints"
      style={layout}
    >
      <h2>Stored hints</h2>
      <ul
        aria-label="Stored hint list"
        tabIndex={0}
        onKeyDown={scrollStoredHints}
      >
        {facts.map((fact) => (
          <li key={fact.id}>{factText(fact)}</li>
        ))}
      </ul>
    </section>
  );
}
