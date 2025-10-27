import React from "react";

const EditButton = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="h-8 w-8 bg-blue-500 text-white flex justify-center items-center rounded-sm"
    >
      <div className="flex justify-center">
        <span className="material-icons-outlined">edit</span>
      </div>
    </button>
  );
};

export default EditButton;
