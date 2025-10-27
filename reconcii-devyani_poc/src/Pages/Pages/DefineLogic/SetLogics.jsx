import React, { useEffect, useState } from "react";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import "../../Styles/DefineLogic.css";
import PrimaryButton from "../../../components/PrimaryButton";
import { useDispatch, useSelector } from "react-redux";
import FormulaModal from "./Components/FormulaModal";
import {
  setActiveLogic,
  setActiveLogicIndex,
  setLogicData,
  setLogicGroups,
} from "../../../Redux/Slices/Logics";
import BLANK_FORMULA from "./constants";
import OutlineButton from "../../../components/OutlineButton";
import useLogic from "./useLogic";
import moment from "moment";
import { useLoader } from "../../../Utils/Loader";

const CUSTOM_OPTION = [
  {
    dataset_name: "Custom",
    dataset_type: "Custom",
  },
];

const getNextDate = (dateString) => {
  return moment(dateString).add(1, "day").format("YYYY-MM-DD");
};

const SetLogics = ({ group, index }) => {
  const dispatch = useDispatch();
  const { setToastMessage, setLoading } = useLoader();
  const logicData = group?.recologic;
  let { tableList, activeLogic, logicGroups } = useSelector(
    (state) => state.LogicsService
  );

  const [dataSetOptions, setDataSetOptions] = useState(CUSTOM_OPTION);
  const { saveFormulas, validateFormula } = useLogic();
  useEffect(() => {
    let updatedDataset = CUSTOM_OPTION.concat(tableList);
    setDataSetOptions(updatedDataset);
  }, [tableList]);

  const [startDate, setStartDate] = useState(
    group?.effectiveFrom ? new Date(group?.effectiveFrom) : new Date()
  );

  const [endDate, setEndDate] = useState(
    group?.effectiveTo && group?.effectiveTo !== "2099-12-31"
      ? new Date(group?.effectiveTo)
      : ""
  );

  function optionsForDataSet(index) {
    let options = CUSTOM_OPTION.concat(tableList);
    for (let i = 0; i < index; i++) {
      options.push({
        ...logicData[i],
        dataset_name: logicData[i].logicNameKey,
        dataset_type: "Formula",
      });
    }
    return options;
  }

  const addNewFormula = () => {
    let optionDataset = optionsForDataSet(logicData?.length);
    setDataSetOptions(optionDataset);
    dispatch(setActiveLogicIndex(-1));
    dispatch(setActiveLogic({ ...BLANK_FORMULA, active_group_index: index }));
  };

  const editFormula = (logicItem, formulaIndex) => {
    let optionDataset = optionsForDataSet(formulaIndex);
    setDataSetOptions(optionDataset);
    dispatch(setActiveLogicIndex(formulaIndex));

    if (logicItem?.error) {
      let allItems = [...logicData];
      allItems[formulaIndex] = { ...logicItem, error: undefined };
      dispatch(setLogicData(allItems));
    }

    dispatch(
      setActiveLogic({
        ...logicItem,
        error: undefined,
        active_group_index: index,
      })
    );
  };

  const deleteFormula = (logicIndex) => {
    let localLogicData = [...logicData];
    localLogicData?.splice(logicIndex, 1);
    let logicGroupList = [...logicGroups];
    logicGroupList[index] = {
      ...logicGroups[index],
      recologic: localLogicData,
    };
    dispatch(setLogicGroups(logicGroupList));
    dispatch(setLogicData(localLogicData));
  };

  const validateAndSave = () => {
    let requestObj = validateFormula(
      group?.effectiveType,
      moment(startDate).format("YYYY-MM-DD"),
      endDate ? moment(endDate).format("YYYY-MM-DD") : ""
    );

    if (requestObj.isValid) {
      saveFormulas({ ...requestObj, id: group?.id || undefined });
    } else {
      let localLogicData = [...requestObj?.response];
      let logicGroupList = [...logicGroups];
      logicGroupList[index] = {
        ...logicGroups[index],
        recologic: localLogicData,
      };
      dispatch(setLogicGroups(logicGroupList));
      dispatch(setLogicData(localLogicData));
    }
  };

  const handleDateChangeRaw = (e) => {
    e.preventDefault();
  };

  const handleMasterFieldChanges = (name, value) => {
    let logicGroupList = [...logicGroups];
    let ele = {
      ...group,
      [name]: value,
    };
    logicGroupList[index] = ele;
    dispatch(setLogicGroups(logicGroupList));
  };

  const copyGroup = () => {
    let logicGroupList = [...logicGroups];
    if (group?.effectiveTo === "" || group?.effectiveTo === "2099-12-31") {
      setToastMessage({
        message:
          "Cannot copy this group. Please add effect to date and save before copying.",
        type: "error",
      });
      return;
    }
    let ele = {
      ...group,
      effectiveFrom: getNextDate(group?.effectiveTo),
      effectiveTo: "",
      id: undefined,
    };
    logicGroupList.push(ele);
    dispatch(setLogicGroups(logicGroupList));
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setToastMessage({
        message: "Group successfully copied",
        type: "success",
      });
    }, 3000);
  };

  return (
    <div className="p-6 flex-1 font-Roboto">
      <p className="mb-2 text-black">Apply On</p>
      <div className="flex mb-3 gap-5">
        <div className="flex justify-center items-center gap-2">
          <input
            style={{ boxShadow: "none" }}
            type="checkbox"
            checked={group?.effectiveType === "business_date"}
            onChange={() => null}
            onClick={() =>
              handleMasterFieldChanges("effectiveType", "business_date")
            }
          />
          <p className="text-nowrap">Business Date</p>
        </div>
        <div className="flex justify-start items-center gap-2">
          <input
            style={{ boxShadow: "none" }}
            type="checkbox"
            checked={group?.effectiveType === "transaction_date"}
            onChange={() => null}
            onClick={() =>
              handleMasterFieldChanges("effectiveType", "transaction_date")
            }
          />
          <p className="text-nowrap">Transaction Date</p>
        </div>
      </div>
      <div className="flex justify-between">
        <div className="flex gap-4" style={{ flex: 2 }}>
          <div className="flex-1">
            <p>
              Effect from date <span style={{ color: "#ff0000" }}>*</span>
            </p>
            <DatePicker
              // minDate={new Date()}
              dateFormat="dd-MM-YYYY"
              selected={startDate}
              onChange={(date) => {
                setStartDate(date);
                handleMasterFieldChanges(
                  "effectiveFrom",
                  moment(date).format("YYYY-MM-DD")
                );
              }}
              onChangeRaw={handleDateChangeRaw}
            />
          </div>
          <div className="flex-1">
            <div className="flex gap-1 items-center">
              <p>Effect to date</p>
              <a
                className="clear-link"
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  setEndDate("");
                  handleMasterFieldChanges("effectiveTo", null);
                }}
              >
                (Clear)
              </a>
            </div>
            <DatePicker
              minDate={startDate}
              dateFormat="dd-MM-YYYY"
              selected={endDate}
              // onChange={(date) => setEndDate(date)}
              onChange={(date) => {
                setEndDate(date);
                handleMasterFieldChanges(
                  "effectiveTo",
                  moment(date).format("YYYY-MM-DD")
                );
              }}
              onChangeRaw={handleDateChangeRaw}
            />
            <p style={{ fontSize: "12px" }}>
              if blank, meaning it will continue to apply.
            </p>
          </div>
        </div>
        <div className="flex-1"></div>
        <div className="flex gap-3 w-82 justify-center items-center">
          <OutlineButton
            label="ADD FORMULA"
            onClick={() => addNewFormula()}
            style={{ minWidth: "120px" }}
          />
          {logicData?.length > 0 && (
            <OutlineButton
              label="COPY GROUP"
              onClick={() => copyGroup()}
              style={{ minWidth: "120px" }}
            />
          )}
          <PrimaryButton label="SAVE" onClick={validateAndSave} />
        </div>
      </div>
      <div className="mt-3">
        {logicData?.map((logicItem, index) => {
          return (
            <div
              className={`formula-box ${logicItem.error ? "error-border" : ""}`}
              key={logicItem.logicName}
            >
              <div className="formula-box-heading flex justify-between">
                <b>{logicItem.logicName}</b>
                <div className="flex gap-3">
                  <button onClick={() => editFormula(logicItem, index)}>
                    <i className="fa-solid fa-pencil"></i>
                  </button>
                  <button onClick={() => deleteFormula(index)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
              <div className="formula-box-content">
                {logicItem.excelFormulaText}
              </div>
              {logicItem?.error && (
                <div className="error-box">{logicItem?.error}</div>
              )}
            </div>
          );
        })}
      </div>
      {activeLogic !== null && activeLogic?.active_group_index === index && (
        <FormulaModal dataSetOptions={dataSetOptions} />
      )}
    </div>
  );
};

export default SetLogics;
