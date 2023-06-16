import React from "react";
import { FilledButton } from "../FilledButton";
import { useExcalidrawActionManager, useExcalidrawSetAppState } from "../App";
import { actionSaveFileToDisk } from "../../actions";

export type ActionProps = {
  title: string;
  children: React.ReactNode;
  actionLabel: string;
  onClick: () => void;
};

export const Action = ({
  title,
  children,
  actionLabel,
  onClick,
}: ActionProps) => {
  return (
    <div className="OverwriteConfirm__Actions__Action">
      <h4>{title}</h4>
      <div className="OverwriteConfirm__Actions__Action__content">
        {children}
      </div>
      <FilledButton
        variant="outlined"
        color="muted"
        label={actionLabel}
        size="large"
        fullWidth
        onClick={onClick}
      />
    </div>
  );
};

export const ExportToImage = () => {
  const setAppState = useExcalidrawSetAppState();

  return (
    <Action
      title="Export as image"
      actionLabel="Export as image"
      onClick={() => {
        setAppState({ openDialog: "imageExport" });
      }}
    >
      Export the scene data as a image from which you can import later.
    </Action>
  );
};

export const SaveToDisk = () => {
  const actionManager = useExcalidrawActionManager();

  return (
    <Action
      title="Save to disk"
      actionLabel="Save to disk"
      onClick={() => {
        actionManager.executeAction(actionSaveFileToDisk, "ui");
      }}
    >
      Export the scene data to a file from which you can import later.
    </Action>
  );
};

const Actions = Object.assign(
  ({ children }: { children: React.ReactNode }) => {
    return <div className="OverwriteConfirm__Actions">{children}</div>;
  },
  {
    ExportToImage,
    SaveToDisk,
  },
);

export { Actions };
