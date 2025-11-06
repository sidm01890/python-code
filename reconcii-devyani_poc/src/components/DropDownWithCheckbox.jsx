import React, { useState, useEffect, useRef, useMemo } from "react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    console.log('[DropdownWithCheckbox] Data received:', {
      dataLength: data?.length,
      data: data,
      option_value,
      option_label,
      placeholder,
      selectedOptionsLength: selectedOptions?.length,
    });
    setOptions(data || []);
  }, [data, option_value, option_label, placeholder]);

  // Create a Set for O(1) lookup instead of O(n) array includes
  const selectedOptionsSet = useMemo(() => {
    return new Set(selectedOptions);
  }, [selectedOptions]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) {
      return options;
    }
    const searchLower = searchTerm.toLowerCase();
    return options.filter((option) => {
      const label = option[option_label] || option;
      return String(label).toLowerCase().includes(searchLower);
    });
  }, [options, searchTerm, option_label]);

  // Toggle dropdown visibility
  const toggleDropdown = () => {
    console.log('[DropdownWithCheckbox] Toggling dropdown:', {
      currentState: isDropdownOpen,
      optionsLength: options.length,
      filteredOptionsLength: filteredOptions.length,
      placeholder,
    });
    setIsDropdownOpen((prev) => {
      const newState = !prev;
      console.log('[DropdownWithCheckbox] Dropdown state changed:', {
        from: prev,
        to: newState,
      });
      return newState;
    });
  };

  // Log when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      console.log('[DropdownWithCheckbox] Dropdown opened:', {
        filteredOptionsLength: filteredOptions.length,
        optionsLength: options.length,
        searchTerm,
        placeholder,
      });
    }
  }, [isDropdownOpen, filteredOptions.length, options.length, searchTerm, placeholder]);

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
    console.log('[DropdownWithCheckbox] handleCheckboxChange called:', {
      option,
      optionType: typeof option,
      currentSelectedOptions: selectedOptions,
      currentSelectedOptionsLength: selectedOptions?.length,
    });
    
    let localSelection = [...selectedOptions];
    
    // Use deep equality check for objects, or simple equality for primitives
    const isSelected = typeof option === 'object' && option !== null
      ? localSelection.some(item => JSON.stringify(item) === JSON.stringify(option))
      : localSelection?.includes(option);
    
    if (isSelected) {
      localSelection = typeof option === 'object' && option !== null
        ? localSelection.filter(item => JSON.stringify(item) !== JSON.stringify(option))
        : localSelection.filter((item) => item !== option);
    } else {
      localSelection.push(option);
    }
    
    console.log('[DropdownWithCheckbox] handleCheckboxChange - new selection:', {
      newSelection: localSelection,
      newSelectionLength: localSelection.length,
    });
    
    setSelectedOptions(localSelection);
  };

  // Handle "All" selection (only for filtered options)
  const handleSelectAll = () => {
    const optionsToUse = filteredOptions;
    const selectableOptions = disableOptionOnKey === null 
      ? optionsToUse 
      : optionsToUse.filter(
          (opt) => opt[disableOptionOnKey?.key] !== disableOptionOnKey?.value
        );
    
    // Check if all selectable filtered options are selected
    const allFilteredSelected = selectableOptions.every((opt) => {
      const value = opt[option_value] || opt;
      return selectedOptionsSet.has(value);
    });

    if (allFilteredSelected) {
      // Deselect all filtered options
      const filteredValues = new Set(
        selectableOptions.map((opt) => opt[option_value] || opt)
      );
      const newSelection = selectedOptions.filter((val) => !filteredValues.has(val));
      setSelectedOptions(newSelection);
    } else {
      // Select all filtered options
      const filteredValues = selectableOptions.map((opt) => opt[option_value] || opt);
      const newSelection = [...new Set([...selectedOptions, ...filteredValues])];
      setSelectedOptions(newSelection);
    }
  };

  // Check if all filtered options are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    const selectableOptions = disableOptionOnKey === null 
      ? filteredOptions 
      : filteredOptions.filter(
          (opt) => opt[disableOptionOnKey?.key] !== disableOptionOnKey?.value
        );
    
    if (selectableOptions.length === 0) return false;
    
    return selectableOptions.every((opt) => {
      const value = opt[option_value] || opt;
      return selectedOptionsSet.has(value);
    });
  }, [filteredOptions, selectedOptionsSet, disableOptionOnKey, option_value]);

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
          {/* Search Input */}
          {options.length > 10 && (
            <div style={{ marginBottom: "10px", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              />
            </div>
          )}

          {/* "All" Checkbox */}
          {filteredOptions.length > 0 && (
            <label>
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={handleSelectAll}
              />
              All {filteredOptions.length !== options.length && `(${filteredOptions.length} shown)`}
            </label>
          )}

          {/* Individual Options */}
          {filteredOptions.length === 0 ? (
            <div style={{ padding: "10px", textAlign: "center", color: "#999" }}>
              No options found
            </div>
          ) : (
            filteredOptions.map((option, index) => {
              try {
                // Safely extract option value
                let optionValue;
                if (typeof option === 'object' && option !== null) {
                  optionValue = option[option_value];
                  // Fallback: if option_value doesn't exist, try common keys
                  if (optionValue === undefined) {
                    optionValue = option.id || option.code || option.value || option.key;
                  }
                  // Last resort: use JSON string if still undefined
                  if (optionValue === undefined) {
                    console.warn('[DropdownWithCheckbox] Could not extract option_value for option:', option, 'using index as fallback');
                    optionValue = `option_${index}`;
                  }
                } else {
                  optionValue = option;
                }

                // Safely extract option label - MUST be a string
                let optionLabel;
                if (typeof option === 'object' && option !== null) {
                  optionLabel = option[option_label];
                  // Fallback: if option_label doesn't exist, try common keys
                  if (optionLabel === undefined || (typeof optionLabel !== 'string' && typeof optionLabel !== 'number')) {
                    optionLabel = option.name || option.label || option.city_name || option.store_name || option.displayName;
                  }
                  // Last resort: convert to string or use placeholder
                  if (optionLabel === undefined || (typeof optionLabel !== 'string' && typeof optionLabel !== 'number')) {
                    console.warn('[DropdownWithCheckbox] Could not extract option_label for option:', option, 'option_value:', optionValue);
                    optionLabel = String(optionValue) || `Option ${index + 1}`;
                  }
                  // Ensure it's a string
                  optionLabel = String(optionLabel);
                } else {
                  optionLabel = String(option);
                }

                const isSelected = selectedOptionsSet.has(optionValue);
                const isDisabled = disableOptionOnKey !== null && 
                  option[disableOptionOnKey?.key] === disableOptionOnKey?.value;

                // Log first few options for debugging
                if (index < 3) {
                  console.log(`[DropdownWithCheckbox] Rendering option ${index}:`, {
                    option,
                    optionValue,
                    optionLabel,
                    option_value,
                    option_label,
                    isSelected,
                    isDisabled,
                  });
                }
              
                return (
                  <label
                    key={optionValue || `option_${index}`}
                    style={{
                      opacity: isDisabled ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        console.log('[DropdownWithCheckbox] Checkbox changed:', { optionValue, optionLabel });
                        handleCheckboxChange(optionValue);
                      }}
                      disabled={isDisabled}
                    />
                    <span>{optionLabel}</span>
                  </label>
                );
              } catch (error) {
                console.error('[DropdownWithCheckbox] Error rendering option:', error, { option, index });
                return (
                  <label key={`error_${index}`} style={{ opacity: 0.5, color: 'red' }}>
                    <span>Error rendering option</span>
                  </label>
                );
              }
            })
          )}
        </div>
      )}
    </div>
  );
};

export default DropdownWithCheckbox;
