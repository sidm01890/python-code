import React from "react";
import Spinner from "../assets/Images/spinner.gif";
const PrimaryButton = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props?.disabled}
      className={`w-full items-center justify-center flex gap-1 text-white py-2 px-2 rounded-md ${
        props?.disabled ? "bg-Button-bgHiddenColor" : "bg-Button-bgColor"
      }`}
    >
      {props.leftIcon}
      {props.loading !== true && props.label}
      {props.loading === true && (
        <img
          src={Spinner}
          style={{ height: "22px", width: "22px", margin: "0px 10px" }}
        />
      )}
    </button>
  );
};

export default PrimaryButton;
