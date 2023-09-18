import {
  Bounds,
  getCommonBounds,
  getDraggedElementsBounds,
  getElementAbsoluteCoords,
} from "./element/bounds";
import { MaybeTransformHandleType } from "./element/transformHandles";
import { isBoundToContainer, isFrameElement } from "./element/typeChecks";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { getMaximumGroups } from "./groups";
import { KEYS } from "./keys";
import { rangeIntersection, rangesOverlap, rotatePoint } from "./math";
import { getVisibleAndNonSelectedElements } from "./scene/selection";
import { AppState, Point } from "./types";

// handle floating point errors
export const SNAP_PRECISION = 0.01;

const SNAP_DISTANCE = 8;

// snap distance with zoom value taken into consideration
export const getSnapDistance = (zoomValue: number) => {
  return SNAP_DISTANCE / zoomValue;
};

type Vector2D = {
  x: number;
  y: number;
};

type PointPair = [Point, Point];

export type PointSnap = {
  type: "point";
  points: PointPair;
  offset: number;
};

export type Gap = {
  //  start side ↓     length
  // ┌───────────┐◄───────────────►
  // │           │-----------------┌───────────┐
  // │  start    │       ↑         │           │
  // │  element  │    overlap      │  end      │
  // │           │       ↓         │  element  │
  // └───────────┘-----------------│           │
  //                               └───────────┘
  //                               ↑ end side

  // startElement: ExcalidrawElement;
  // endElement: ExcalidrawElement;
  startBounds: Bounds;
  endBounds: Bounds;
  startSide: [Point, Point];
  endSide: [Point, Point];
  overlap: [number, number];
  length: number;
};

export type GapSnap = {
  type: "gap";
  direction:
    | "center_horizontal"
    | "center_vertical"
    | "side_left"
    | "side_right"
    | "side_top"
    | "side_bottom";
  gap: Gap;
  offset: number;
};

export type GapSnaps = GapSnap[];

export type Snap = GapSnap | PointSnap;
export type Snaps = Snap[];

export type PointSnapLine = {
  type: "points";
  points: PointPair;
};

export type PointerSnapLine = {
  type: "pointer";
  points: PointPair;
  direction: "horizontal" | "vertical";
};

export type GapSnapLine = {
  type: "gap";
  direction: "horizontal" | "vertical";
  points: [PointPair, PointPair];
};

export type SnapLine = PointSnapLine | GapSnapLine | PointerSnapLine;

export type MaybeSnapEvent =
  | PointerEvent
  | MouseEvent
  | KeyboardEvent
  | React.PointerEvent<HTMLCanvasElement>
  | React.PointerEvent<HTMLElement>
  | false;

export const isSnappingEnabled = ({
  event,
  appState,
  selectedElements,
}: {
  appState: AppState;
  event: MaybeSnapEvent;
  selectedElements: NonDeletedExcalidrawElement[];
}) => {
  if (event) {
    return (
      (appState.objectsSnapModeEnabled && !event[KEYS.CTRL_OR_CMD]) ||
      (!appState.objectsSnapModeEnabled && event[KEYS.CTRL_OR_CMD])
    );
  }

  // do not suggest snaps for an arrow to give way to binding
  if (selectedElements.length === 1 && selectedElements[0].type === "arrow") {
    return false;
  }
  return appState.objectsSnapModeEnabled;
};

export const areRoughlyEqual = (
  a: number,
  b: number,
  precision = SNAP_PRECISION,
) => {
  return Math.abs(a - b) <= precision;
};

