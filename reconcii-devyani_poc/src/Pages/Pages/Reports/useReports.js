import { useState, useRef, useEffect } from "react";
import { apiEndpoints } from "../../../ServiceRequest/APIEndPoints";
import {
  requestCallGet,
  requestCallPost,
} from "../../../ServiceRequest/APIFunctions";
import useMakeLogs from "../../../Hooks/useMakeLogs";
import LOG_ACTIONS from "../../../Constants/LogAction";
import { useLoader } from "../../../Utils/Loader";
import moment from "moment/moment";

const BLANK_CUSTOM_REPORT_PARAMS = {
  startDate: new Date(),
  endDate: new Date(),
  selectedTender: "",
  selectedColumns: [],
};

const useReports = () => {
  const pollingRef = useRef(null);
  const isUnmounted = useRef(false);

  const { makeLog } = useMakeLogs();
  const { setToastMessage, setLoading } = useLoader();
  const [generatedReports, setGeneratedReports] = useState([]);
  const [reportTenders, setReportTenders] = useState([]);
  const [reportColumns, setReportColumns] = useState([]);
  const [filterValues, setFilterValues] = useState(BLANK_CUSTOM_REPORT_PARAMS);

  useEffect(() => {
    isUnmounted.current = false;
    // fetchGeneratedReports();

    return () => {
      isUnmounted.current = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  const handleFilterChange = (name, value) => {
    if (name === "selectedTender") {
      fetchCustomReportFields(value);
      setFilterValues({ ...filterValues, [name]: value, selectedColumns: [] });
      return;
    }
    setFilterValues({ ...filterValues, [name]: value });
  };

  const fetchReportingTenders = async () => {
    try {
      const response = await requestCallGet(apiEndpoints.REPORTING_TENDERS);
      if (response.status) {
        // Only 3PO tender
        // let ThreePOTenders = response?.data?.data?.filter(
        //   (tenderType) => tenderType?.category === "3PO"
        // );
        // if (ThreePOTenders?.length > 0) {
        //   setReportTenders(ThreePOTenders[0]?.tenders);
        //   fetchCustomReportFields(ThreePOTenders[0]?.tenders[0]?.technicalName);
        //   setFilterValues({
        //     ...filterValues,
        //     selectedTender: ThreePOTenders[0]?.tenders[0]?.technicalName,
        //   });
        // }
        let reportingTenders = [];
        response?.data?.data?.forEach((category) => {
          reportingTenders = reportingTenders?.concat(category?.tenders);
        });
        if (reportingTenders?.length > 0) {
          setReportTenders(reportingTenders);
          fetchCustomReportFields(reportingTenders[0]?.technicalName);
          setFilterValues({
            ...filterValues,
            selectedTender: reportingTenders[0]?.technicalName,
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchCustomReportFields = async (category) => {
    try {
      const response = await requestCallGet(
        `${apiEndpoints.REPORT_FIELD}?category=${category}`
      );
      if (response.status) {
        setReportColumns(response?.data?.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchGeneratedReports = async () => {
    try {
      const response = await requestCallPost(
        apiEndpoints.GET_ASYNC_GENERATE_REPORT_DATA,
        {}
      );
      if (response.status) {
        const data = response?.data?.data || [];
        setGeneratedReports(data);

        const hasProcessing = data.some(
          (report) => report.status === "processing"
        );

        // Poll again in 10 seconds if needed
        if (hasProcessing && !isUnmounted.current) {
          pollingRef.current = setTimeout(fetchGeneratedReports, 10000);
        }
      }
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  const downloadGeneratedReports = async (record) => {
    try {
      let params = {
        id: record?.id,
      };
      setLoading(true);
      setToastMessage({
        message: "File download started.",
        type: "success",
      });
      const response = await requestCallGet(
        apiEndpoints.DOWNLOAD_ASYNC_GENERATE_REPORT_DATA,
        params,
        {},
        { responseType: "blob" }
      );
      setLoading(false);
      let res = response?.response;
      makeLog(
        LOG_ACTIONS.DOWNLOAD_REPORT,
        `${record?.reportType} (${record?.tender})`,
        apiEndpoints.DOWNLOAD_ASYNC_GENERATE_REPORT_DATA,
        { ...params, report_type: "downloaded_generated_reported_data" }
      );
      const { data = "" } = res || {};
      const fileName = record?.fileName;

      downloadReportsFun(data, fileName);
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  const downloadMissingMappedStores = async (tender) => {
    let params = {
      threepo: tender?.toLowerCase(),
    };
    setLoading(true);
    setToastMessage({
      message: "File download started.",
      type: "success",
    });
    const response = await requestCallGet(
      `${apiEndpoints.DOWNLOAD_MISSING_STORE_MAPPING}/threepo`,
      params,
      {},
      { responseType: "blob" }
    );
    setLoading(false);
    makeLog(
      LOG_ACTIONS.DOWNLOAD_REPORT,
      "Download Missing Store Mapping",
      apiEndpoints.DOWNLOAD_MISSING_STORE_MAPPING,
      { ...params, report_type: "downloaded_missing_mapped_stores" }
    );
    const fileName = "downloaded_file.xlsx";
    const data = response.data;
    downloadReportsFun(data, fileName);
  };

  const downloadCustomReports = async (tender) => {
    let body = {
      required_fields: filterValues?.selectedColumns,
      endDate: moment(filterValues?.endDate).format("YYYY-MM-DD 23:59:59"),
      startDate: moment(filterValues?.startDate).format("YYYY-MM-DD 00:00:00"),
      tender: filterValues?.selectedTender,
      stores: [],
    };
    setLoading(true);
    setToastMessage({
      message: "File download started.",
      type: "success",
    });
    const response = await requestCallPost(
      `${apiEndpoints.DOWNLOAD_REPORT}`,
      body,
      {},
      { responseType: "blob" }
    );
    setLoading(false);
    makeLog(
      LOG_ACTIONS.DOWNLOAD_REPORT,
      "Download Custom Report",
      apiEndpoints.DOWNLOAD_REPORT,
      { ...body, report_type: "downloaded_custom_report" }
    );
    const fileName = "custom_report.csv";
    const data = response.data;
    downloadCSV(data, fileName);
  };

  const downloadCSV = (csvData, filename) => {
    // Create a Blob object
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });

    // Check if the browser supports the HTML5 download attribute
    if (navigator.msSaveBlob) {
      // For IE and Edge
      navigator.msSaveBlob(blob, filename);
    } else {
      // Create a temporary anchor element
      const link = document.createElement("a");
      if (link.download !== undefined) {
        // Set the href attribute of the anchor element
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);

        // Append the anchor element to the body
        document.body.appendChild(link);

        // Trigger the click event to download the CSV file
        link.click();

        // Clean up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        console.error("Your browser does not support downloading files.");
      }
    }
  };

  const downloadReportsFun = (blob, fileName) => {
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob); // Creates an object URL for the Blob
    downloadLink.download = fileName; // Assign the file name
    downloadLink.click(); // Simulate the click to download the file
  };

  return {
    generatedReports,
    reportTenders,
    reportColumns,
    filterValues,
    fetchGeneratedReports,
    downloadGeneratedReports,
    downloadMissingMappedStores,
    fetchReportingTenders,
    handleFilterChange,
    setFilterValues,
    downloadCustomReports,
  };
};

export default useReports;
