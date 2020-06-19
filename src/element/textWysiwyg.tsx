import { KEYS } from "../keys";
import { selectNode, isWritableElement, getFontString } from "../utils";
import { globalSceneState } from "../scene";
import { isTextElement } from "./typeChecks";
import { CLASSES } from "../constants";
import { TextAlign, VerticalAlign, ExcalidrawTextElement } from "./types";

const trimText = (text: string) => {
  // whitespace only → trim all because we'd end up inserting invisible element
  if (!text.trim()) {
    return "";
  }
  // replace leading/trailing newlines (only) otherwise it messes up bounding
  //  box calculation (there's also a bug in FF which inserts trailing newline
  //  for multiline texts)
  return text.replace(/^\n+|\n+$/g, "");
};

function getTransformOrigin(
  textAlign: TextAlign,
  verticalAlign: VerticalAlign,
) {
  const x =
    textAlign === "center" ? "50%" : textAlign === "right" ? "100%" : "0%";
  const y = verticalAlign === "middle" ? "50%" : "0%";
  return `${x} ${y}`;
}

function getTransform(
  textAlign: TextAlign,
  verticalAlign: VerticalAlign,
  angle: number,
  zoom: number,
) {
  const degree = (180 * angle) / Math.PI;

  return textAlign === "center"
    ? verticalAlign === "middle"
      ? `translate(-50%, -50%) scale(${zoom}) rotate(${degree}deg)`
      : `translateX(-50%) scale(${zoom}) rotate(${degree}deg)`
    : `scale(${zoom}) rotate(${degree}deg)`;
}

export const textWysiwyg = (
  element: ExcalidrawTextElement,
  {
    viewportX,
    viewportY,
    zoom,
    onChange,
    onSubmit,
    onCancel,
    getViewportCoords,
  }: {
    /** position override, else element.x is used */
    viewportX: number | null;
    /** position override, else elemeny.y is used */
    viewportY: number | null;
    zoom: number;
    onChange?: (text: string) => void;
    onSubmit: (text: string) => void;
    onCancel: () => void;
    getViewportCoords: (x: number, y: number) => [number, number];
  },
) => {
  const {
    id,
    x,
    y,
    text,
    width,
    height,
    strokeColor,
    fontSize,
    fontFamily,
    opacity,
    angle,
    textAlign,
    verticalAlign,
  } = element;

  function getPositions(element: {
    width: number;
    x: number;
    y: number;
    textAlign: TextAlign;
  }): { left: string; right: string; top: string } {
    if (viewportX != null && viewportY != null) {
      return {
        left: `${viewportX}px`,
        right: "auto",
        top: `${viewportY}px`,
      };
      // eslint-disable-next-line no-else-return
    } else {
      const [viewportX, viewportY] = getViewportCoords(element.x, element.y);

      const top =
        verticalAlign === "middle"
          ? `${viewportY + (height / 2) * zoom}px`
          : `${viewportY}px`;

      if (element.textAlign === "left") {
        return {
          top,
          left: `${viewportX}px`,
          right: "auto",
        };
      } else if (element.textAlign === "right") {
        return {
          top,
          left: "auto",
          right: `${window.innerWidth - viewportX - element.width * zoom}px`,
        };
      }

      return {
        top,
        left: `${viewportX + (element.width / 2) * zoom}px`,
        right: "auto",
      };
    }
  }

  const editable = document.createElement("div");
  try {
    editable.contentEditable = "plaintext-only";
  } catch {
    editable.contentEditable = "true";
  }
  editable.dir = "auto";
  editable.tabIndex = 0;
  editable.innerText = text;
  editable.dataset.type = "wysiwyg";

  const { left, right, top } = getPositions({ textAlign, x, y, width });

  Object.assign(editable.style, {
    color: strokeColor,
    position: "fixed",
    opacity: opacity / 100,
    top,
    left,
    right,
    transform: getTransform(textAlign, verticalAlign, angle, zoom),
    transformOrigin: getTransformOrigin(textAlign, verticalAlign),
    textAlign: textAlign,
    display: "inline-block",
    font: getFontString({ fontSize, fontFamily }),
    // This needs to have "1px solid" otherwise the carret doesn't show up
    // the first time on Safari and Chrome!
    outline: "1px solid transparent",
    whiteSpace: "nowrap",
    minHeight: "1em",
    backfaceVisibility: "hidden",
  });

  editable.onpaste = (event) => {
    try {
      const selection = window.getSelection();
      if (!selection?.rangeCount) {
        return;
      }
      selection.deleteFromDocument();

      const text = event.clipboardData!.getData("text").replace(/\r\n?/g, "\n");

      const span = document.createElement("span");
      span.innerText = text;
      const range = selection.getRangeAt(0);
      range.insertNode(span);

      // deselect
      window.getSelection()!.removeAllRanges();
      range.setStart(span, span.childNodes.length);
      range.setEnd(span, span.childNodes.length);
      selection.addRange(range);

      event.preventDefault();
    } catch (error) {
      console.error(error);
    }
  };

  if (onChange) {
    editable.oninput = () => {
      onChange(trimText(editable.innerText));
    };
  }

  editable.onkeydown = (event) => {
    if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      handleSubmit();
    } else if (event.key === KEYS.ENTER && !event.altKey) {
      event.stopPropagation();
    }
  };

  const stopEvent = (event: Event) => {
    event.stopPropagation();
  };

  const handleSubmit = () => {
    if (editable.innerText) {
      onSubmit(trimText(editable.innerText));
    } else {
      onCancel();
    }
    cleanup();
  };

  const cleanup = () => {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;
    // remove events to ensure they don't late-fire
    editable.onblur = null;
    editable.onpaste = null;
    editable.oninput = null;
    editable.onkeydown = null;

    window.removeEventListener("wheel", stopEvent, true);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", rebindBlur);
    window.removeEventListener("blur", handleSubmit);

    unbindUpdate();

    document.body.removeChild(editable);
  };

  const rebindBlur = () => {
    window.removeEventListener("pointerup", rebindBlur);
    // deferred to guard against focus traps on various UIs that steal focus
    //  upon pointerUp
    setTimeout(() => {
      editable.onblur = handleSubmit;
      // case: clicking on the same property → no change → no update → no focus
      editable.focus();
    });
  };

  // prevent blur when changing properties from the menu
  const onPointerDown = (event: MouseEvent) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) &&
      !isWritableElement(event.target)
    ) {
      editable.onblur = null;
      window.addEventListener("pointerup", rebindBlur);
      // handle edge-case where pointerup doesn't fire e.g. due to user
      //  alt-tabbing away
      window.addEventListener("blur", handleSubmit);
    }
  };

  // handle updates of textElement properties of editing element
  const unbindUpdate = globalSceneState.addCallback(() => {
    const editingElement = globalSceneState
      .getElementsIncludingDeleted()
      .find((element) => element.id === id);
    if (editingElement && isTextElement(editingElement)) {
      const { right, left } = getPositions(editingElement);
      const { textAlign, verticalAlign, angle } = editingElement;
      Object.assign(editable.style, {
        font: getFontString(editingElement),
        right,
        left,
        transformOrigin: getTransformOrigin(textAlign, verticalAlign),
        transform: getTransform(textAlign, verticalAlign, angle, zoom),
        textAlign: textAlign,
        color: editingElement.strokeColor,
        opacity: editingElement.opacity / 100,
      });
    }
    editable.focus();
  });

  let isDestroyed = false;

  editable.onblur = handleSubmit;
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("wheel", stopEvent, true);
  document.body.appendChild(editable);
  editable.focus();
  selectNode(editable);
};
