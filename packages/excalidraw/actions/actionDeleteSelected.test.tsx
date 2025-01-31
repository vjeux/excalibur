import React from "react";
import { Excalidraw, mutateElement } from "../index";
import { act, render } from "../tests/test-utils";
import { API } from "../tests/helpers/api";
import { actionDeleteSelected } from "./actionDeleteSelected";

const { h } = window;

describe("deleting selected elements when frame selected should keep children + select them", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("frame only", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });

    API.setElements([f1, r1]);

    API.setSelectedElements([f1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    expect(h.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: f1.id, isDeleted: true }),
        expect.objectContaining({ id: r1.id, isDeleted: false }),
      ]),
    );
    expect(h.state.selectedElementIds).toEqual({ [r1.id]: true });
  });

  it("frame + text container (text's frameId set)", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });

    const t1 = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      fontSize: 20,
      containerId: r1.id,
      frameId: f1.id,
    });

    mutateElement(r1, {
      boundElements: [{ type: "text", id: t1.id }],
    });

    API.setElements([f1, r1, t1]);

    API.setSelectedElements([f1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    expect(h.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: f1.id, isDeleted: true }),
        expect.objectContaining({ id: r1.id, isDeleted: false }),
        expect.objectContaining({ id: t1.id, isDeleted: false }),
      ]),
    );
    expect(h.state.selectedElementIds).toEqual({ [r1.id]: true });
  });

  it("frame + text container (text's frameId not set)", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });

    const t1 = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      fontSize: 20,
      containerId: r1.id,
      frameId: null,
    });

    mutateElement(r1, {
      boundElements: [{ type: "text", id: t1.id }],
    });

    API.setElements([f1, r1, t1]);

    API.setSelectedElements([f1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    expect(h.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: f1.id, isDeleted: true }),
        expect.objectContaining({ id: r1.id, isDeleted: false }),
        expect.objectContaining({ id: t1.id, isDeleted: false }),
      ]),
    );
    expect(h.state.selectedElementIds).toEqual({ [r1.id]: true });
  });

  it("frame + text container (text selected too)", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });

    const t1 = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      fontSize: 20,
      containerId: r1.id,
      frameId: null,
    });

    mutateElement(r1, {
      boundElements: [{ type: "text", id: t1.id }],
    });

    API.setElements([f1, r1, t1]);

    API.setSelectedElements([f1, t1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    expect(h.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: f1.id, isDeleted: true }),
        expect.objectContaining({ id: r1.id, isDeleted: false }),
        expect.objectContaining({ id: t1.id, isDeleted: false }),
      ]),
    );
    expect(h.state.selectedElementIds).toEqual({
      [r1.id]: true,
    });
  });

  it("frame + labeled arrow", async () => {
    const f1 = API.createElement({
      type: "frame",
    });

    const a1 = API.createElement({
      type: "arrow",
      frameId: f1.id,
    });

    const t1 = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      fontSize: 20,
      containerId: a1.id,
      frameId: null,
    });

    mutateElement(a1, {
      boundElements: [{ type: "text", id: t1.id }],
    });

    API.setElements([f1, a1, t1]);

    API.setSelectedElements([f1, t1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    expect(h.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: f1.id, isDeleted: true }),
        expect.objectContaining({ id: a1.id, isDeleted: false }),
        expect.objectContaining({ id: t1.id, isDeleted: false }),
      ]),
    );
    expect(h.state.selectedElementIds).toEqual({
      [a1.id]: true,
    });
  });

  it("frame + children selected", async () => {
    const f1 = API.createElement({
      type: "frame",
    });
    const r1 = API.createElement({
      type: "rectangle",
      frameId: f1.id,
    });
    API.setElements([f1, r1]);

    API.setSelectedElements([f1, r1]);

    act(() => {
      h.app.actionManager.executeAction(actionDeleteSelected);
    });

    expect(h.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: f1.id, isDeleted: true }),
        expect.objectContaining({ id: r1.id, isDeleted: false }),
      ]),
    );
    expect(h.state.selectedElementIds).toEqual({ [r1.id]: true });
  });
});
