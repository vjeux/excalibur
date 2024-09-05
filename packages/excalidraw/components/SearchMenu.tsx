import { useEffect, useRef, useState } from "react";
import { CloseIcon, TextIcon, collapseDownIcon, upIcon } from "./icons";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { useApp, useExcalidrawSetAppState } from "./App";
import { debounce } from "lodash";
import type { AppClassProperties } from "../types";
import { isTextElement, newTextElement } from "../element";
import type { ExcalidrawTextElement } from "../element/types";
import { measureText } from "../element/textElement";
import { getFontString } from "../utils";
import { KEYS } from "../keys";

import "./SearchMenu.scss";
import clsx from "clsx";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import { t } from "../i18n";
import { isElementCompletelyInViewport } from "../element/sizeHelpers";
import React from "react";
import { randomInteger } from "../random";

const searchKeywordAtom = atom<string>("");
export const searchItemInFocusAtom = atom<number | null>(null);

const SEARCH_DEBOUNCE = 250;

type SearchMatchItem = {
  textElement: ExcalidrawTextElement;
  keyword: string;
  index: number;
  preview: {
    indexInKeyword: number;
    previewText: string;
    moreBefore: boolean;
    moreAfter: boolean;
  };
  matchedLines: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  }[];
};

type SearchMatches = {
  nonce: number | null;
  items: SearchMatchItem[];
};