export const getElementsCorners = (
  elements: ExcalidrawElement[],
  {
    omitCenter,
    boundingBoxCorners,
    dragOffset,
  }: {
    omitCenter?: boolean;
    boundingBoxCorners?: boolean;
    dragOffset?: Vector2D;
  } = {
    omitCenter: false,
    boundingBoxCorners: false,
  },
): Point[] => {
  if (elements.length === 1) {
    const element = elements[0];

    let [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(element);

    if (dragOffset) {
      x1 += dragOffset.x;
      x2 += dragOffset.x;
      cx += dragOffset.x;

      y1 += dragOffset.y;
      y2 += dragOffset.y;
      cy += dragOffset.y;
    }

    const halfWidth = (x2 - x1) / 2;
    const halfHeight = (y2 - y1) / 2;

    if (
      (element.type === "diamond" || element.type === "ellipse") &&
      !boundingBoxCorners
    ) {
      const leftMid = rotatePoint(
        [x1, y1 + halfHeight],
        [cx, cy],
        element.angle,
      );
      const topMid = rotatePoint([x1 + halfWidth, y1], [cx, cy], element.angle);
      const rightMid = rotatePoint(
        [x2, y1 + halfHeight],
        [cx, cy],
        element.angle,
      );
      const bottomMid = rotatePoint(
        [x1 + halfWidth, y2],
        [cx, cy],
        element.angle,
      );
      const center: Point = [cx, cy];

      return omitCenter
        ? [leftMid, topMid, rightMid, bottomMid]
        : [leftMid, topMid, rightMid, bottomMid, center];
    }

    const topLeft = rotatePoint([x1, y1], [cx, cy], element.angle);
    const topRight = rotatePoint([x2, y1], [cx, cy], element.angle);
    const bottomLeft = rotatePoint([x1, y2], [cx, cy], element.angle);
    const bottomRight = rotatePoint([x2, y2], [cx, cy], element.angle);
    const center: Point = [cx, cy];

    return omitCenter
      ? [topLeft, topRight, bottomLeft, bottomRight]
      : [topLeft, topRight, bottomLeft, bottomRight, center];
  }

  if (elements.length > 1) {
    const [minX, minY, maxX, maxY] = getDraggedElementsBounds(
      elements,
      dragOffset ?? { x: 0, y: 0 },
    );
    const width = maxX - minX;
    const height = maxY - minY;

    const topLeft: Point = [minX, minY];
    const topRight: Point = [maxX, minY];
    const bottomLeft: Point = [minX, maxY];
    const bottomRight: Point = [maxX, maxY];
    const center: Point = [minX + width / 2, minY + height / 2];

    return omitCenter
      ? [topLeft, topRight, bottomLeft, bottomRight]
      : [topLeft, topRight, bottomLeft, bottomRight, center];
  }

  return [];
};

const getReferenceElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElements: NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const selectedFrames = selectedElements
    .filter((element) => isFrameElement(element))
    .map((frame) => frame.id);

  return getVisibleAndNonSelectedElements(
    elements,
    selectedElements,
    appState,
  ).filter(
    (element) => !(element.frameId && selectedFrames.includes(element.frameId)),
  );
};

export const getVisibleGaps = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElements: ExcalidrawElement[],
  appState: AppState,
) => {
  const referenceElements: ExcalidrawElement[] = getReferenceElements(
    elements,
    selectedElements,
    appState,
  );

  const referenceBounds = getMaximumGroups(referenceElements)
    .filter(
      (elementsGroup) =>
        !(elementsGroup.length === 1 && isBoundToContainer(elementsGroup[0])),
    )
    .map((group) => getCommonBounds(group));

  const horizontallySorted = referenceBounds.sort((a, b) => a[0] - b[0]);

  const horizontalGaps: Gap[] = [];

  for (let i = 0; i < horizontallySorted.length; i++) {
    const startBounds = horizontallySorted[i];

    for (let j = i + 1; j < horizontallySorted.length; j++) {
      const endBounds = horizontallySorted[j];

      const [, startMinY, startMaxX, startMaxY] = startBounds;
      const [endMinX, endMinY, , endMaxY] = endBounds;

      if (
        startMaxX < endMinX &&
        rangesOverlap([startMinY, startMaxY], [endMinY, endMaxY])
      ) {
        horizontalGaps.push({
          startBounds,
          endBounds,
          startSide: [
            [startMaxX, startMinY],
            [startMaxX, startMaxY],
          ],
          endSide: [
            [endMinX, endMinY],
            [endMinX, endMaxY],
          ],
          length: endMinX - startMaxX,
          overlap: rangeIntersection(
            [startMinY, startMaxY],
            [endMinY, endMaxY],
          )!,
        });
      }
    }
  }

  const verticallySorted = referenceBounds.sort((a, b) => a[1] - b[1]);

  const verticalGaps: Gap[] = [];

  for (let i = 0; i < verticallySorted.length; i++) {
    const startBounds = verticallySorted[i];

    for (let j = i + 1; j < verticallySorted.length; j++) {
      const endBounds = verticallySorted[j];

      const [startMinX, , startMaxX, startMaxY] = startBounds;
      const [endMinX, endMinY, endMaxX] = endBounds;

      if (
        startMaxY < endMinY &&
        rangesOverlap([startMinX, startMaxX], [endMinX, endMaxX])
      ) {
        verticalGaps.push({
          startBounds,
          endBounds,
          startSide: [
            [startMinX, startMaxY],
            [startMaxX, startMaxY],
          ],
          endSide: [
            [endMinX, endMinY],
            [endMaxX, endMinY],
          ],
          length: endMinY - startMaxY,
          overlap: rangeIntersection(
            [startMinX, startMaxX],
            [endMinX, endMaxX],
          )!,
        });
      }
    }
  }

  return {
    horizontalGaps,
    verticalGaps,
  };
};

