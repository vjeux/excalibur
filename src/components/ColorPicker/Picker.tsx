import React from "react";
import { getColorNameAndShadeFromHex, isTransparent } from "../../utils";
import { isArrowKey, KEYS } from "../../keys";
import { t, getLanguage } from "../../i18n";
import { isWritableElement } from "../../utils";
import { ExcalidrawElement } from "../../element/types";
import { ShadeList } from "./ShadeList";
import {
  getCustomColors,
  keyBindings,
  MAX_DEFAULT_COLORS,
  ocPalette,
} from "./ColorPicker";
import { ColorInput } from "./ColorInput";
import clsx from "clsx";

export const Picker = ({
  colors,
  color,
  onChange,
  onClose,
  label,
  showInput = true,
  type,
  elements,
}: {
  colors: string[];
  color: string | null;
  onChange: (color: string) => void;
  onClose: () => void;
  label: string;
  showInput: boolean;
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  elements: readonly ExcalidrawElement[];
}) => {
  const firstItem = React.useRef<HTMLButtonElement>();
  const activeItem = React.useRef<HTMLButtonElement>();
  const gallery = React.useRef<HTMLDivElement>();
  const colorInput = React.useRef<HTMLInputElement>();

  const [customColors] = React.useState(() => {
    if (type === "canvasBackground") {
      return [];
    }
    return getCustomColors(elements, type);
  });

  React.useEffect(() => {
    // After the component is first mounted focus on first input
    if (activeItem.current) {
      activeItem.current.focus();
    } else if (colorInput.current) {
      colorInput.current.focus();
    } else if (gallery.current) {
      gallery.current.focus();
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    let handled = false;
    if (isArrowKey(event.key)) {
      handled = true;
      const { activeElement } = document;
      const isRTL = getLanguage().rtl;
      let isCustom = false;
      let index = Array.prototype.indexOf.call(
        gallery.current!.querySelector(".color-picker-content--default")
          ?.children,
        activeElement,
      );
      if (index === -1) {
        index = Array.prototype.indexOf.call(
          gallery.current!.querySelector(".color-picker-content--canvas-colors")
            ?.children,
          activeElement,
        );
        if (index !== -1) {
          isCustom = true;
        }
      }
      const parentElement = isCustom
        ? gallery.current?.querySelector(".color-picker-content--canvas-colors")
        : gallery.current?.querySelector(".color-picker-content--default");

      if (parentElement && index !== -1) {
        const length = parentElement.children.length - (showInput ? 1 : 0);
        const nextIndex =
          event.key === (isRTL ? KEYS.ARROW_LEFT : KEYS.ARROW_RIGHT)
            ? (index + 1) % length
            : event.key === (isRTL ? KEYS.ARROW_RIGHT : KEYS.ARROW_LEFT)
            ? (length + index - 1) % length
            : !isCustom && event.key === KEYS.ARROW_DOWN
            ? (index + 5) % length
            : !isCustom && event.key === KEYS.ARROW_UP
            ? (length + index - 5) % length
            : index;
        (parentElement.children[nextIndex] as HTMLElement | undefined)?.focus();
      }
      event.preventDefault();
    } else if (
      keyBindings.includes(event.key.toLowerCase()) &&
      !event[KEYS.CTRL_OR_CMD] &&
      !event.altKey &&
      !isWritableElement(event.target)
    ) {
      handled = true;
      const index = keyBindings.indexOf(event.key.toLowerCase());
      const isCustom = index >= MAX_DEFAULT_COLORS;
      const parentElement = isCustom
        ? gallery?.current?.querySelector(
            ".color-picker-content--canvas-colors",
          )
        : gallery?.current?.querySelector(".color-picker-content--default");
      const actualIndex = isCustom ? index - MAX_DEFAULT_COLORS : index;
      (
        parentElement?.children[actualIndex] as HTMLElement | undefined
      )?.focus();

      event.preventDefault();
    } else if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      handled = true;
      event.preventDefault();
      onClose();
    }
    if (handled) {
      event.nativeEvent.stopImmediatePropagation();
      event.stopPropagation();
    }
  };

  const renderColors = (colors: Array<string>, custom: boolean = false) => {
    return colors.map((_color, i) => {
      const _colorWithoutHash = _color.replace("#", "");
      const keyBinding = custom
        ? keyBindings[i + MAX_DEFAULT_COLORS]
        : keyBindings[i];
      const label = custom
        ? _colorWithoutHash
        : t(`colors.${_colorWithoutHash}`);
      return (
        <button
          className="color-picker-swatch"
          onClick={(event) => {
            (event.currentTarget as HTMLButtonElement).focus();
            onChange(_color);
          }}
          title={`${label}${
            !isTransparent(_color) ? ` (${_color})` : ""
          } — ${keyBinding.toUpperCase()}`}
          aria-label={label}
          aria-keyshortcuts={keyBindings[i]}
          style={{ color: _color }}
          key={_color}
          ref={(el) => {
            if (!custom && el && i === 0) {
              firstItem.current = el;
            }
            if (el && _color === color) {
              activeItem.current = el;
            }
          }}
          onFocus={() => {
            onChange(_color);
          }}
        >
          {isTransparent(_color) ? (
            <div className="color-picker-transparent"></div>
          ) : undefined}
          <span className="color-picker-keybinding">{keyBinding}</span>
        </button>
      );
    });
  };

  const colorObj = getColorNameAndShadeFromHex({
    hex: color || "transparent",
    palette: ocPalette,
  });

  return (
    <div
      className={`color-picker color-picker-type-${type}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("labels.colorPicker")}
      onKeyDown={handleKeyDown}
    >
      <div className="color-picker-triangle color-picker-triangle-shadow"></div>
      <div className="color-picker-triangle"></div>
      <div
        className="color-picker-content"
        ref={(el) => {
          if (el) {
            gallery.current = el;
          }
        }}
        // to allow focusing by clicking but not by tabbing
        tabIndex={-1}
      >
        <div className="color-picker-content--default">
          {[["transparent", null], ...Object.entries(ocPalette)].map(
            ([key, value]) => {
              console.log(key, value);
              const color =
                (Array.isArray(value) ? value[3] : value) || "transparent";
              console.log("color", color);
              return (
                <button
                  type="button"
                  className={clsx(
                    "color-picker__button color-picker__button--large",
                    {
                      active:
                        (!colorObj && key === "transparent") ||
                        colorObj?.colorName === key,
                      "is-transparent": color === "transparent" || !color,
                      "with-border":
                        color === "#ffffff" ||
                        color === "transparent" ||
                        !color,
                    },
                  )}
                  onClick={(event) => {
                    (event.currentTarget as HTMLButtonElement).focus();
                    onChange(color);
                  }}
                  title={`${label} — ${key}`}
                  // title={`${label}${
                  //   !isTransparent(_color) ? ` (${_color})` : ""
                  // } — ${keyBinding.toUpperCase()}`}
                  aria-label={label}
                  // aria-keyshortcuts={keyBindings[i]}
                  style={color ? { "--swatch-color": color } : undefined}
                  key={key}
                ></button>
              );
            },
          )}
        </div>

        <div>shades</div>
        <ShadeList hex={color} onChange={onChange} />

        {!!customColors.length && (
          <div className="color-picker-content--canvas">
            <span className="color-picker-content--canvas-title">
              {t("labels.canvasColors")}
            </span>
            <div className="color-picker-content--canvas-colors">
              {renderColors(customColors, true)}
            </div>
          </div>
        )}

        {showInput && (
          <ColorInput
            color={color}
            label={label}
            onChange={(color) => {
              onChange(color);
            }}
            ref={colorInput}
          />
        )}
      </div>
    </div>
  );
};
