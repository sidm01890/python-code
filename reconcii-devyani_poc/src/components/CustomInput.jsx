import React, { useState } from "react";

const CustomInput = ({
  label,
  type = "text",
  name,
  placeholder = "Write...",
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  accept = "",
  maxLength,
  additionalInputStyle = {},
}) => {
  const [currentType, setCurrentType] = useState(type);

  return (
    <div style={{ marginBottom: "15px" }}>
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
          <input
            type={currentType}
            placeholder={placeholder}
            value={value}
            name={name}
            accept={accept}
            className={disabled ? "h-39px" : "bg-white h-39px"}
            onChange={onChange}
            style={{
              backgroundColor: disabled ? "#e6e6e6" : "transparent",
              width: "100%",
              border: error ? "1px solid red" : "1px solid #ccc",
              padding: "8px",
              borderRadius: "4px",
              color: "#000000",
              ...additionalInputStyle,
            }}
            disabled={disabled}
            maxLength={maxLength}
          />
          {type === "password" && (
            <button
              type="button"
              className="password-visible"
              onClick={() =>
                setCurrentType(currentType === "password" ? "text" : "password")
              }
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              {currentType === "password" ? (
                <i className="fa-solid fa-eye" style={{ color: "#000000" }}></i>
              ) : (
                <i
                  className="fa-solid fa-eye-slash"
                  style={{ color: "#000000" }}
                ></i>
              )}
            </button>
          )}
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

export default CustomInput;
