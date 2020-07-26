import React from "react";
import { ProjectName } from "../components/ProjectName";
import { saveAsJSON, loadFromJSON } from "../data";
import { load, save, saveAs } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { register } from "./register";
import { KEYS } from "../keys";

const muteFSAbortError = (error?: Error) => {
  // if user cancels, ignore the error
  if (error?.name === "AbortError") {
    return;
  }
  throw error;
};

export const actionChangeProjectName = register({
  name: "changeProjectName",
  perform: (_elements, appState, value) => {
    return { appState: { ...appState, name: value }, commitToHistory: false };
  },
  PanelComponent: ({ appState, updateData }) => (
    <ProjectName
      label={t("labels.fileTitle")}
      value={appState.name || "Unnamed"}
      onChange={(name: string) => updateData(name)}
    />
  ),
});

export const actionChangeExportBackground = register({
  name: "changeExportBackground",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportBackground: value },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <label>
      <input
        type="checkbox"
        checked={appState.exportBackground}
        onChange={(event) => updateData(event.target.checked)}
      />{" "}
      {t("labels.withBackground")}
    </label>
  ),
});

export const actionChangeShouldAddWatermark = register({
  name: "changeShouldAddWatermark",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, shouldAddWatermark: value },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <label>
      <input
        type="checkbox"
        checked={appState.shouldAddWatermark}
        onChange={(event) => updateData(event.target.checked)}
      />{" "}
      {t("labels.addWatermark")}
    </label>
  ),
});

export const actionSaveScene = register({
  name: "saveScene",
  perform: (elements, appState, value) => {
    saveAsJSON(elements, appState, (window as any).handle)
      .catch(muteFSAbortError)
      .catch((error) => console.error(error));
    return { commitToHistory: false };
  },
  keyTest: (event) => {
    return event.key === "s" && event[KEYS.CTRL_OR_CMD] && !event.shiftKey;
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={save}
      title={t("buttons.save")}
      aria-label={t("buttons.save")}
      showAriaLabel={useIsMobile()}
      onClick={() => updateData(null)}
    />
  ),
});

export const actionSaveAsScene = register({
  name: "saveAsScene",
  perform: (elements, appState, value) => {
    saveAsJSON(elements, appState, null)
      .catch(muteFSAbortError)
      .catch((error) => console.error(error));
    return { commitToHistory: false };
  },
  keyTest: (event) => {
    return event.key === "s" && event.shiftKey && event[KEYS.CTRL_OR_CMD];
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={saveAs}
      title={t("buttons.saveAs")}
      aria-label={t("buttons.saveAs")}
      showAriaLabel={useIsMobile()}
      hidden={!("chooseFileSystemEntries" in window)}
      onClick={() => updateData(null)}
    />
  ),
});

export const actionLoadScene = register({
  name: "loadScene",
  perform: (
    elements,
    appState,
    { elements: loadedElements, appState: loadedAppState, error },
  ) => {
    return {
      elements: loadedElements,
      appState: {
        ...loadedAppState,
        errorMessage: error,
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData, appState }) => (
    <ToolButton
      type="button"
      icon={load}
      title={t("buttons.load")}
      aria-label={t("buttons.load")}
      showAriaLabel={useIsMobile()}
      onClick={() => {
        loadFromJSON(appState)
          .then(({ elements, appState }) => {
            updateData({ elements: elements, appState: appState });
          })
          .catch(muteFSAbortError)
          .catch((error) => {
            updateData({ error: error.message });
          });
      }}
    />
  ),
});
