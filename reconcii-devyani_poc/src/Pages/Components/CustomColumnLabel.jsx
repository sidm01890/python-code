import React from "react";
const CustomColumnLabel = ({ label, required=false }) => {
  return (
    <div className="w-1/4 bg-slate-300 flex items-center px-2">
      <p>{label} {required && <span className="text-red-400">*</span>} </p>
    </div>
  );
};

export default CustomColumnLabel;
