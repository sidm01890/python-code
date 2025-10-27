import React, { useState } from "react";
import { apiEndpoints } from "../../../ServiceRequest/APIEndPoints";
import {
  requestCallGet,
  requestCallPost,
} from "../../../ServiceRequest/APIFunctions";
import { useDispatch, useSelector } from "react-redux";
import {
  setCityList,
  setDashboard3POData,
  setDashboardData,
  setDataEffectiveDate,
  setLoadingDashboard,
  setStoreList,
  setTenderWiseStoresMissedInMapping,
} from "../../../Redux/Slices/Common";
import { useLoader } from "../../../Utils/Loader";
import { setReconciliation3POData } from "../../../Redux/Slices/Reconciliation";
import useMakeLogs from "../../../Hooks/useMakeLogs";
import LOG_ACTIONS from "../../../Constants/LogAction";
import moment from "moment";

const useDashboard = () => {
  const dispatch = useDispatch();
  const { setToastMessage, setLoading } = useLoader();
  const { makeLog } = useMakeLogs();
  let { currentDashboardRequest } = useSelector((state) => state.CommonService);

  const fetchOldEffectiveDate = async () => {
    try {
      const response = await requestCallGet(
        apiEndpoints.FIND_OLDEST_EFFECTIVE_DATE
      );
      if (response.status) {
        dispatch(setDataEffectiveDate(response?.data?.data));
      }
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  const fetchCityList = async () => {
    try {
      const response = await requestCallGet(apiEndpoints.GET_CITY_LIST_DATA);
      if (response.status) {
        dispatch(setCityList(response?.data?.data));
        return response?.data?.data;
      }
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  const fetchStoreList = async (params) => {
    try {
      const response = await requestCallPost(
        apiEndpoints.GET_STORE_LIST_DATA,
        params
      );
      if (response.status) {
        dispatch(setStoreList(response?.data?.data));
        return response?.data?.data;
      }
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  const fetchTenderWiseStoresMissedInMapping = async () => {
    try {
      const response = await requestCallGet(apiEndpoints.MISSING_STORE_MAPPING);
      if (response.status) {
        dispatch(setTenderWiseStoresMissedInMapping(response?.data?.data));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getDashboard = async (params) => {
    getDashboard3POData(params);
    dispatch(setLoadingDashboard(true));
    setLoading(true);
    try {
      const response = await requestCallPost(
        apiEndpoints.DASHBOARD_DATA,
        params
      );
      if (response.status) {
        makeLog(
          LOG_ACTIONS.SEARCH,
          "Dashboard Data",
          apiEndpoints.DASHBOARD_DATA,
          {
            ...params,
            dashboard_type: "fetch_dashboard",
          }
        );
        dispatch(setDashboardData(response?.data?.data));
        dispatch(setLoadingDashboard(false));
        setTimeout(() => {
          setLoading(false);
          dispatch(setLoadingDashboard(false));
        }, 1000);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getDashboard3POData = async (params, reconciliation = false) => {
    try {
      const response = await requestCallPost(apiEndpoints._3PO_DATA, params);
      dispatch(setLoadingDashboard(false));
      if (reconciliation) {
        dispatch(setLoadingDashboard(true));
        setLoading(true);
      }
      if (response.status) {
        if (reconciliation) {
          makeLog(
            LOG_ACTIONS.SEARCH,
            "Reconciliation Dashboard Data",
            apiEndpoints._3PO_DATA,
            {
              ...params,
              dashboard_type: "fetch_reconciliation_dashboard",
            }
          );
          dispatch(setReconciliation3POData(response?.data?.data));
          setTimeout(() => {
            setLoading(false);
            dispatch(setLoadingDashboard(false));
          }, 1000);
        } else {
          makeLog(
            LOG_ACTIONS.SEARCH,
            "3PO Dashboard Data",
            apiEndpoints._3PO_DATA,
            {
              ...params,
              dashboard_type: "fetch_3po_dashboard",
            }
          );
          dispatch(setDashboard3POData(response?.data?.data));
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const downloadAsyncReport = async (params) => {
    if (params?.reportType === "POSVsThreePO") {
      try {
        // setLoading(true);
        const response = await requestCallPost(
          apiEndpoints.POS_VS_3PO_SUMMARY_DOWNLOAD,
          currentDashboardRequest
        );
        // setLoading(false);
        // dispatch(setLoadingDashboard(false));
        if (response.status) {
          setToastMessage({
            message: "Request submitted for generating report.",
            type: "success",
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }

      return;
    } else if (params?.reportType === "ReceivableVsReceipts") {
      try {
        // setLoading(true);
        const response = await requestCallPost(
          apiEndpoints.RECEIVABLE_VS_RECEIPT_SUMMARY_DOWNLOAD,
          currentDashboardRequest
        );
        // setLoading(false);
        // dispatch(setLoadingDashboard(false));
        if (response.status) {
          setToastMessage({
            message: "Request submitted for generating report.",
            type: "success",
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }

      return;
    }

    setToastMessage({
      message: "Reports generation is disabled",
      type: "error",
    });

    return;

    try {
      let req = {
        ...params,
        ...currentDashboardRequest,
      };
      setLoading(true);
      const response = await requestCallPost(
        apiEndpoints.DOWNLOAD_ASYNC_DASHBOARD_REPORT,
        req
      );
      setLoading(false);
      dispatch(setLoadingDashboard(false));
      if (response.status) {
        makeLog(
          LOG_ACTIONS.DOWNLOAD_REPORT,
          `${params?.reportType} (${params?.tender})`,
          apiEndpoints.DOWNLOAD_ASYNC_DASHBOARD_REPORT,
          { ...req, report_type: "generate_dashboard_report" }
        );
        setToastMessage({
          message: "Request submitted for generating report.",
          type: "success",
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const downloadStoreReport = async (params) => {
    try {
      let req = {
        ...params,
        ...currentDashboardRequest,
      };
      setLoading(true);
      // setToastMessage({
      //   message: "Request submitted for generating report.",
      //   type: "success",
      // });
      const response = await requestCallPost(
        apiEndpoints.DOWNLOAD_STORE_TEMPLATE_DATA,
        req
      );
      setLoading(false);
      dispatch(setLoadingDashboard(false));
      if (response.status) {
        makeLog(
          LOG_ACTIONS.DOWNLOAD_REPORT,
          "Download Store Sync Report",
          apiEndpoints.DOWNLOAD_STORE_TEMPLATE_DATA,
          { ...req, report_type: "generate_store_report" }
        );
        setToastMessage({
          message: "Request submitted for generating report.",
          type: "success",
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  return {
    fetchCityList,
    fetchStoreList,
    getDashboard,
    downloadAsyncReport,
    downloadStoreReport,
    fetchTenderWiseStoresMissedInMapping,
    getDashboard3POData,
    fetchOldEffectiveDate,
  };
};

export default useDashboard;
