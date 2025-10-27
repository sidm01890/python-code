import React from "react";

export default function BlankCard({
  header = null,
  body = null,
  children = null,
  withBackButton = false,
  onBackClick = () => {},
  rightAction = null,
}) {
  return (
    <div className="box font-Roboto">
      <div className="box-body">
        <div className="flex">
          {withBackButton && (
            <button onClick={onBackClick}>
              <span className="material-icons-outlined mr-2">
                {"arrow_back"}
              </span>
            </button>
          )}
          {header && (
            <div className="box-header !border-b-0 !p-0">{header}</div>
          )}
          {rightAction}
        </div>
        {body}
        {children}
      </div>
    </div>
  );
}
