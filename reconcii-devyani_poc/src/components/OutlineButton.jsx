import React from "react";

const OutlineButton = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="w-full items-center justify-center flex gap-1 text-Text-blue border-1 border-color-blue py-2 px-2 rounded-md hover:bg-Button-bgColor hover:text-white"
      style={props.style && props.style}
    >
      {props.leftIcon}
      {props.label}
    </button>
  );
};

export default OutlineButton;
