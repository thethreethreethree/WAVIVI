"use client";

import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  /** Hold time in ms before the long-press fires. WhatsApp uses ~500ms. */
  delayMs?: number;
  /** Movement threshold in px — if the pointer moves further than this
   *  before the timer fires, the gesture is treated as a scroll/cancel. */
  moveCancelPx?: number;
}

interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * WhatsApp-style long-press detection.
 *
 * Fires `onLongPress` after the user holds for `delayMs` without moving
 * past `moveCancelPx`. Also suppresses the native right-click context
 * menu so the gesture is consistent across mouse + touch + pen.
 *
 * Returns props you spread onto the target element — the element must
 * already have a stable layout so the pointer origin can be measured.
 */
export function useLongPress(
  onLongPress: () => void,
  { delayMs = 500, moveCancelPx = 8 }: UseLongPressOptions = {},
): LongPressHandlers {
  const timer = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);

  const cancel = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      startX.current = e.clientX;
      startY.current = e.clientY;
      cancel();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        onLongPress();
      }, delayMs);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer.current == null) return;
      const dx = Math.abs(e.clientX - startX.current);
      const dy = Math.abs(e.clientY - startY.current);
      if (dx > moveCancelPx || dy > moveCancelPx) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
  };
}
