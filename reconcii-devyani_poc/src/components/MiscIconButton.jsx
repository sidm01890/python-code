import React from "react";

const MiscIconButton = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="h-8 w-8 bg-slate-500 text-white flex justify-center items-center rounded-sm"
    >
      <div className="flex justify-center">
        <span className="material-icons-outlined">{props.icon}</span>
      </div>
    </button>
  );
};

export default MiscIconButton;
  