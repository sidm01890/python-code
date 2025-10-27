import React, { useState, useEffect, useRef } from "react";
import "./components.css";
const DropdownWithCheckbox = ({
  data,
  placeholder,
  option_value = "value",
  option_label = "label",
  selectedLabel = "",
  selectedOptions = [],
  setSelectedOptions = () => {},
  disableOptionOnKey = null,
}) => {
  // const options = ["Option 1", "Option 2", "Option 3", "Option 4"];
  const [options, setOptions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setOptions(data);
  }, [data]);

  // Toggle dropdown visibility
  const toggleDropdown = () => setIsDropdownOpen((prev) => !prev);

  // Close dropdown if user clicks outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle individual option selection
  const handleCheckboxChange = (option) => {
    let localSelection = [...selectedOptions];
    if (localSelection?.includes(option)) {
      localSelection = localSelection.filter((item) => item !== option);
    } else {
      localSelection.push(option);
    }
    setSelectedOptions(localSelection);
  };

  // Handle "All" selection
  const handleSelectAll = () => {
    if (selectedOptions.length === options.length) {
      setSelectedOptions([]); // Deselect all
    } else {
      if (options[0]?.[option_label] === undefined) {
        if (disableOptionOnKey === null) {
          setSelectedOptions(options);
        } else {
          let allSelectedValues = options?.filter(
            (opt) => opt[disableOptionOnKey?.key] !== disableOptionOnKey?.value
          );
          setSelectedOptions(allSelectedValues);
        }
      } else {
        if (disableOptionOnKey === null) {
          let allSelectedValues = options?.map(
            (optItem) => optItem[option_value]
          );
          setSelectedOptions(allSelectedValues);
        } else {
          let allSelectedValues = options
            ?.filter(
              (opt) =>
                opt[disableOptionOnKey?.key] !== disableOptionOnKey?.value
            )
            ?.map((optItem) => optItem[option_value]);
          setSelectedOptions(allSelectedValues);
        }
      }
      // Select all
    }
  };

  return (
    <div style={{ position: "relative", minWidth: "200px" }} ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <div onClick={toggleDropdown} className="custom-checkbox-dropdown-view">
        <span>
          {selectedOptions.length > 0
            ? `${selectedLabel}${selectedOptions.length} selected`
            : placeholder || "Select options"}
        </span>
        <i className="fa-solid fa-chevron-down"></i>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="checkbox-dropdown">
          {/* "All" Checkbox */}
          <label>
            <input
              type="checkbox"
              checked={selectedOptions.length === options.length}
              onChange={handleSelectAll}
            />
            All
          </label>

          {/* Individual Options */}
          {options.map((option) => (
            <label
              key={option[option_value] || option}
              style={{
                opacity:
                  disableOptionOnKey === null
                    ? 1
                    : option[disableOptionOnKey?.key] ===
                      disableOptionOnKey?.value
                    ? 0.5
                    : 1,
              }}
            >
              <input
                type="checkbox"
                checked={selectedOptions.includes(
                  option[option_value] || option
                )}
                onChange={() =>
                  handleCheckboxChange(option[option_value] || option)
                }
                disabled={
                  disableOptionOnKey === null
                    ? false
                    : option[disableOptionOnKey?.key] ===
                      disableOptionOnKey?.value
                }
              />
              <span>{option[option_label] || option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default DropdownWithCheckbox;