export const getGapSnaps = (
  selectedElements: ExcalidrawElement[],
  dragOffset: Vector2D,
  appState: AppState,
  event: MaybeSnapEvent,
  neartestSnapsX: Snaps,
  neartestSnapsY: Snaps,
  minOffset: Vector2D,
) => {
  if (!isSnappingEnabled({ appState, event, selectedElements })) {
    return [];
  }

  if (selectedElements.length === 0) {
    return [];
  }

  if (appState.visibleGaps) {
    const { horizontalGaps, verticalGaps } = appState.visibleGaps;

    const [minX, minY, maxX, maxY] = getDraggedElementsBounds(
      selectedElements,
      dragOffset,
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    for (const gap of horizontalGaps) {
      if (!rangesOverlap([minY, maxY], gap.overlap)) {
        continue;
      }

      // center gap
      const gapMidX = gap.startSide[0][0] + gap.length / 2;
      const centerOffset = gapMidX - centerX;
      const gapIsLargerThanSelection = gap.length > maxX - minX;

      if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset.x) {
        if (Math.abs(centerOffset) < minOffset.x) {
          neartestSnapsX.length = 0;
        }
        minOffset.x = Math.abs(centerOffset);

        const snap: GapSnap = {
          type: "gap",
          direction: "center_horizontal",
          gap,
          offset: centerOffset,
        };

        neartestSnapsX.push(snap);
        continue;
      }

      // side gap, from the right
      const [, , endMaxX] = gap.endBounds;
      const distanceToEndElementX = minX - endMaxX;
      const sideOffsetRight = gap.length - distanceToEndElementX;

      if (Math.abs(sideOffsetRight) <= minOffset.x) {
        if (Math.abs(sideOffsetRight) < minOffset.x) {
          neartestSnapsX.length = 0;
        }
        minOffset.x = Math.abs(sideOffsetRight);

        const snap: GapSnap = {
          type: "gap",
          direction: "side_right",
          gap,
          offset: sideOffsetRight,
        };
        neartestSnapsX.push(snap);
        continue;
      }

      // side gap, from the left
      const [startMinX, , ,] = gap.startBounds;
      const distanceToStartElementX = startMinX - maxX;
      const sideOffsetLeft = distanceToStartElementX - gap.length;

      if (Math.abs(sideOffsetLeft) <= minOffset.x) {
        if (Math.abs(sideOffsetLeft) < minOffset.x) {
          neartestSnapsX.length = 0;
        }
        minOffset.x = Math.abs(sideOffsetLeft);

        const snap: GapSnap = {
          type: "gap",
          direction: "side_left",
          gap,
          offset: sideOffsetLeft,
        };
        neartestSnapsX.push(snap);
        continue;
      }
    }

    for (const gap of verticalGaps) {
      if (!rangesOverlap([minX, maxX], gap.overlap)) {
        continue;
      }

      // center gap
      const gapMidY = gap.startSide[0][1] + gap.length / 2;
      const centerOffset = gapMidY - centerY;
      const gapIsLargerThanSelection = gap.length > maxY - minY;

      if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset.y) {
        if (Math.abs(centerOffset) < minOffset.y) {
          neartestSnapsY.length = 0;
        }
        minOffset.y = Math.abs(centerOffset);

        const snap: GapSnap = {
          type: "gap",
          direction: "center_vertical",
          gap,
          offset: centerOffset,
        };

        neartestSnapsY.push(snap);
        continue;
      }

      // side gap, from the top
      const [, startMinY, ,] = gap.startBounds;
      const distanceToStartElementY = startMinY - maxY;
      const sideOffsetTop = distanceToStartElementY - gap.length;

      if (Math.abs(sideOffsetTop) <= minOffset.y) {
        if (Math.abs(sideOffsetTop) < minOffset.y) {
          neartestSnapsY.length = 0;
        }
        minOffset.y = Math.abs(sideOffsetTop);

        const snap: GapSnap = {
          type: "gap",
          direction: "side_top",
          gap,
          offset: sideOffsetTop,
        };
        neartestSnapsY.push(snap);
        continue;
      }

      // side gap, from the bottom
      const [, , , endMaxY] = gap.endBounds;
      const distanceToEndElementY = minY - endMaxY;
      const sideOffsetBottom = gap.length - distanceToEndElementY;

      if (Math.abs(sideOffsetBottom) <= minOffset.y) {
        if (Math.abs(sideOffsetBottom) < minOffset.y) {
          neartestSnapsY.length = 0;
        }
        minOffset.y = Math.abs(sideOffsetBottom);

        const snap: GapSnap = {
          type: "gap",
          direction: "side_bottom",
          gap,
          offset: sideOffsetBottom,
        };
        neartestSnapsY.push(snap);
        continue;
      }
    }
  }
};

