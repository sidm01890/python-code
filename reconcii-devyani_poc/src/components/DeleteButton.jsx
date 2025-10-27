import React from "react";

const DeleteButton = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="h-8 w-8 bg-red-400 text-white flex justify-center items-center rounded-sm"
    >
      <div className="flex justify-center">
        <span className="material-icons-outlined">delete</span>
      </div>
    </button>
  );
};

export default DeleteButton;
