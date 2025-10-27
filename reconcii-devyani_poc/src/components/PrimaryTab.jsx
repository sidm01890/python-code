import React from "react";

const PrimaryTab = (props) => {
  return (
    <button onClick={props.onClick} className={"px-4 py-2" + (props.active ? ' primary-tab text-white' :' bg-gray-100 ') }>{props.label}</button>
  );
};

export default PrimaryTab;