export const getPointSnaps = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElements: ExcalidrawElement[],
  selectionSnapPoints: Point[],
  appState: AppState,
  event: MaybeSnapEvent,
  neartestSnapsX: Snaps,
  neartestSnapsY: Snaps,
  minOffset: Vector2D,
) => {
  if (
    !isSnappingEnabled({ appState, event, selectedElements }) ||
    (selectedElements.length === 0 && selectionSnapPoints.length === 0)
  ) {
    return [];
  }

  const referenceElements = getReferenceElements(
    elements,
    selectedElements,
    appState,
  );

  const referenceSnapPoints = getMaximumGroups(referenceElements)
    .filter(
      (elementsGroup) =>
        !(elementsGroup.length === 1 && isBoundToContainer(elementsGroup[0])),
    )
    .flatMap((elementGroup) => getElementsCorners(elementGroup));

  for (const thisSnapPoint of selectionSnapPoints) {
    for (const otherSnapPoint of referenceSnapPoints) {
      const offsetX = otherSnapPoint[0] - thisSnapPoint[0];
      const offsetY = otherSnapPoint[1] - thisSnapPoint[1];

      if (Math.abs(offsetX) <= minOffset.x) {
        if (Math.abs(offsetX) < minOffset.x) {
          neartestSnapsX.length = 0;
        }

        neartestSnapsX.push({
          type: "point",
          points: [thisSnapPoint, otherSnapPoint],
          offset: offsetX,
        });

        minOffset.x = Math.abs(offsetX);
      }

      if (Math.abs(offsetY) <= minOffset.y) {
        if (Math.abs(offsetY) < minOffset.y) {
          neartestSnapsY.length = 0;
        }

        neartestSnapsY.push({
          type: "point",
          points: [thisSnapPoint, otherSnapPoint],
          offset: offsetY,
        });

        minOffset.y = Math.abs(offsetY);
      }
    }
  }
};

