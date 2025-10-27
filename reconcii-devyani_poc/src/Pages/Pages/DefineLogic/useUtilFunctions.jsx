import { useDispatch, useSelector } from "react-redux";
import PrimaryButton from "../../../components/PrimaryButton";
import Select from "react-select";
import { setActiveLogic } from "../../../Redux/Slices/Logics";
import BLANK_FORMULA from "./constants";

const OPERATOR_LIST = [
  { value: "+", label: "+" },
  { value: "-", label: "-" },
  { value: "*", label: "*" },
  { value: "/", label: "/" },
  { value: "=", label: "=" },
];

const ONLY_EQUAL_OPERATOR = [{ value: "=", label: "=" }];

const convertToUpperCaseWithUnderscores = (input) => {
  return input.replace(/\s+/g, "_").toUpperCase();
};

const replaceFirstOccurrence = (inputString, target, replacement) => {
  const index = inputString.indexOf(target);
  if (index === -1) return inputString; // If the target is not found, return the original string
  try {
    return (
      inputString.substring(0, index) +
      replacement +
      inputString.substring(index + target.length)
    );
  } catch (e) {
    return inputString;
  }
};

const useUtilFunctions = (dataSetOptions) => {
  const dispatch = useDispatch();
  let { logicData, activeLogic } = useSelector((state) => state.LogicsService);
  const renderFormula = (activeFormula) => {
    let labelText = "";
    let tableColumnFormula = "";

    activeFormula?.fields.map((field, index) => {
      if (field?.type === "data_field") {
        labelText += startBrackets(field, index, true);
        tableColumnFormula += startBrackets(field, index, true);
        if (field?.dataset_type === "Formula") {
          labelText = labelText + " " + field?.selectedFieldValue;
          tableColumnFormula =
            tableColumnFormula + " " + field?.selectedFieldValue;
        } else if (field?.selectedDataSetValue) {
          if (Array.isArray(field?.selectedDataSetValue)) {
            if (field?.selectedDataSetValue?.length > 0) {
              labelText =
                labelText +
                " " +
                field?.selectedFieldValue +
                "." +
                field?.selectedDataSetValue[0];
            }
            try {
              if (field?.selectedTableColumn?.length > 0) {
                tableColumnFormula =
                  tableColumnFormula +
                  " " +
                  field?.selectedTableName +
                  "." +
                  field?.selectedTableColumn[0];
              }
            } catch (e) {
              console.log(e);
            }
          } else {
            labelText =
              labelText +
              " " +
              field?.selectedFieldValue +
              "." +
              field?.selectedDataSetValue;

            tableColumnFormula =
              tableColumnFormula +
              " " +
              field?.selectedTableName +
              "." +
              field?.selectedTableColumn;
          }
        } else if (field?.customFieldValue) {
          labelText = labelText + " " + field?.customFieldValue;
          tableColumnFormula =
            tableColumnFormula + " " + field?.customFieldValue;
        }
        labelText += endBrackets(field, index, true);
        tableColumnFormula += endBrackets(field, index, true);
      } else if (field?.type === "operator") {
        if (field?.selectedFieldValue) {
          labelText = labelText + " " + field?.selectedFieldValue;
          tableColumnFormula =
            tableColumnFormula + " " + field?.selectedFieldValue;
        }
      }
    });
    let logicNameKey = "";
    if (activeFormula?.logicName) {
      logicNameKey = convertToUpperCaseWithUnderscores(
        activeFormula?.logicName
      );
    }

    let formulaStatus = validateFormula(tableColumnFormula);

    if (formulaStatus?.isValid && activeFormula?.multipleColumn) {
      let currentFormula = formulaStatus?.normalizedFormula;
      let allFields = activeFormula?.fields[0]?.selectedTableColumn
        ?.map(
          (column) => `${activeFormula?.fields[0]?.selectedTableName}.${column}`
        )
        .join(", ");
      let firstField = `${activeFormula?.fields[0]?.selectedTableName}.${activeFormula?.fields[0]?.selectedTableColumn[0]}`;
      let updatedFormula = replaceFirstOccurrence(
        currentFormula,
        firstField,
        allFields
      );

      formulaStatus = { ...formulaStatus, normalizedFormula: updatedFormula };

      let currentFormulaExcel = labelText;
      let allFieldsExcel = activeFormula?.fields[0]?.selectedDataSetValue
        ?.map(
          (column) =>
            `${activeFormula?.fields[0]?.selectedFieldValue}.${column}`
        )
        .join(", ");
      let firstFieldExcel = `${activeFormula?.fields[0]?.selectedFieldValue}.${activeFormula?.fields[0]?.selectedDataSetValue[0]}`;
      labelText = replaceFirstOccurrence(
        currentFormulaExcel,
        firstFieldExcel,
        allFieldsExcel
      );
    }

    return {
      ...formulaStatus,
      formulaText: tableColumnFormula,
      logicNameKey: logicNameKey,
      excelFormulaText: labelText,
    };
  };

  const getSelectedOption = (fieldValue, optionKey, optionList) => {
    let selectedOption = [];
    if (Array.isArray(fieldValue)) {
      selectedOption = optionList?.filter((option) =>
        fieldValue?.includes(option[optionKey])
      );
      return selectedOption;
    } else {
      selectedOption = optionList?.filter(
        (option) => option[optionKey] === fieldValue
      );
    }

    if (selectedOption?.length > 0) {
      return selectedOption[0];
    }
    return null;
  };

  const removeBracket = (type, index) => {
    if (type === "start") {
      let updatedLogicItem = { ...activeLogic };
      let fields = [...updatedLogicItem.fields];
      let selectedField = { ...fields[index] };

      // Add a new opening bracket to the startBrackets array
      let startBrackets = [];
      try {
        startBrackets = [...selectedField.startBrackets];
      } catch (e) {
        console.log(e);
      }

      startBrackets.pop();
      selectedField = {
        ...selectedField,
        startBrackets: startBrackets,
      };

      // Update the fields and the logic item
      fields[index] = selectedField;
      updatedLogicItem.fields = fields;

      // Dispatch the updated logic item and reset the state
      dispatch(setActiveLogic(updatedLogicItem));
    } else {
      let updatedLogicItem = { ...activeLogic };
      let fields = [...updatedLogicItem.fields];
      let selectedField = { ...fields[index] };

      // Add a new opening bracket to the startBrackets array
      let endBrackets = [];
      try {
        endBrackets = [...selectedField.endBrackets];
      } catch (e) {
        console.log(e);
      }

      endBrackets.pop();
      selectedField = {
        ...selectedField,
        endBrackets: endBrackets,
      };

      // Update the fields and the logic item
      fields[index] = selectedField;
      updatedLogicItem.fields = fields;

      // Dispatch the updated logic item and reset the state
      dispatch(setActiveLogic(updatedLogicItem));
    }
  };

  const startBrackets = (fieldItem, index, forFormula = false) => {
    if (fieldItem?.startBrackets?.length > 0) {
      let bracketButtons = fieldItem?.startBrackets?.map((bracket) => {
        if (forFormula) {
          return bracket;
        }
        return (
          <button
            className="bracket-button"
            onClick={() => removeBracket("start", index)}
          >
            {bracket}
            <div className="minus">
              <i className="fa-solid fa-minus" style={{ fontSize: "10px" }}></i>
            </div>{" "}
          </button>
        );
      });
      return forFormula ? bracketButtons.join("") : bracketButtons;
    }
    return forFormula ? "" : null;
  };

  const endBrackets = (fieldItem, index, forFormula = false) => {
    if (fieldItem?.endBrackets?.length > 0) {
      let bracketButtons = fieldItem?.endBrackets?.map((bracket) => {
        if (forFormula) {
          return bracket;
        }
        return (
          <button
            className="bracket-button"
            onClick={() => removeBracket("end", index)}
          >
            {bracket}{" "}
            <div className="minus">
              <i className="fa-solid fa-minus" style={{ fontSize: "10px" }}></i>
            </div>{" "}
          </button>
        );
      });
      return forFormula ? bracketButtons.join("") : bracketButtons;
    }
    return forFormula ? "" : null;
  };

  const removeDataField = (index) => {
    let updatedLogicItem = { ...activeLogic };
    let fields = [...updatedLogicItem.fields];
    fields.splice(index - 1, 2);
    updatedLogicItem = { ...updatedLogicItem, fields };
    dispatch(setActiveLogic(updatedLogicItem));
  };

  const renderMiddleFieldView = (
    logicItem,
    fieldItem,
    index,
    isLast,
    isMainRow = false,
    i
  ) => {
    if (fieldItem?.type === "data_field") {
      return (
        <div className="fieldView mb-3">
          {false ? (
            <div className="titleDiv">
              <PrimaryButton
                onClick={() => {
                  onAddDataFieldClicked(logicItem, fieldItem);
                }}
                label={"Add Data Field"}
              />
            </div>
          ) : null}
          <div className="flex">
            <div className="ddSelection">
              {startBrackets(fieldItem, index)}
              <div style={{ width: "100%", maxWidth: "400px" }}>
                <Select
                  value={getSelectedOption(
                    fieldItem?.selectedFieldValue,
                    "dataset_name",
                    optionsForDataSet(i)
                  )}
                  style={{ height: 20, width: "100%" }}
                  menuPortalTarget={document.body}
                  onChange={(e) => {
                    onSelectFieldValue(
                      e.dataset_name,
                      logicItem,
                      index,
                      false,
                      e,
                      e.tableName
                    );
                  }}
                  getOptionLabel={(option) => option.dataset_name}
                  getOptionValue={(option) => option.dataset_name}
                  options={optionsForDataSet(i).map((option, i) => {
                    return option;
                  })}
                />
              </div>
              {fieldItem?.dataset_type !== "Custom" &&
              fieldItem?.dataset_type !== "Formula" ? (
                checkOpts(fieldItem?.selectedFieldValue) ? (
                  <div style={{ width: "100%" }}>
                    <Select
                      styles={{
                        height: 30,
                        maxWidth: "400px",
                        // menu: ({ width, ...css }) => ({ ...css }),
                      }}
                      value={getSelectedOption(
                        fieldItem?.selectedDataSetValue,
                        "excelColumnName",
                        dataSetOptions
                          .filter((dataSet) => {
                            return (
                              dataSet?.dataset_name ===
                              fieldItem?.selectedFieldValue
                            );
                          })[0]
                          ?.columns?.map((option, i) => {
                            return option;
                          })
                      )}
                      isMulti={activeLogic?.multipleColumn && index === 0}
                      menuPortalTarget={document.body}
                      getOptionLabel={(option) => option.excelColumnName}
                      getOptionValue={(option) => option.excelColumnName}
                      onChange={(e) => {
                        onSelectFieldValue(
                          e.excelColumnName ? e.excelColumnName : e,
                          logicItem,
                          index,
                          true,
                          e,
                          e.dbcolumnName
                        );
                      }}
                      options={dataSetOptions
                        .filter((dataSet) => {
                          return (
                            dataSet?.dataset_name ===
                            fieldItem?.selectedFieldValue
                          );
                        })[0]
                        ?.columns?.map((option, i) => {
                          return option;
                        })}
                    />
                  </div>
                ) : null
              ) : (
                fieldItem?.dataset_type !== "Formula" && (
                  <input
                    value={fieldItem?.customFieldValue}
                    className="customField"
                    onChange={(e) => {
                      onChangeCustomInput(e.target.value, logicItem, index);
                    }}
                    style={{ backgroundColor: "#ffffff" }}
                  />
                )
              )}
              {endBrackets(fieldItem, index)}
            </div>
            {index > 0 && activeLogic?.fields?.length > 3 && (
              <div className="ml-2 self-center">
                <button
                  onClick={() => {
                    removeDataField(index);
                  }}
                  className="remove-field"
                >
                  {"-"}
                </button>
              </div>
            )}
            {isLast && activeLogic?.multipleColumn === false && (
              <div className="ml-2 self-center">
                <PrimaryButton
                  onClick={() => {
                    onAddDataFieldClicked(logicItem, fieldItem);
                  }}
                  label={"+"}
                />
              </div>
            )}
          </div>
        </div>
      );
    } else if (fieldItem?.type === "operator") {
      return (
        <div className="w-32 mb-3">
          <Select
            styles={{
              width: "100%",
              indicatorSeparator: () => ({ display: "none" }),
              valueContainer: () => ({
                display: "flex",
                marginLeft: 10,
              }),
            }}
            isSearchable={false}
            menuPortalTarget={document.body}
            defaultValue={"+"}
            placeholder=""
            onChange={(e) => {
              onSelectFieldValue(e.value, logicItem, index);
            }}
            value={getSelectedOption(
              fieldItem?.selectedFieldValue,
              "value",
              OPERATOR_LIST
            )}
            options={
              activeLogic?.multipleColumn === false
                ? OPERATOR_LIST
                : ONLY_EQUAL_OPERATOR
            }
          />
        </div>
      );
    } else return null;
  };

  const onAddDataFieldClicked = (rowData) => {
    // if (rowData.hasOwnProperty("parentId")) {
    //   //check sub logic
    //   let dataItem = { ...activeLogic };
    //   let modifiedData = dataItem;

    //   if (dataItem?.id === rowData?.parentId) {
    //     let modifiedAddedDataField = dataItem?.sub_logic.map((subLogicItem) => {
    //       if (rowData?.id === subLogicItem?.id) {
    //         let updatedSubLogicField = [
    //           ...subLogicItem?.fields,
    //           {
    //             type: "operator",
    //             dataset_type: "",
    //             selectedFieldValue: "",
    //           },
    //           {
    //             type: "data_field",
    //             dataset_type: "",
    //             selectedDataSetValue: "",
    //             selectedFieldValue: "",
    //             customFieldValue: "",
    //             startBrackets: [],
    //             endBrackets: [],
    //           },
    //         ];
    //         return { ...subLogicItem, fields: updatedSubLogicField };
    //       } else {
    //         return subLogicItem;
    //       }
    //     });
    //     modifiedData = { ...dataItem, sub_logic: modifiedAddedDataField };
    //   }
    //   dispatch(setActiveLogic(modifiedData));
    // } else {
    let dataItem = { ...activeLogic };
    let modifiedData = dataItem;
    if (dataItem?.id === rowData?.id) {
      let updatedField = [
        ...dataItem?.fields,
        {
          type: "operator",
          dataset_type: "",
          selectedFieldValue: "",
        },
        {
          type: "data_field",
          dataset_type: "",
          selectedDataSetValue: "",
          selectedFieldValue: "",
          customFieldValue: "",
          startBrackets: [],
          endBrackets: [],
        },
      ];
      modifiedData = { ...dataItem, fields: updatedField };
    }
    dispatch(setActiveLogic(modifiedData));
    // }
  };

  function optionsForDataSet(index) {
    let options = [...dataSetOptions];
    for (let i = 0; i < index; i++) {
      options.push({ ...logicData[i], dataset_name: logicData[i].logicName });
    }
    return options;
  }
  function checkOpts(value) {
    let result = dataSetOptions.some(
      (e) => e.dataset_name === value || e?.tableName === value
    );
    return result;
  }

  const onSelectFieldValue = (
    fieldValue,
    logicItem,
    index,
    isDataSet = false,
    option,
    equivalentDbValue = ""
  ) => {
    let dataItem = { ...activeLogic };
    let modifiedData = dataItem;

    if (dataItem?.id === logicItem?.id) {
      let modifiedFields = dataItem?.fields.map((field, i) => {
        if (index === i) {
          if (isDataSet) {
            return {
              ...field,
              dataset_type: option?.dataset_type || "Dataset",
              selectedDataSetValue: Array.isArray(fieldValue)
                ? fieldValue?.map((opt) => opt?.excelColumnName)
                : fieldValue,
              selectedTableColumn: Array.isArray(fieldValue)
                ? fieldValue?.map((opt) => opt?.dbcolumnName)
                : equivalentDbValue,
            };
          }
          return {
            ...field,
            dataset_type: option?.dataset_type || "Dataset",
            selectedFieldValue: fieldValue,
            selectedTableName: equivalentDbValue,
          };
        } else return field;
      });
      modifiedData = { ...dataItem, fields: modifiedFields };
    }
    dispatch(setActiveLogic(modifiedData));
  };

  const onChangeCustomInput = (fieldValue, logicItem, index) => {
    let dataItem = { ...activeLogic };
    let modifiedData = dataItem;
    if (dataItem?.id === logicItem?.id) {
      let modifiedFields = dataItem?.fields.map((field, i) => {
        if (index === i) {
          return { ...field, customFieldValue: fieldValue };
        } else return field;
      });
      modifiedData = { ...dataItem, fields: modifiedFields };
    }
    dispatch(setActiveLogic(modifiedData));
  };

  const handleFieldValueChange = (name, value) => {
    let currentLogic = { ...activeLogic };
    let updatedLogic = { ...currentLogic, [name]: value };

    if (name === "multipleColumn") {
      updatedLogic = {
        ...BLANK_FORMULA,
        active_group_index: updatedLogic?.active_group_index,
        logicName: currentLogic?.logicName,
        [name]: value,
      };
    }
    dispatch(setActiveLogic(updatedLogic));
  };

  return {
    renderFormula,
    renderMiddleFieldView,
    handleFieldValueChange,
  };
};