export const SearchMenu = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [keyword, setKeyword] = useAtom(searchKeywordAtom, jotaiScope);
  const [searchMatches, setSearchMatches] = useState<SearchMatches>({
    nonce: null,
    items: [],
  });
  const searchedKeywordRef = useRef<string | null>();
  const lastSceneNonceRef = useRef<number | undefined>();

  const [focusIndex, setFocusIndex] = useAtom(
    searchItemInFocusAtom,
    jotaiScope,
  );
  const elementsMap = app.scene.getNonDeletedElementsMap();

  useEffect(() => {
    const trimmedKeyword = keyword.trim();
    if (
      trimmedKeyword !== searchedKeywordRef.current ||
      app.scene.getSceneNonce() !== lastSceneNonceRef.current
    ) {
      searchedKeywordRef.current = null;
      handleSearch(trimmedKeyword, app, (matchItems, index) => {
        setSearchMatches({
          nonce: randomInteger(),
          items: matchItems,
        });
        setFocusIndex(index);
        searchedKeywordRef.current = trimmedKeyword;
        lastSceneNonceRef.current = app.scene.getSceneNonce();
        setAppState({
          searchMatches: matchItems.map((searchMatch) => ({
            id: searchMatch.textElement.id,
            focus: false,
            matchedLines: searchMatch.matchedLines,
          })),
        });
      });
    }
  }, [
    keyword,
    elementsMap,
    app,
    setAppState,
    setFocusIndex,
    lastSceneNonceRef,
  ]);

  const goToNextItem = () => {
    if (searchMatches.items.length > 0) {
      setFocusIndex((focusIndex) => {
        if (focusIndex === null) {
          return 0;
        }

        return (focusIndex + 1) % searchMatches.items.length;
      });
    }
  };

  const goToPreviousItem = () => {
    if (searchMatches.items.length > 0) {
      setFocusIndex((focusIndex) => {
        if (focusIndex === null) {
          return 0;
        }

        return focusIndex - 1 < 0
          ? searchMatches.items.length - 1
          : focusIndex - 1;
      });
    }
  };

  useEffect(() => {
    if (searchMatches.items.length > 0 && focusIndex !== null) {
      const match = searchMatches.items[focusIndex];

      if (match) {
        const matchAsElement = newTextElement({
          text: match.keyword,
          x: match.textElement.x + (match.matchedLines[0]?.offsetX ?? 0),
          y: match.textElement.y + (match.matchedLines[0]?.offsetY ?? 0),
          width: match.matchedLines[0]?.width,
          height: match.matchedLines[0]?.height,
        });

        if (
          !isElementCompletelyInViewport(
            [matchAsElement],
            app.canvas.width / window.devicePixelRatio,
            app.canvas.height / window.devicePixelRatio,
            {
              offsetLeft: app.state.offsetLeft,
              offsetTop: app.state.offsetTop,
              scrollX: app.state.scrollX,
              scrollY: app.state.scrollY,
              zoom: app.state.zoom,
            },
            app.scene.getNonDeletedElementsMap(),
            app.getEditorUIOffsets(),
          )
        ) {
          app.scrollToContent(matchAsElement, {
            fitToContent: true,
            animate: true,
            duration: 300,
          });
        }

        const nextMatches = searchMatches.items.map((match, index) => {
          if (index === focusIndex) {
            return {
              id: match.textElement.id,
              focus: true,
              matchedLines: match.matchedLines,
            };
          }
          return {
            id: match.textElement.id,
            focus: false,
            matchedLines: match.matchedLines,
          };
        });

        setAppState({
          searchMatches: nextMatches,
        });
      }
    }
  }, [app, focusIndex, searchMatches, setAppState]);

  useEffect(() => {
    return () => {
      setFocusIndex(null);
      searchedKeywordRef.current = null;
      lastSceneNonceRef.current = undefined;
      setAppState({
        searchMatches: [],
      });
    };
  }, [setAppState, setFocusIndex]);

  useEffect(() => {
    const eventHandler = (event: KeyboardEvent) => {
      if (
        event[KEYS.CTRL_OR_CMD] &&
        event.key === KEYS.F &&
        document.activeElement !== searchInputRef.current
      ) {
        event.preventDefault();
        event.stopPropagation();

        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", eventHandler);

    return () => {
      window.removeEventListener("keydown", eventHandler);
    };
  }, []);

  const matchCount =
    searchMatches.items.length === 1
      ? t("search.singleResult")
      : `${searchMatches.items.length} ${t("search.multipleResults")}`;

  return (
    <div className="layer-ui__search">
      <div className="layer-ui__search-header">
        <div className="search-input">
          <TextField
            value={keyword}
            ref={searchInputRef}
            placeholder={t("search.placeholder")}
            onChange={(value) => {
              setKeyword(value);
            }}
            selectOnRender
            onKeyDown={(event) => {
              if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.F) {
                event.preventDefault();
                event.stopPropagation();

                setAppState({
                  openSidebar: null,
                });
                return;
              }

              if (searchMatches.items.length) {
                if (event.key === KEYS.ENTER) {
                  goToNextItem();
                }

                if (event.key === KEYS.ARROW_UP) {
                  goToPreviousItem();
                } else if (event.key === KEYS.ARROW_DOWN) {
                  goToNextItem();
                }
              }
            }}
          />
        </div>
        <Button
          onSelect={() => {
            setKeyword("");
          }}
          className="clear-btn"
        >
          {CloseIcon}
        </Button>
      </div>

      <div className="layer-ui__search-count">
        {searchMatches.items.length > 0 && (
          <>
            {focusIndex !== null ? (
              <div>
                {focusIndex + 1} / {matchCount}
              </div>
            ) : (
              <div>{matchCount}</div>
            )}
            <div className="result-nav">
              <Button
                onSelect={() => {
                  goToNextItem();
                }}
                className="result-nav-btn"
              >
                {collapseDownIcon}
              </Button>
              <Button
                onSelect={() => {
                  goToPreviousItem();
                }}
                className="result-nav-btn"
              >
                {upIcon}
              </Button>
            </div>
          </>
        )}

        {searchMatches.items.length === 0 &&
          keyword &&
          searchedKeywordRef.current && <div>{t("search.noMatch")}</div>}
      </div>

      <MatchList
        matches={searchMatches}
        onItemClick={setFocusIndex}
        focusIndex={focusIndex}
        trimmedKeyword={keyword.trim()}
      />
    </div>
  );
};

