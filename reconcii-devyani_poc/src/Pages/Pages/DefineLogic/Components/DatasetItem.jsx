import React, { useRef, useState } from "react";

const DatasetItem = ({ item }) => {
  return (
    <div className="dataset-item">
      <div className="header">
        <p className="title">{item?.dataSourceName}</p>
      </div>
      <div className="container">
        <ul>
          {item?.columns?.map((columnItem) => {
            return (
              <li key={columnItem?.excelColumnName}>
                {columnItem?.excelColumnName}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default DatasetItem;
