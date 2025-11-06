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
    dispatch(setLoadingDashboard(true));
    setLoading(true);
    try {
      // Call both APIs in parallel and wait for both to complete
      const [dashboardResponse, threePOResponse] = await Promise.all([
        requestCallPost(apiEndpoints.DASHBOARD_DATA, params),
        requestCallPost(apiEndpoints._3PO_DATA, params),
      ]);

      // Process dashboard data
      if (dashboardResponse.status) {
        makeLog(
          LOG_ACTIONS.SEARCH,
          "Dashboard Data",
          apiEndpoints.DASHBOARD_DATA,
          {
            ...params,
            dashboard_type: "fetch_dashboard",
          }
        );
        dispatch(setDashboardData(dashboardResponse?.data?.data));
      } else {
        console.error("Dashboard data API failed:", dashboardResponse.message);
      }

      // Process 3PO data
      if (threePOResponse.status) {
        makeLog(
          LOG_ACTIONS.SEARCH,
          "3PO Dashboard Data",
          apiEndpoints._3PO_DATA,
          {
            ...params,
            dashboard_type: "fetch_3po_dashboard",
          }
        );
        dispatch(setDashboard3POData(threePOResponse?.data?.data));
      } else {
        console.error("3PO data API failed:", threePOResponse.message);
      }

      // Only set loading false after both APIs complete and data is dispatched
      dispatch(setLoadingDashboard(false));
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error in getDashboard:", error);
      dispatch(setLoadingDashboard(false));
      setLoading(false);
    }
  };

  const getDashboard3POData = async (params, reconciliation = false) => {
    try {
      if (reconciliation) {
        dispatch(setLoadingDashboard(true));
        setLoading(true);
      }
      const response = await requestCallPost(apiEndpoints._3PO_DATA, params);
      
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
          }, 500);
        } else {
          // Note: This branch is now handled in getDashboard() with Promise.all()
          // Keeping for backward compatibility if called directly
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
      } else {
        console.error("3PO data API failed:", response.message);
        if (reconciliation) {
          dispatch(setLoadingDashboard(false));
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Error in getDashboard3POData:", error);
      if (reconciliation) {
        dispatch(setLoadingDashboard(false));
        setLoading(false);
      }
    }
  };

  const downloadAsyncReport = async (params) => {
    console.log("[downloadAsyncReport] ===== START =====");
    console.log("[downloadAsyncReport] Called with params:", JSON.stringify(params, null, 2));
    console.log("[downloadAsyncReport] currentDashboardRequest from Redux selector:", JSON.stringify(currentDashboardRequest, null, 2));
    
    // Use the value from selector (should be reactive)
    const dashboardRequest = currentDashboardRequest;
    
    console.log("[downloadAsyncReport] Dashboard request to use:", JSON.stringify(dashboardRequest, null, 2));
    
    if (params?.reportType === "POSVsThreePO") {
      console.log("[downloadAsyncReport] Processing POSVsThreePO report type");
      
      // Validate payload before sending
      if (!dashboardRequest || 
          !dashboardRequest.startDate || 
          !dashboardRequest.endDate || 
          !dashboardRequest.stores || 
          !Array.isArray(dashboardRequest.stores) ||
          dashboardRequest.stores.length === 0) {
        console.error("[downloadAsyncReport] ❌ Invalid payload - missing required fields:", {
          hasRequest: !!dashboardRequest,
          hasStartDate: !!dashboardRequest?.startDate,
          startDateValue: dashboardRequest?.startDate,
          hasEndDate: !!dashboardRequest?.endDate,
          endDateValue: dashboardRequest?.endDate,
          hasStores: !!dashboardRequest?.stores,
          isStoresArray: Array.isArray(dashboardRequest?.stores),
          storesLength: dashboardRequest?.stores?.length,
          storesValue: dashboardRequest?.stores,
          fullRequest: JSON.stringify(dashboardRequest, null, 2)
        });
        setToastMessage({
          message: "Please search with filters (date range and stores) before downloading the report.",
          type: "error",
        });
        console.log("[downloadAsyncReport] ===== END (Validation Failed) =====");
        return;
      }

      // Prepare payload with correct field names matching backend expectation
      const payload = {
        startDate: dashboardRequest.startDate,
        endDate: dashboardRequest.endDate,
        stores: dashboardRequest.stores,
      };

      console.log("[downloadAsyncReport] ✅ Payload validated successfully");
      console.log("[downloadAsyncReport] 📤 Sending payload to generate-excel:");
      console.log(JSON.stringify(payload, null, 2));
      console.log("[downloadAsyncReport] Payload details:", {
        startDate: payload.startDate,
        endDate: payload.endDate,
        storesCount: payload.stores?.length,
        firstFewStores: payload.stores?.slice(0, 5),
        lastFewStores: payload.stores?.slice(-5)
      });
      console.log("[downloadAsyncReport] API endpoint:", apiEndpoints.POS_VS_3PO_SUMMARY_DOWNLOAD);

      try {
        setLoading(true);
        console.log("[downloadAsyncReport] Making API call...");
        const response = await requestCallPost(
          apiEndpoints.POS_VS_3PO_SUMMARY_DOWNLOAD,
          payload
        );
        
        console.log("[downloadAsyncReport] 📥 Response received:", JSON.stringify(response, null, 2));
        
        if (response.status) {
          setToastMessage({
            message: "Request submitted for generating report.",
            type: "success",
          });
        } else {
          console.error("[downloadAsyncReport] ❌ API returned error status:", response);
          setToastMessage({
            message: response?.data?.detail || response?.message || "Failed to generate report. Please try again.",
            type: "error",
          });
        }
      } catch (error) {
        console.error("[downloadAsyncReport] ❌ Exception caught:", error);
        console.error("[downloadAsyncReport] Error details:", {
          message: error?.message,
          response: error?.response?.data ? JSON.stringify(error.response.data, null, 2) : "No response data",
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          config: error?.config ? {
            url: error.config.url,
            method: error.config.method,
            data: error.config.data
          } : "No config"
        });
        setToastMessage({
          message: error?.response?.data?.detail || error?.message || "Failed to generate report. Please try again.",
          type: "error",
        });
      } finally {
        setLoading(false);
        console.log("[downloadAsyncReport] ===== END (POSVsThreePO) =====");
      }

      return;
    } else if (params?.reportType === "ReceivableVsReceipts") {
      console.log("[downloadAsyncReport] Processing ReceivableVsReceipts report type");
      
      // Validate payload before sending
      if (!dashboardRequest || 
          !dashboardRequest.startDate || 
          !dashboardRequest.endDate || 
          !dashboardRequest.stores || 
          !Array.isArray(dashboardRequest.stores) ||
          dashboardRequest.stores.length === 0) {
        console.error("[downloadAsyncReport] ❌ Invalid payload for ReceivableVsReceipts - missing required fields:", {
          hasRequest: !!dashboardRequest,
          hasStartDate: !!dashboardRequest?.startDate,
          startDateValue: dashboardRequest?.startDate,
          hasEndDate: !!dashboardRequest?.endDate,
          endDateValue: dashboardRequest?.endDate,
          hasStores: !!dashboardRequest?.stores,
          isStoresArray: Array.isArray(dashboardRequest?.stores),
          storesLength: dashboardRequest?.stores?.length,
          storesValue: dashboardRequest?.stores,
          fullRequest: JSON.stringify(dashboardRequest, null, 2)
        });
        setToastMessage({
          message: "Please search with filters (date range and stores) before downloading the report.",
          type: "error",
        });
        console.log("[downloadAsyncReport] ===== END (Validation Failed) =====");
        return;
      }

      // Prepare payload with correct field names matching backend expectation
      const payload = {
        startDate: dashboardRequest.startDate,
        endDate: dashboardRequest.endDate,
        stores: dashboardRequest.stores,
      };

      console.log("[downloadAsyncReport] ✅ Payload validated successfully");
      console.log("[downloadAsyncReport] 📤 Sending payload to generate-receivable-receipt-excel:");
      console.log(JSON.stringify(payload, null, 2));
      console.log("[downloadAsyncReport] Payload details:", {
        startDate: payload.startDate,
        endDate: payload.endDate,
        storesCount: payload.stores?.length,
        firstFewStores: payload.stores?.slice(0, 5),
        lastFewStores: payload.stores?.slice(-5)
      });
      console.log("[downloadAsyncReport] API endpoint:", apiEndpoints.RECEIVABLE_VS_RECEIPT_SUMMARY_DOWNLOAD);

      try {
        setLoading(true);
        console.log("[downloadAsyncReport] Making API call...");
        const response = await requestCallPost(
          apiEndpoints.RECEIVABLE_VS_RECEIPT_SUMMARY_DOWNLOAD,
          payload
        );
        
        console.log("[downloadAsyncReport] 📥 Response received:", JSON.stringify(response, null, 2));
        
        if (response.status) {
          setToastMessage({
            message: "Request submitted for generating report.",
            type: "success",
          });
        } else {
          console.error("[downloadAsyncReport] ❌ API returned error status:", response);
          setToastMessage({
            message: response?.data?.detail || response?.message || "Failed to generate report. Please try again.",
            type: "error",
          });
        }
      } catch (error) {
        console.error("[downloadAsyncReport] ❌ Exception caught:", error);
        console.error("[downloadAsyncReport] Error details:", {
          message: error?.message,
          response: error?.response?.data ? JSON.stringify(error.response.data, null, 2) : "No response data",
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          config: error?.config ? {
            url: error.config.url,
            method: error.config.method,
            data: error.config.data
          } : "No config"
        });
        setToastMessage({
          message: error?.response?.data?.detail || error?.message || "Failed to generate report. Please try again.",
          type: "error",
        });
      } finally {
        setLoading(false);
        console.log("[downloadAsyncReport] ===== END (ReceivableVsReceipts) =====");
      }

      return;
    }
    
    console.log("[downloadAsyncReport] Unknown report type, ending flow");
    console.log("[downloadAsyncReport] ===== END (Unknown Type) =====");
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

  const downloadSummaryReport = async () => {
    console.log("[downloadSummaryReport] ===== START =====");
    console.log("[downloadSummaryReport] currentDashboardRequest:", JSON.stringify(currentDashboardRequest, null, 2));
    
    // Use the value from selector
    const dashboardRequest = currentDashboardRequest;
    
    // Validate payload before sending
    if (!dashboardRequest || 
        !dashboardRequest.startDate || 
        !dashboardRequest.endDate || 
        !dashboardRequest.stores || 
        !Array.isArray(dashboardRequest.stores) ||
        dashboardRequest.stores.length === 0) {
      console.error("[downloadSummaryReport] ❌ Invalid payload - missing required fields:", {
        hasRequest: !!dashboardRequest,
        hasStartDate: !!dashboardRequest?.startDate,
        hasEndDate: !!dashboardRequest?.endDate,
        hasStores: !!dashboardRequest?.stores,
        isStoresArray: Array.isArray(dashboardRequest?.stores),
        storesLength: dashboardRequest?.stores?.length,
      });
      setToastMessage({
        message: "Please search with filters (date range and stores) before downloading the summary report.",
        type: "error",
      });
      console.log("[downloadSummaryReport] ===== END (Validation Failed) =====");
      return;
    }

    // Prepare payload with correct field names matching backend expectation
    const payload = {
      startDate: dashboardRequest.startDate,
      endDate: dashboardRequest.endDate,
      stores: dashboardRequest.stores,
    };

    console.log("[downloadSummaryReport] ✅ Payload validated successfully");
    console.log("[downloadSummaryReport] 📤 Sending payload to summary-sheet:");
    console.log(JSON.stringify(payload, null, 2));
    console.log("[downloadSummaryReport] API endpoint:", apiEndpoints.SUMMARY_SHEET_DOWNLOAD);

    try {
      setLoading(true);
      console.log("[downloadSummaryReport] Making API call...");
      const response = await requestCallPost(
        apiEndpoints.SUMMARY_SHEET_DOWNLOAD,
        payload
      );
      
      console.log("[downloadSummaryReport] 📥 Response received:", JSON.stringify(response, null, 2));
      
      if (response.status) {
        setToastMessage({
          message: "Request submitted for generating summary report.",
          type: "success",
        });
      } else {
        console.error("[downloadSummaryReport] ❌ API returned error status:", response);
        setToastMessage({
          message: response?.data?.detail || response?.message || "Failed to generate summary report. Please try again.",
          type: "error",
        });
      }
    } catch (error) {
      console.error("[downloadSummaryReport] ❌ Exception caught:", error);
      console.error("[downloadSummaryReport] Error details:", {
        message: error?.message,
        response: error?.response?.data ? JSON.stringify(error.response.data, null, 2) : "No response data",
        status: error?.response?.status,
      });
      setToastMessage({
        message: error?.response?.data?.detail || error?.message || "Failed to generate summary report. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
      console.log("[downloadSummaryReport] ===== END =====");
    }
  };

  return {
    fetchCityList,
    fetchStoreList,
    getDashboard,
    downloadAsyncReport,
    downloadStoreReport,
    downloadSummaryReport,
    fetchTenderWiseStoresMissedInMapping,
    getDashboard3POData,
    fetchOldEffectiveDate,
  };
};

export default useDashboard;
