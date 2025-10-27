import React from "react";
import "../graph.style.css";
const CustomLegend = ({ color, value }) => {
  return (
    <div className="flex justify-center items-center">
      <div className="legend-box" style={{ backgroundColor: color }}></div>
      <p>{value}</p>
    </div>
  );
};

export default CustomLegend;