export const snapDraggedElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElements: ExcalidrawElement[],
  dragOffset: Vector2D,
  appState: AppState,
  event: MaybeSnapEvent,
) => {
  const neartestSnapsX: Snaps = [];
  const neartestSnapsY: Snaps = [];
  const snapDistance = getSnapDistance(appState.zoom.value);
  const minOffset = {
    x: snapDistance,
    y: snapDistance,
  };

  const selectionPoints = getElementsCorners(selectedElements, {
    dragOffset,
  });

  // get the nearest horizontal and vertical point and gap snaps
  getPointSnaps(
    elements,
    selectedElements,
    selectionPoints,
    appState,
    event,
    neartestSnapsX,
    neartestSnapsY,
    minOffset,
  );

  getGapSnaps(
    selectedElements,
    dragOffset,
    appState,
    event,
    neartestSnapsX,
    neartestSnapsY,
    minOffset,
  );

  // using the neartest snaps to figure out how
  // much the elements need to be offset to be snapped
  // to some reference elements
  const snapOffset = {
    x: neartestSnapsX[0]?.offset ?? 0,
    y: neartestSnapsY[0]?.offset ?? 0,
  };

  // once the elements are snapped
  // and moved to the snapped position
  // we want to use the element's snapped position
  // to update nearest snaps so that we can create
  // point and gap snap lines correctly without any shifting
  minOffset.x = SNAP_PRECISION;
  minOffset.y = SNAP_PRECISION;
  neartestSnapsX.length = 0;
  neartestSnapsY.length = 0;
  const newDragOffset = {
    x: dragOffset.x + snapOffset.x,
    y: dragOffset.y + snapOffset.y,
  };

  getPointSnaps(
    elements,
    selectedElements,
    getElementsCorners(selectedElements, {
      dragOffset: newDragOffset,
    }),
    appState,
    event,
    neartestSnapsX,
    neartestSnapsY,
    minOffset,
  );

  getGapSnaps(
    selectedElements,
    newDragOffset,
    appState,
    event,
    neartestSnapsX,
    neartestSnapsY,
    minOffset,
  );

  const snaps = [...neartestSnapsX, ...neartestSnapsY];

  const pointSnapLines = createPointSnapLines(
    snaps.filter((snap) => snap.type === "point") as PointSnap[],
  );
  const gapSnapLines = createGapSnapLines(
    selectedElements,
    newDragOffset,
    snaps.filter((snap) => snap.type === "gap") as GapSnap[],
  );

  return {
    snapOffset,
    snapLines: [...pointSnapLines, ...gapSnapLines],
  };
};

const createPointSnapLines = (pointSnaps: PointSnap[]): PointSnapLine[] => {
  return pointSnaps.map((pointSnap) => ({
    type: "points",
    points: pointSnap.points,
  }));
};

const createGapSnapLines = (
  selectedElements: ExcalidrawElement[],
  dragOffset: Vector2D,
  gapSnaps: GapSnap[],
): GapSnapLine[] => {
  const [minX, minY, maxX, maxY] = getDraggedElementsBounds(
    selectedElements,
    dragOffset,
  );

  const gapSnapLines: GapSnapLine[] = [];

  for (const gapSnap of gapSnaps) {
    const [startMinX, startMinY, startMaxX, startMaxY] =
      gapSnap.gap.startBounds;
    const [endMinX, endMinY, endMaxX, endMaxY] = gapSnap.gap.endBounds;

    const verticalIntersection = rangeIntersection(
      [minY, maxY],
      gapSnap.gap.overlap,
    );

    const horizontalGapIntersection = rangeIntersection(
      [minX, maxX],
      gapSnap.gap.overlap,
    );

    switch (gapSnap.direction) {
      case "center_horizontal": {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          gapSnapLines.push({
            type: "gap",
            direction: "horizontal",
            points: [
              [
                [gapSnap.gap.startSide[0][0], gapLineY],
                [minX, gapLineY],
              ],
              [
                [maxX, gapLineY],
                [gapSnap.gap.endSide[0][0], gapLineY],
              ],
            ],
          });
        }
        break;
      }
      case "center_vertical": {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          gapSnapLines.push({
            type: "gap",
            direction: "vertical",
            points: [
              [
                [gapLineX, gapSnap.gap.startSide[0][1]],
                [gapLineX, minY],
              ],
              [
                [gapLineX, maxY],
                [gapLineX, gapSnap.gap.endSide[0][1]],
              ],
            ],
          });
        }
        break;
      }
      case "side_right": {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          gapSnapLines.push({
            type: "gap",
            direction: "horizontal",
            points: [
              [
                [startMaxX, gapLineY],
                [endMinX, gapLineY],
              ],
              [
                [endMaxX, gapLineY],
                [minX, gapLineY],
              ],
            ],
          });
        }
        break;
      }
      case "side_left": {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          gapSnapLines.push({
            type: "gap",
            direction: "horizontal",
            points: [
              [
                [maxX, gapLineY],
                [startMinX, gapLineY],
              ],
              [
                [startMaxX, gapLineY],
                [endMinX, gapLineY],
              ],
            ],
          });
        }
        break;
      }
      case "side_top": {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          gapSnapLines.push({
            type: "gap",
            direction: "vertical",
            points: [
              [
                [gapLineX, maxY],
                [gapLineX, startMinY],
              ],
              [
                [gapLineX, startMaxY],
                [gapLineX, endMinY],
              ],
            ],
          });
        }
        break;
      }
      case "side_bottom": {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          gapSnapLines.push({
            type: "gap",
            direction: "vertical",
            points: [
              [
                [gapLineX, startMaxY],
                [gapLineX, endMinY],
              ],
              [
                [gapLineX, endMaxY],
                [gapLineX, minY],
              ],
            ],
          });
        }
        break;
      }
    }
  }

  return gapSnapLines;
};

