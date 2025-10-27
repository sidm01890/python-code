import React, { useState } from "react";
import "./components.css";
const SimpleSelectBox = ({
  label,
  data,
  optionKey,
  optionLabel,
  name,
  placeholder = "Write...",
  value,
  onChange,
  error,
  disabled = false,
  required = false,
}) => {
  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        {label && (
          <label>
            {label} {required && <span style={{ color: "#ff0000" }}>*</span>}
          </label>
        )}
        <div style={{ display: "flex", width: "100%", position: "relative" }}>
          <select
            onChange={onChange}
            value={value}
            className="simple-select-box"
          >
            {data?.map((item) => {
              return (
                <option key={item[optionKey]} value={item[optionKey]}>
                  {item[optionLabel]}
                </option>
              );
            })}
          </select>
        </div>
        {error && (
          <div
            style={{
              fontSize: "10px",
              marginLeft: "4px",
              textAlign: "left",
              color: "red",
              display: "block",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleSelectBox;