export default useUtilFunctions;

const validateFormula = (formula) => {
  try {
    // Step 1: Normalize spaces
    formula = formula
      .replace(/\s*([\(\)])\s*/g, "$1") // Remove spaces around parentheses
      .replace(/([+\-*/=])/g, " $1 ") // Ensure spaces around operators
      .replace(/\s+/g, " ")
      .trim(); // Remove leading and trailing spaces

    // Step 2: Split by `=` to handle variable assignment
    const parts = formula.split("=");
    if (parts.length > 2)
      throw new Error("Invalid use of assignment operator `=`");

    // Validate the left-hand side (if present)
    if (parts.length === 2 && !/^\s*\w+(\.\w+)*\s*$/.test(parts[0])) {
      throw new Error(
        "Invalid variable name on the left-hand side of `=`. Expected format: namespace.variable"
      );
    }

    // Validate the right-hand side (mathematical expression)
    const expression = parts.length === 2 ? parts[1].trim() : parts[0].trim();

    // Step 3: Check for balanced parentheses
    const stack = [];
    for (const char of expression) {
      if (char === "(") stack.push(char);
      else if (char === ")") {
        if (!stack.length) throw new Error("Unbalanced parentheses");
        stack.pop();
      }
    }
    if (stack.length) throw new Error("Unbalanced parentheses");

    // Step 4: Validate characters and variables
    const validChars = /^[\w\s\+\-\*\/\(\)\.]+$/;
    if (!validChars.test(expression)) {
      throw new Error("Formula contains invalid characters");
    }

    // Step 5: Replace variables with numbers for evaluation
    const testFormula = expression.replace(/[\w.]+/g, "1"); // Replace namespace.variable with "1"

    // Step 6: Validate mathematical syntax using a dry run
    // eslint-disable-next-line no-new-func
    new Function(`return ${testFormula}`)(); // Will throw an error if invalid

    return {
      isValid: true,
      message: "Formula is valid",
      normalizedFormula: formula,
    };
  } catch (error) {
    return { isValid: false, message: error.message };
  }
};
