import React from "react";

const SecondaryButton = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="w-full bg-slate-500 text-white py-2 px-4 rounded-lg"
    >
      {props.label}
    </button>
  );
};

export default SecondaryButton;
