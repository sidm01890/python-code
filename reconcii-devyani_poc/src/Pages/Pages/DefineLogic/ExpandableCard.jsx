import React, { useState } from "react";
import "./DefineStyle.css";

export default function ExpandableCard({
  header = null,
  children = null,
  dataSetNos = null,
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="expandable-card box">
      <div className="header-box">
        <button onClick={() => setExpanded(!expanded)}>
          <p>
            {header} {dataSetNos ? ` - (${dataSetNos} Dataset)` : ""}
          </p>
          {expanded ? (
            <i className={`fa-solid fa-chevron-up`}></i>
          ) : (
            <i className={`fa-solid fa-chevron-down`}></i>
          )}
        </button>
      </div>
      {expanded && <div className="expandable-content-box">{children}</div>}
    </div>
  );
}