const ListItem = (props: {
  preview: SearchMatchItem["preview"];
  trimmedKeyword: string;
  highlighted: boolean;
  onClick?: () => void;
}) => {
  const preview = [
    props.preview.moreBefore ? "..." : "",
    props.preview.previewText.slice(0, props.preview.indexInKeyword),
    props.preview.previewText.slice(
      props.preview.indexInKeyword,
      props.preview.indexInKeyword + props.trimmedKeyword.length,
    ),
    props.preview.previewText.slice(
      props.preview.indexInKeyword + props.trimmedKeyword.length,
    ),
    props.preview.moreAfter ? "..." : "",
  ];

  return (
    <li
      className={clsx("layer-ui__result-item", {
        active: props.highlighted,
      })}
      onClick={props.onClick}
      ref={(ref) => {
        if (props.highlighted) {
          ref?.scrollIntoView();
        }
      }}
    >
      <div className="text-icon">{TextIcon}</div>
      <div
        className="preview-text"
        dangerouslySetInnerHTML={{
          __html: preview
            .map((text, index) => (index === 2 ? `<b>${text}</b>` : text))
            .join(""),
        }}
      ></div>
    </li>
  );
};

interface MatchListProps {
  matches: SearchMatches;
  onItemClick: (index: number) => void;
  focusIndex: number | null;
  trimmedKeyword: string;
}

const MatchListBase = (props: MatchListProps) => {
  return (
    <div className="layer-ui__search-result-container">
      <ul>
        {props.matches.items.map((searchMatch, index) => (
          <ListItem
            key={searchMatch.textElement.id + searchMatch.index}
            trimmedKeyword={props.trimmedKeyword}
            preview={searchMatch.preview}
            highlighted={index === props.focusIndex}
            onClick={() => props.onItemClick(index)}
          />
        ))}
      </ul>
    </div>
  );
};

const areEqual = (prevProps: MatchListProps, nextProps: MatchListProps) => {
  return (
    prevProps.matches.nonce === nextProps.matches.nonce &&
    prevProps.focusIndex === nextProps.focusIndex
  );
};

const MatchList = React.memo(MatchListBase, areEqual);

const getMatchPreview = (text: string, index: number, keyword: string) => {
  const WORDS_BEFORE = 2;
  const WORDS_AFTER = 5;

  const substrBeforeKeyword = text.slice(0, index);
  const wordsBeforeKeyword = substrBeforeKeyword.split(/\s+/);
  // text = "small", keyword = "mall", not complete before
  // text = "small", keyword = "smal", complete before
  const isKeywordCompleteBefore = substrBeforeKeyword.endsWith(" ");
  const startWordIndex =
    wordsBeforeKeyword.length -
    WORDS_BEFORE -
    1 -
    (isKeywordCompleteBefore ? 0 : 1);
  let wordsBeforeAsString =
    wordsBeforeKeyword
      .slice(startWordIndex <= 0 ? 0 : startWordIndex)
      .join(" ") + (isKeywordCompleteBefore ? " " : "");

  const MAX_ALLOWED_CHARS = 20;

  wordsBeforeAsString =
    wordsBeforeAsString.length > MAX_ALLOWED_CHARS
      ? wordsBeforeAsString.slice(-MAX_ALLOWED_CHARS)
      : wordsBeforeAsString;

  const substrAfterKeyword = text.slice(index + keyword.length);
  const wordsAfter = substrAfterKeyword.split(/\s+/);
  // text = "small", keyword = "mall", complete after
  // text = "small", keyword = "smal", not complete after
  const isKeywordCompleteAfter = !substrAfterKeyword.startsWith(" ");
  const numberOfWordsToTake = isKeywordCompleteAfter
    ? WORDS_AFTER + 1
    : WORDS_AFTER;
  const wordsAfterAsString =
    (isKeywordCompleteAfter ? "" : " ") +
    wordsAfter.slice(0, numberOfWordsToTake).join(" ");

  return {
    indexInKeyword: wordsBeforeAsString.length,
    previewText: wordsBeforeAsString + keyword + wordsAfterAsString,
    moreBefore: startWordIndex > 0,
    moreAfter: wordsAfter.length > numberOfWordsToTake,
  };
};

const normalizeWrappedText = (
  wrappedText: string,
  originalText: string,
): string => {
  const wrappedLines = wrappedText.split("\n");
  const normalizedLines: string[] = [];
  let originalIndex = 0;

  for (let i = 0; i < wrappedLines.length; i++) {
    let currentLine = wrappedLines[i];
    const nextLine = wrappedLines[i + 1];

    if (nextLine) {
      const nextLineIndexInOriginal = originalText.indexOf(
        nextLine,
        originalIndex,
      );

      if (nextLineIndexInOriginal > currentLine.length + originalIndex) {
        let j = nextLineIndexInOriginal - (currentLine.length + originalIndex);

        while (j > 0) {
          currentLine += " ";
          j--;
        }
      }
    }

    normalizedLines.push(currentLine);
    originalIndex = originalIndex + currentLine.length;
  }

  return normalizedLines.join("\n");
};

