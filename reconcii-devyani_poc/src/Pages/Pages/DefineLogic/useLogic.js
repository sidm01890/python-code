import React, { useEffect, useState } from "react";
import { apiEndpoints } from "../../../ServiceRequest/APIEndPoints";
import {
  requestCallGet,
  requestCallPost,
} from "../../../ServiceRequest/APIFunctions";
import { useDispatch, useSelector } from "react-redux";
import {
  setActiveTender,
  setDBLogicId,
  setLogicData,
  setLogicGroups,
  setTableList,
  setTenderList,
} from "../../../Redux/Slices/Logics";
import { useLoader } from "../../../Utils/Loader";
import useMakeLogs from "../../../Hooks/useMakeLogs";
import moment from "moment";
import LOG_ACTIONS from "../../../Constants/LogAction";
const useLogic = () => {
  const dispatch = useDispatch();
  const { makeLog } = useMakeLogs();
  const { setLoading, setToastMessage } = useLoader();
  let { logicData, activeTender, dbLogicId } = useSelector(
    (state) => state.LogicsService
  );

  const saveFormulas = async (reqObj) => {
    try {
      let url = apiEndpoints.SAVE_ALL_RECO_LOGICS;
      let requestObj = {
        tenders: activeTender,
        recoData: reqObj?.response,
        effectiveFrom: reqObj?.effectiveFrom,
        effectiveTo: reqObj?.effectiveTo,
        effectiveType: reqObj?.effectiveType,
        id: reqObj?.id || undefined,
      };

      if (reqObj?.id) {
        url = apiEndpoints.UPDATE_ALL_RECO_LOGICS;
      }

      const response = await requestCallPost(url, requestObj);
      if (response.status) {
        if (response?.data?.code === 500) {
          setToastMessage({
            message: response?.data?.message,
            type: "error",
          });
        } else {
          makeLog(LOG_ACTIONS.UPDATE, "Update Logics", url, {
            ...requestObj,
            update_type: "save_defined_logics",
          });
          setToastMessage({
            message: "Formula successfully added/updated",
            type: "success",
          });
          getSavedFormulas(activeTender);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getSavedFormulas = async (tenderList) => {
    try {
      let params = {
        tenders: tenderList,
      };
      const response = await requestCallPost(
        apiEndpoints.GET_RECO_LOGICS_BY_TOPIC,
        params
      );
      if (response.status && response.data?.data?.length > 0) {
        try {
          let logicGroupList = [];
          response.data?.data?.forEach((group) => {
            let logicJson = [];
            try {
              logicJson = JSON.parse(group?.recologic);
            } catch (e) {
              console.error(e);
            }
            let ele = {
              ...group,
              recologic: logicJson,
            };
            logicGroupList?.push(ele);
          });
          dispatch(setLogicGroups(logicGroupList));

          let savedLogic = JSON.parse(response.data?.data[0]?.recologic);
          dispatch(setLogicData(savedLogic));
          dispatch(setDBLogicId(response.data?.data[0]?.id));
        } catch (e) {
          console.log(e);
          dispatch(setDBLogicId(null));
        }
      } else {
        dispatch(
          setLogicGroups([
            {
              tender: tenderList?.join(","),
              createdBy: "ADMIN",
              effectiveFrom: moment().format("YYYY-MM-DD"),
              effectiveType: "business_date",
            },
          ])
        );
        dispatch(setDBLogicId(null));
      }
    } catch (error) {
      dispatch(setDBLogicId(null));
    } finally {
      setLoading(false);
    }
  };

  const getTenderList = async () => {
    try {
      const response = await requestCallGet(apiEndpoints.GET_TENDER_LIST);
      if (response.status) {
        dispatch(setTenderList(response?.data));
      }
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  const getTableList = async (tenders) => {
    if (tenders.length === 0) {
      dispatch(setTableList([]));
      return;
    }
    let tenderList = tenders?.map((tender) => tender?.value);
    getSavedFormulas(tenderList);

    try {
      let params = {
        tenders: tenderList,
      };
      dispatch(setActiveTender(tenderList));
      dispatch(setLogicData([]));
      const response = await requestCallPost(
        apiEndpoints.GET_TENDER_WISE_TABLES_LIST,
        params
      );

      if (response.status && response?.data?.data?.length > 0) {
        let tables = [];
        response?.data?.data?.forEach((tender) => {
          tender?.dataSourceWiseColumns.forEach((dataSource) => {
            tables.push({
              ...dataSource,
              tender: tender.tender,
              dataset_name: dataSource?.dataSourceName,
            });
          });
        });
        dispatch(setTableList(tables));
      }
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  const extractUppercaseVariables = (formula) => {
    // Regular expression to match uppercase words (allowing dot notation)
    const uppercaseWords = formula.match(/\b[A-Z_]+\b/g) || [];
    return uppercaseWords;
  };

  const checkArraySubset = (subset, superset) => {
    const missingItems = subset.filter((item) => !superset.includes(item));
    return {
      isSubset: missingItems.length === 0, // true if no missing items
      missingItems, // array of missing items
    };
  };

  const addBracketsOnVariables = (input) => {
    const output = input.replace(/\b[A-Z_]+\b/g, (match) => `<${match}>`);
    return output;
  };

  const validateFormula = (effectiveType, effectiveFrom, effectiveTo) => {
    setLoading(true);
    let allFormulas = [...logicData];
    let formulaNames = [];
    let validationStatus = true;
    let verifiedFormula = allFormulas?.map((formula) => {
      // Validate this formula name first
      if (formulaNames?.includes(formula?.logicNameKey)) {
        formula = { ...formula, error: "Duplicate Formula Name" };
        validationStatus = false;
        return formula;
      }
      // Get Other Formula used in this Formula
      let otherFormulas = extractUppercaseVariables(formula?.formulaText);
      if (otherFormulas?.length > 0) {
        let status = checkArraySubset(otherFormulas, formulaNames);
        if (!status?.isSubset) {
          validationStatus = false;
          formula = {
            ...formula,
            error: `${status?.missingItems[0]} is undefined.`,
          };
          return formula;
        }
      }

      let dbFields = [];
      formula?.fields.forEach((formField) => {
        if (
          formField?.type === "data_field" &&
          formField?.selectedTableColumn
        ) {
          if (Array.isArray(formField?.selectedTableColumn)) {
            formField?.selectedTableColumn?.forEach((singleField) => {
              let field = formField?.selectedTableName + "." + singleField;
              dbFields?.push(field);
            });
          } else {
            let field =
              formField?.selectedTableName +
              "." +
              formField?.selectedTableColumn;
            dbFields?.push(field);
          }
        }
      });

      let response = {
        ...formula,
        tender: activeTender,
        effectiveFrom: effectiveFrom,
        effectiveTo: effectiveTo,
        effectiveType: effectiveType,
        recoLogic: {
          [formula.logicNameKey]: addBracketsOnVariables(formula?.formulaText),
        },
        dbFields: dbFields?.join(", "),
        createdBy: "ADMIN",
      };
      formulaNames?.push(formula.logicNameKey);
      return response;
    });

    dispatch(setLogicData(verifiedFormula));
    if (!validationStatus) {
      setLoading(false);
    }

    return {
      isValid: validationStatus,
      response: verifiedFormula,
      effectiveFrom: effectiveFrom,
      effectiveTo: effectiveTo,
      effectiveType: effectiveType,
    };
  };

  return {
    saveFormulas,
    getTenderList,
    getTableList,
    validateFormula,
  };
};

export default useLogic;