export const snapResizingElements = (
  elements: ExcalidrawElement[],
  // use the latest elements to create snap lines
  selectedElements: ExcalidrawElement[],
  // while using the original elements to appy dragOffset to calculate snaps
  selectedOriginalElements: ExcalidrawElement[],
  appState: AppState,
  event: MaybeSnapEvent,
  dragOffset: Vector2D,
  transformHandle: MaybeTransformHandleType,
) => {
  if (
    !isSnappingEnabled({ event, selectedElements, appState }) ||
    selectedElements.length === 0 ||
    (selectedElements.length === 1 &&
      !areRoughlyEqual(selectedElements[0].angle, 0))
  ) {
    return {
      snapOffset: { x: 0, y: 0 },
      snapLines: [],
    };
  }

  let [minX, minY, maxX, maxY] = getCommonBounds(selectedOriginalElements);

  if (transformHandle) {
    if (transformHandle.includes("e")) {
      maxX += dragOffset.x;
    } else if (transformHandle.includes("w")) {
      minX += dragOffset.x;
    }

    if (transformHandle.includes("n")) {
      minY += dragOffset.y;
    } else if (transformHandle.includes("s")) {
      maxY += dragOffset.y;
    }
  }

  const selectionSnapPoints: Point[] = [];

  if (transformHandle) {
    switch (transformHandle) {
      case "e": {
        selectionSnapPoints.push([maxX, minY], [maxX, maxY]);
        break;
      }
      case "w": {
        selectionSnapPoints.push([minX, minY], [minX, maxY]);
        break;
      }
      case "n": {
        selectionSnapPoints.push([minX, minY], [maxX, minY]);
        break;
      }
      case "s": {
        selectionSnapPoints.push([minX, maxY], [maxX, maxY]);
        break;
      }
      case "ne": {
        selectionSnapPoints.push([maxX, minY]);
        break;
      }
      case "nw": {
        selectionSnapPoints.push([minX, minY]);
        break;
      }
      case "se": {
        selectionSnapPoints.push([maxX, maxY]);
        break;
      }
      case "sw": {
        selectionSnapPoints.push([minX, maxY]);
        break;
      }
    }
  }

  const snapDistance = getSnapDistance(appState.zoom.value);

  const minOffset = {
    x: snapDistance,
    y: snapDistance,
  };

  const neartestSnapsX: Snaps = [];
  const neartestSnapsY: Snaps = [];

  getPointSnaps(
    elements,
    selectedOriginalElements,
    selectionSnapPoints,
    appState,
    event,
    neartestSnapsX,
    neartestSnapsY,
    minOffset,
  );

  const snapOffset = {
    x: neartestSnapsX[0]?.offset ?? 0,
    y: neartestSnapsY[0]?.offset ?? 0,
  };

  // again, once snap offset is calculated
  // reset to recompute for creating snap lines to be rendered
  minOffset.x = SNAP_PRECISION;
  minOffset.y = SNAP_PRECISION;
  neartestSnapsX.length = 0;
  neartestSnapsY.length = 0;

  const [x1, y1, x2, y2] = getCommonBounds(selectedElements);

  const corners: Point[] = [
    [x1, y1],
    [x1, y2],
    [x2, y1],
    [x2, y2],
  ];

  getPointSnaps(
    elements,
    selectedElements,
    corners,
    appState,
    event,
    neartestSnapsX,
    neartestSnapsY,
    minOffset,
  );

  const pointSnapLines = createPointSnapLines(
    [...neartestSnapsX, ...neartestSnapsY].filter(
      (snap) => snap.type === "point",
    ) as PointSnap[],
  );

  return {
    snapOffset,
    snapLines: pointSnapLines,
  };
};