const getMatchedLines = (
  textElement: ExcalidrawTextElement,
  keyword: string,
  index: number,
) => {
  const normalizedText = normalizeWrappedText(
    textElement.text,
    textElement.originalText,
  );

  const lines = normalizedText.split("\n");

  const lineIndexRanges = [];
  let currentIndex = 0;
  let lineNumber = 0;

  for (const line of lines) {
    const startIndex = currentIndex;
    const endIndex = startIndex + line.length - 1;

    lineIndexRanges.push({
      line,
      startIndex,
      endIndex,
      lineNumber,
    });

    // Move to the next line's start index
    currentIndex = endIndex + 1;
    lineNumber++;
  }

  let startIndex = index;
  let remainingKeyword = textElement.originalText.slice(
    index,
    index + keyword.length,
  );
  const matchedLines: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  }[] = [];

  for (const lineIndexRange of lineIndexRanges) {
    if (remainingKeyword === "") {
      break;
    }

    if (
      startIndex >= lineIndexRange.startIndex &&
      startIndex <= lineIndexRange.endIndex
    ) {
      const matchCapacity = lineIndexRange.endIndex + 1 - startIndex;
      const textToStart = lineIndexRange.line.slice(
        0,
        startIndex - lineIndexRange.startIndex,
      );

      const matchedWord = remainingKeyword.slice(0, matchCapacity);
      remainingKeyword = remainingKeyword.slice(matchCapacity);

      const offset = measureText(
        textToStart,
        getFontString(textElement),
        textElement.lineHeight,
        true,
      );

      // measureText returns a non-zero width for the empty string
      // which is not what we're after here, hence the check and the correction
      if (textToStart === "") {
        offset.width = 0;
      }

      if (textElement.textAlign !== "left" && lineIndexRange.line.length > 0) {
        const lineLength = measureText(
          lineIndexRange.line,
          getFontString(textElement),
          textElement.lineHeight,
          true,
        );

        const spaceToStart =
          textElement.textAlign === "center"
            ? (textElement.width - lineLength.width) / 2
            : textElement.width - lineLength.width;
        offset.width += spaceToStart;
      }

      const { width, height } = measureText(
        matchedWord,
        getFontString(textElement),
        textElement.lineHeight,
      );

      const offsetX = offset.width;
      const offsetY = lineIndexRange.lineNumber * offset.height;

      matchedLines.push({
        offsetX,
        offsetY,
        width,
        height,
      });

      startIndex += matchCapacity;
    }
  }

  return matchedLines;
};

const sanitizeKeyword = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const handleSearch = debounce(
  (
    keyword: string,
    app: AppClassProperties,
    cb: (matchItems: SearchMatchItem[], focusIndex: number | null) => void,
  ) => {
    if (!keyword || keyword === "") {
      cb([], null);
      return;
    }

    const elements = app.scene.getNonDeletedElements();
    const texts = elements.filter((el) =>
      isTextElement(el),
    ) as ExcalidrawTextElement[];

    texts.sort((a, b) => a.y - b.y);

    const matchItems: SearchMatchItem[] = [];

    const safeKeyword = sanitizeKeyword(keyword);
    const regex = new RegExp(safeKeyword, "gi");

    for (const textEl of texts) {
      let match = null;
      const text = textEl.originalText;

      while ((match = regex.exec(text)) !== null) {
        const preview = getMatchPreview(text, match.index, keyword);
        const matchedLines = getMatchedLines(textEl, keyword, match.index);

        if (matchedLines.length > 0) {
          matchItems.push({
            textElement: textEl,
            keyword,
            preview,
            index: match.index,
            matchedLines,
          });
        }
      }
    }

    const focusIndex =
      matchItems.findIndex(
        (match) => match.textElement.id === app.visibleElements[0]?.id,
      ) ?? null;

    cb(matchItems, focusIndex);
  },
  SEARCH_DEBOUNCE,
);
