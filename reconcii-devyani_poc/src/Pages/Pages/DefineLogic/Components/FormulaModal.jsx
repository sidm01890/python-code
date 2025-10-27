import React, { useState, useEffect } from "react";
import "../DefineStyle.css";
import useUtilFunctions from "../useUtilFunctions";
import PrimaryButton from "../../../../components/PrimaryButton";
import OutlineButton from "../../../../components/OutlineButton";
import { useDispatch, useSelector } from "react-redux";
import {
  setActiveLogic,
  setLogicData,
  setLogicGroups,
} from "../../../../Redux/Slices/Logics";
import BLANK_FORMULA from "../constants";
const FormulaModal = ({ dataSetOptions }) => {
  const dispatch = useDispatch();
  const [formulaError, setFormulaError] = useState(null);
  const [addBracketBefore, setAddBracketBefore] = useState("");
  const [addBracketAfter, setAddBracketAfter] = useState("");

  const [fieldsArray, setFieldsArray] = useState([]);

  let {
    logicData,
    activeLogic: logicItem,
    activeLogicIndex,
    logicGroups,
  } = useSelector((state) => state.LogicsService);
  const { renderFormula, renderMiddleFieldView, handleFieldValueChange } =
    useUtilFunctions(dataSetOptions);

  useEffect(() => {
    let fieldList = [];
    if (logicItem?.fields?.length > 0) {
      let pos = 1;
      logicItem?.fields.forEach((field, index) => {
        if (field?.type === "data_field") {
          fieldList?.push({ key: index, label: pos });
          pos++;
        }
      });
    }
    setFieldsArray(fieldList);
  }, [logicItem?.fields?.length]);

  const saveFormula = () => {
    if (logicItem?.logicName?.toString()?.trim() === "") {
      setFormulaError("Please enter formula name");
      setTimeout(() => {
        setFormulaError(null);
      }, 5000);

      return;
    }

    let processedFormula = renderFormula(logicItem);
    let currentLogicItem = {
      ...logicItem,
      formulaText: processedFormula?.normalizedFormula,
      excelFormulaText: processedFormula?.excelFormulaText,
      logicNameKey: processedFormula?.logicNameKey,
    };
    let allLogics = [...logicData];
    if (activeLogicIndex === -1) {
      allLogics.push(currentLogicItem);
    } else {
      allLogics[activeLogicIndex] = currentLogicItem;
    }

    dispatch(setLogicData(allLogics));

    let groupList = [...logicGroups];
    let activeGroup = { ...groupList[logicItem?.active_group_index] };
    activeGroup = { ...activeGroup, recologic: allLogics };
    groupList[logicItem?.active_group_index] = activeGroup;
    dispatch(setLogicGroups(groupList));
    dispatch(setActiveLogic(null));
  };

  const addBeforeBracket = () => {
    if (addBracketBefore !== "") {
      let updatedLogicItem = { ...logicItem };
      let fields = [...updatedLogicItem.fields];
      let selectedField = { ...fields[addBracketBefore] };

      // Add a new opening bracket to the startBrackets array
      let startBrackets = [];
      try {
        startBrackets = [...selectedField.startBrackets];
      } catch (e) {
        console.log(e);
      }

      startBrackets.push("(");
      selectedField = {
        ...selectedField,
        startBrackets: startBrackets,
      };

      // Update the fields and the logic item
      fields[addBracketBefore] = selectedField;
      updatedLogicItem.fields = fields;

      // Dispatch the updated logic item and reset the state
      dispatch(setActiveLogic(updatedLogicItem));
      setAddBracketBefore("");
    }
  };

  const addAfterBracket = () => {
    if (addBracketAfter !== "") {
      let updatedLogicItem = { ...logicItem };
      let fields = [...updatedLogicItem.fields];
      let selectedField = { ...fields[addBracketAfter] };

      // Add a new opening bracket to the startBrackets array
      let endBrackets = [];
      try {
        endBrackets = [...selectedField.endBrackets];
      } catch (e) {
        console.log(e);
      }

      endBrackets.push(")");
      selectedField = {
        ...selectedField,
        endBrackets: endBrackets,
      };

      // Update the fields and the logic item
      fields[addBracketAfter] = selectedField;
      updatedLogicItem.fields = fields;

      // Dispatch the updated logic item and reset the state
      dispatch(setActiveLogic(updatedLogicItem));
      setAddBracketAfter("");
    }
  };

  return (
    <div className="fixed-formula-modal">
      <div className="formula-area flex flex-col">
        <div className="header p-3">
          <p>
            FORMULA {"  "}
            {formulaError && (
              <span style={{ fontSize: "11px", color: "#ff0000" }}>
                {formulaError}
              </span>
            )}
          </p>
          <div className="flex gap-5">
            <div className="flex gap-2">
              <PrimaryButton
                label="ADD"
                onClick={() => saveFormula()}
                disabled={!renderFormula(logicItem)?.isValid}
              />
              <OutlineButton
                label="RESET"
                onClick={() => dispatch(setActiveLogic(BLANK_FORMULA))}
              />
            </div>
            <button
              onClick={() => dispatch(setActiveLogic(null))}
              className="justify-center flex items-center"
            >
              <span className="material-icons-outlined mr-2">close</span>
            </button>
          </div>
        </div>
        <div className="flex-1 p-3">
          <div>
            <div className="logicView">
              <div className="flex mb-3">
                <div className="flex w-36 ">
                  <label>
                    Logic Name <span className="text-red-400">*</span>
                  </label>
                </div>
                <div className="w-100 px-3">
                  <input
                    type="text"
                    className="h-10 w-100 rounded-s px-2"
                    value={logicItem?.logicName}
                    onChange={(e) => {
                      handleFieldValueChange("logicName", e.target.value);
                    }}
                  />
                  <div className="flex mt-2 gap-2">
                    <div>
                      <input
                        type="checkbox"
                        checked={logicItem?.multipleColumn}
                        onChange={() => null}
                        onClick={() =>
                          handleFieldValueChange(
                            "multipleColumn",
                            !logicItem?.multipleColumn
                          )
                        }
                      />
                    </div>
                    Common Value for Multiple Columns
                  </div>
                </div>
              </div>
              <div className="flex">
                <div className="flex w-36 ">
                  <label>
                    Formula <span className="text-red-400">*</span>
                  </label>
                </div>
                <div className="px-3 w-100 rounded-s overflow-hidden flex">
                  <div className="formula-boxes overflow-y-auto p-3 rounded-s">
                    {logicItem?.fields.map((fieldItem, index) => {
                      return renderMiddleFieldView(
                        logicItem,
                        fieldItem,
                        index,
                        logicItem.fields.length - 1 === index,
                        true,
                        0
                      );
                    })}
                  </div>
                  <div className="w-80 px-1">
                    <div className="fixed-bracket-area p-2">
                      <p className="title">Enter Brackets</p>
                      <div className="flex w-100 mb-2">
                        <div className="flex-1">
                          Before <b>{"("}</b>
                        </div>
                        <div>
                          <select
                            className="small-dropdown"
                            onChange={(e) =>
                              setAddBracketBefore(e.target.value)
                            }
                            value={addBracketBefore}
                          >
                            <option value="">Select</option>
                            {fieldsArray?.map((field) => {
                              return (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                </option>
                              );
                            })}
                          </select>
                          <button
                            className="small-button"
                            onClick={() => addBeforeBracket()}
                          >
                            <i className="fa-solid fa-plus"></i>
                          </button>
                        </div>
                      </div>
                      <div className="flex w-100">
                        <div className="flex-1">
                          After <b>{")"}</b>
                        </div>
                        <div>
                          <select
                            className="small-dropdown"
                            onChange={(e) => setAddBracketAfter(e.target.value)}
                            value={addBracketAfter}
                          >
                            <option value="">Select</option>
                            {fieldsArray?.map((field) => {
                              return (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                </option>
                              );
                            })}
                          </select>
                          <button
                            className="small-button"
                            onClick={() => addAfterBracket()}
                          >
                            <i className="fa-solid fa-plus"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer p-3">
          <FormulaText formulaObj={renderFormula(logicItem)} />
        </div>
      </div>
    </div>
  );
};

export default FormulaModal;

const FormulaText = ({ formulaObj }) => {
  return (
    <div>
      <b>{formulaObj?.excelFormulaText}</b>
      {!formulaObj?.isValid && (
        <span style={{ color: "#ff0000", fontSize: "9px" }}>
          {" "}
          ({formulaObj?.message})
        </span>
      )}
    </div>
  );
};
