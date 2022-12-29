import React from "react";
import { AppState, Device, ExcalidrawProps } from "../types";
import { ActionManager } from "../actions/manager";
import { t } from "../i18n";
import Stack from "./Stack";
import { showSelectedShapeActions } from "../element";
import { NonDeletedExcalidrawElement } from "../element/types";
import { FixedSideContainer } from "./FixedSideContainer";
import { Island } from "./Island";
import { HintViewer } from "./HintViewer";
import { calculateScrollCenter } from "../scene";
import { SelectedShapeActions, ShapesSwitcher } from "./Actions";
import { Section } from "./Section";
import { SCROLLBAR_WIDTH, SCROLLBAR_MARGIN } from "../scene/scrollbars";
import { LockButton } from "./LockButton";
import { UserList } from "./UserList";
import { LibraryButton } from "./LibraryButton";
import { PenModeButton } from "./PenModeButton";
import { Stats } from "./Stats";
import { actionToggleStats } from "../actions";
import WelcomeScreen from "./WelcomeScreen";

type MobileMenuProps = {
  appState: AppState;
  actionManager: ActionManager;
  renderJSONExportDialog: () => React.ReactNode;
  renderImageExportDialog: () => React.ReactNode;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onCollabButtonClick?: () => void;
  onLockToggle: () => void;
  onPenModeToggle: () => void;
  canvas: HTMLCanvasElement | null;
  isCollaborating: boolean;

  onImageAction: (data: { insertOnCanvasDirectly: boolean }) => void;
  renderTopRightUI?: (
    isMobile: boolean,
    appState: AppState,
  ) => JSX.Element | null;
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  renderSidebars: () => JSX.Element | null;
  device: Device;
  renderWelcomeScreen?: boolean;
  renderMenu: () => React.ReactNode;
};

export const MobileMenu = ({
  appState,
  elements,
  actionManager,
  setAppState,
  onLockToggle,
  onPenModeToggle,
  canvas,
  isCollaborating,
  onImageAction,
  renderTopRightUI,
  renderCustomStats,
  renderSidebars,
  device,
  renderWelcomeScreen,
  renderMenu,
}: MobileMenuProps) => {
  const renderToolbar = () => {
    return (
      <FixedSideContainer side="top" className="App-top-bar">
        {renderWelcomeScreen && !appState.isLoading && (
          <WelcomeScreen appState={appState} actionManager={actionManager} />
        )}
        <Section heading="shapes">
          {(heading: React.ReactNode) => (
            <Stack.Col gap={4} align="center">
              <Stack.Row gap={1} className="App-toolbar-container">
                <Island padding={1} className="App-toolbar App-toolbar--mobile">
                  {heading}
                  <Stack.Row gap={1}>
                    {/* <PenModeButton
                      checked={appState.penMode}
                      onChange={onPenModeToggle}
                      title={t("toolBar.penMode")}
                      isMobile
                      penDetected={appState.penDetected}
                    />
                    <LockButton
                      checked={appState.activeTool.locked}
                      onChange={onLockToggle}
                      title={t("toolBar.lock")}
                      isMobile
                    />
                    <div className="App-toolbar__divider"></div> */}
                    <ShapesSwitcher
                      appState={appState}
                      canvas={canvas}
                      activeTool={appState.activeTool}
                      setAppState={setAppState}
                      onImageAction={({ pointerType }) => {
                        onImageAction({
                          insertOnCanvasDirectly: pointerType !== "mouse",
                        });
                      }}
                    />
                  </Stack.Row>
                </Island>
                {renderTopRightUI && renderTopRightUI(true, appState)}
                <div className="mobile-misc-tools-container">
                  <PenModeButton
                    checked={appState.penMode}
                    onChange={onPenModeToggle}
                    title={t("toolBar.penMode")}
                    isMobile
                    penDetected={appState.penDetected}
                    // penDetected={true}
                  />
                  <LockButton
                    checked={appState.activeTool.locked}
                    onChange={onLockToggle}
                    title={t("toolBar.lock")}
                    isMobile
                  />
                  {!appState.viewModeEnabled && (
                    <LibraryButton
                      appState={appState}
                      setAppState={setAppState}
                      isMobile
                    />
                  )}
                </div>
              </Stack.Row>
            </Stack.Col>
          )}
        </Section>
        <HintViewer
          appState={appState}
          elements={elements}
          isMobile={true}
          device={device}
        />
      </FixedSideContainer>
    );
  };

  const renderAppToolbar = () => {
    if (appState.viewModeEnabled) {
      return <div className="App-toolbar-content">{renderMenu()}</div>;
    }

    return (
      <div className="App-toolbar-content">
        {renderMenu()}
        {actionManager.renderAction("toggleEditMenu")}
        {actionManager.renderAction("undo")}
        {actionManager.renderAction("redo")}
        {actionManager.renderAction(
          appState.multiElement ? "finalize" : "duplicateSelection",
        )}
        {actionManager.renderAction("deleteSelectedElements")}
      </div>
    );
  };

  return (
    <>
      {renderSidebars()}
      {!appState.viewModeEnabled && renderToolbar()}
      {!appState.openMenu && appState.showStats && (
        <Stats
          appState={appState}
          setAppState={setAppState}
          elements={elements}
          onClose={() => {
            actionManager.executeAction(actionToggleStats);
          }}
          renderCustomStats={renderCustomStats}
        />
      )}
      <div
        className="App-bottom-bar"
        style={{
          marginBottom: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
          marginLeft: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
          marginRight: SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2,
        }}
      >
        <Island padding={0}>
          {appState.openMenu === "canvas" ? (
            <Section className="App-mobile-menu" heading="canvasActions">
              <div className="panelColumn">
                <Stack.Col gap={2}>
                  {appState.collaborators.size > 0 && (
                    <fieldset>
                      <legend>{t("labels.collaborators")}</legend>
                      <UserList mobile collaborators={appState.collaborators} />
                    </fieldset>
                  )}
                </Stack.Col>
              </div>
            </Section>
          ) : appState.openMenu === "shape" &&
            !appState.viewModeEnabled &&
            showSelectedShapeActions(appState, elements) ? (
            <Section className="App-mobile-menu" heading="selectedShapeActions">
              <SelectedShapeActions
                appState={appState}
                elements={elements}
                renderAction={actionManager.renderAction}
              />
            </Section>
          ) : null}
          <footer className="App-toolbar">
            {renderAppToolbar()}
            {appState.scrolledOutside &&
              !appState.openMenu &&
              appState.openSidebar !== "library" && (
                <button
                  className="scroll-back-to-content"
                  onClick={() => {
                    setAppState({
                      ...calculateScrollCenter(elements, appState, canvas),
                    });
                  }}
                >
                  {t("buttons.scrollBackToContent")}
                </button>
              )}
          </footer>
        </Island>
      </div>
    </>
  );
};
