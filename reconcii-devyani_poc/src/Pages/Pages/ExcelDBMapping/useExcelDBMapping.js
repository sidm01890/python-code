import React, { useState } from "react";
import { apiEndpoints } from "../../../ServiceRequest/APIEndPoints";
import {
  requestCallGet,
  requestCallPost,
} from "../../../ServiceRequest/APIFunctions";
import { useDispatch } from "react-redux";
import { useLoader } from "../../../Utils/Loader";
import useMakeLogs from "../../../Hooks/useMakeLogs";
import LOG_ACTIONS from "../../../Constants/LogAction";

const BLANK_FILTER = {
  category: "",
  tender: "",
  tender_item: {},
};

const useExcelDBMapping = () => {
  const { makeLog } = useMakeLogs();
  const { setLoading, setToastMessage } = useLoader();
  const [dataCategoryList, setDataCategoryList] = useState([]);
  const [filterParams, setFilterParams] = useState(BLANK_FILTER);
  const [tenderList, setTenderList] = useState([]);
  const [mappingData, setMappingData] = useState({});
  const [currentMapping, setCurrentMapping] = useState([]);
  const handleFilterParams = (name, value) => {
    if (name === "category") {
      if (value !== "") {
        setFilterParams({
          ...filterParams,
          [name]: value,
          tender: "",
          tender_item: {},
        });
        let selectedCategory = dataCategoryList?.filter(
          (category) => category?.category === value
        );
        if (selectedCategory?.length > 0) {
          setTenderList(selectedCategory[0]?.tenders);
          return;
        }
      }
      setTenderList([]);
    } else {
      setFilterParams({
        ...filterParams,
        tender: value?.value || "",
        tender_item: value,
      });
      getExcelDbMappingByDataSource(value?.value);
    }
  };

  const getDataSourceList = async () => {
    setLoading(true);
    try {
      const response = await requestCallGet(
        `${apiEndpoints.NEW_DATA_SOURCE_FIELDS}`
      );
      if (response.status) {
        setDataCategoryList(response?.data?.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const getExcelDbMappingByDataSource = async (dataSource) => {
    setLoading(true);
    try {
      const response = await requestCallGet(
        `${apiEndpoints.EXCEL_DB_COLUMN_MAPPING_BY_DATASOURCE}${dataSource}`
      );
      if (response.status) {
        setMappingData(response?.data?.data);
        setCurrentMapping(response?.data?.data?.mapping);
      } else {
        setMappingData({});
      }
    } catch (error) {
      setMappingData({});
      console.error(error);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const updateExcelDbMappingByDataSource = async (dataSource) => {
    setLoading(true);
    let reqParams = {
      dataSource: filterParams?.tender,
      mapping: currentMapping,
    };
    try {
      const response = await requestCallPost(
        `${apiEndpoints.UPDATE_EXCEL_DB_COLUMN_MAPPING_BY_DATASOURCE}`,
        reqParams
      );
      if (response.status) {
        makeLog(
          LOG_ACTIONS.UPDATE,
          "Updated Excel DB Mapping",
          apiEndpoints.UPDATE_EXCEL_DB_COLUMN_MAPPING_BY_DATASOURCE,
          { ...reqParams, type: "update_excel_db_mapping" }
        );
        setLoading(false);
        setFilterParams(BLANK_FILTER);
        setToastMessage({
          message: "Excel-DB column mapping successfully done.",
          type: "success",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
    return [];
  };

  return {
    getExcelDbMappingByDataSource,
    getDataSourceList,
    dataCategoryList,
    filterParams,
    handleFilterParams,
    tenderList,
    mappingData,
    currentMapping,
    setCurrentMapping,
    updateExcelDbMappingByDataSource,
  };
};

export default useExcelDBMapping;