export const snapNewElement = (
  elements: readonly ExcalidrawElement[],
  draggingElement: ExcalidrawElement,
  appState: AppState,
  event: MaybeSnapEvent,
  origin: Vector2D,
  dragOffset: Vector2D,
) => {
  if (
    !isSnappingEnabled({ event, selectedElements: [draggingElement], appState })
  ) {
    return {
      snapOffset: { x: 0, y: 0 },
      snapLines: [],
    };
  }

  const selectionSnapPoints: Point[] = [
    [origin.x + dragOffset.x, origin.y + dragOffset.y],
  ];

  const snapDistance = getSnapDistance(appState.zoom.value);

  const minOffset = {
    x: snapDistance,
    y: snapDistance,
  };

  const neartestSnapsX: Snaps = [];
  const neartestSnapsY: Snaps = [];

  getPointSnaps(
    elements,
    [draggingElement],
    selectionSnapPoints,
    appState,
    event,
    neartestSnapsX,
    neartestSnapsY,
    minOffset,
  );

  const snapOffset = {
    x: neartestSnapsX[0]?.offset ?? 0,
    y: neartestSnapsY[0]?.offset ?? 0,
  };

  minOffset.x = SNAP_PRECISION;
  minOffset.y = SNAP_PRECISION;
  neartestSnapsX.length = 0;
  neartestSnapsY.length = 0;

  const corners = getElementsCorners([draggingElement], {
    boundingBoxCorners: true,
    omitCenter: true,
  });

  getPointSnaps(
    elements,
    [draggingElement],
    corners,
    appState,
    event,
    neartestSnapsX,
    neartestSnapsY,
    minOffset,
  );

  const pointSnapLines = createPointSnapLines(
    [...neartestSnapsX, ...neartestSnapsY].filter(
      (snap) => snap.type === "point",
    ) as PointSnap[],
  );

  return {
    snapOffset,
    snapLines: pointSnapLines,
  };
};

export const getSnapLinesAtPointer = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  pointer: Vector2D,
  event: MaybeSnapEvent,
) => {
  if (!isSnappingEnabled({ event, selectedElements: [], appState })) {
    return {
      originOffset: { x: 0, y: 0 },
      snapLines: [],
    };
  }

  const referenceElements = getVisibleAndNonSelectedElements(
    elements,
    [],
    appState,
  );

  const snapDistance = getSnapDistance(appState.zoom.value);

  const minOffset = {
    x: snapDistance,
    y: snapDistance,
  };

  const horizontalSnapLines: PointerSnapLine[] = [];
  const verticalSnapLines: PointerSnapLine[] = [];

  for (const referenceElement of referenceElements) {
    const corners = getElementsCorners([referenceElement]);

    for (const corner of corners) {
      const offsetX = corner[0] - pointer.x;

      if (Math.abs(offsetX) <= Math.abs(minOffset.x)) {
        if (Math.abs(offsetX) < Math.abs(minOffset.x)) {
          verticalSnapLines.length = 0;
        }

        verticalSnapLines.push({
          type: "pointer",
          points: [corner, [corner[0], pointer.y]],
          direction: "vertical",
        });

        minOffset.x = offsetX;
      }

      const offsetY = corner[1] - pointer.y;

      if (Math.abs(offsetY) <= Math.abs(minOffset.y)) {
        if (Math.abs(offsetY) < Math.abs(minOffset.y)) {
          horizontalSnapLines.length = 0;
        }

        horizontalSnapLines.push({
          type: "pointer",
          points: [corner, [pointer.x, corner[1]]],
          direction: "horizontal",
        });

        minOffset.y = offsetY;
      }
    }
  }

  return {
    originOffset: {
      x:
        verticalSnapLines.length > 0
          ? verticalSnapLines[0].points[0][0] - pointer.x
          : 0,
      y:
        horizontalSnapLines.length > 0
          ? horizontalSnapLines[0].points[0][1] - pointer.y
          : 0,
    },
    snapLines: [...verticalSnapLines, ...horizontalSnapLines],
  };
};

export const isActiveToolNonLinearSnappable = (
  activeToolType: AppState["activeTool"]["type"],
) => {
  return (
    activeToolType === "rectangle" ||
    activeToolType === "ellipse" ||
    activeToolType === "diamond" ||
    activeToolType === "frame" ||
    activeToolType === "image"
  );
};
