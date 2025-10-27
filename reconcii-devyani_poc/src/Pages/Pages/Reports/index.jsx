import React, { useEffect, useRef, useState } from "react";
import BlankCard from "../../../components/BlankCard";

import "./reports.style.css";
import useReports from "./useReports";
// import PrimaryButton from "../../../components/PrimaryButton";
// import DropdownWithCheckbox from "../../../components/DropDownWithCheckbox";
// import DateRangeComponent from "../../../components/DateRange";
// import CustomSelect from "../../../components/CustomSelect";
import moment from "moment";
import { reconciiAdminBaseURL } from "../../../ServiceRequest/APIEndPoints";
import spinner from "../../../assets/Images/spinner.gif";
const STATIC_REPORTS = [
  {
    id: "03",
    reportType: "POSVsTRM",
    startDate: "Nov 1 2023",
    endDate: "Nov 30 2023",
    fileSize: "14.12",
    status: "SUCCESS",
    createdAt: "28 Nov 24 14:58:09",
    fileName: "POSVsTRM_ALL_ALL_2023-11-01_2023-11-30.xlsx",
    file: "./Reports/POSVsTRM_ALL_ALL_2023-11-01_2023-11-30.xlsx",
  },
  {
    id: "01",
    reportType: "POSVsThreePO",
    startDate: "Nov 1 2023",
    endDate: "Nov 30 2023",
    fileSize: "1.91",
    status: "SUCCESS",
    createdAt: "28 Nov 24 12:51:19",
    fileName: "POSVsThreePO_ZOMATO_2023-11-01_2023-11-30.xlsx",
    file: "./Reports/POSVsThreePO_ZOMATO_2023-11-01_2023-11-30.xlsx",
  },
  {
    id: "02",
    reportType: "StoreSync",
    startDate: "Nov 1 2023",
    endDate: "Nov 30 2023",
    fileSize: "0.02",
    status: "SUCCESS",
    createdAt: "28 Nov 24 12:48:24",
    fileName: "StoreSync_ALL_ALL_2023-11-01_2023-11-30.xlsx",
    file: "./Reports/StoreSync_ALL_ALL_2023-11-01_2023-11-30.xlsx",
  },
];

export default function Reports() {
  const {
    generatedReports,
    reportTenders,
    reportColumns,
    filterValues,
    fetchGeneratedReports,
    downloadGeneratedReports,
    fetchReportingTenders,
    handleFilterChange,
    setFilterValues,
    downloadCustomReports,
  } = useReports();

  useEffect(() => {
    fetchGeneratedReports();
    fetchReportingTenders();
  }, []);

  const onDateChange = (date) => {
    setFilterValues({ ...filterValues, startDate: date[0], endDate: date[1] });
  };

  const [file, setFile] = useState(null);
  const handleChange = (file) => {
    setFile(file);
  };

  const reportStatus = (status) => {
    switch (status) {
      case "completed":
        return <span className="text-green-500">Success</span>;
      case "failed":
        return <span className="text-red-500">Failed</span>;
      case "pending":
        return <span className="text-yellow-500">In Progress</span>;
      case "processing":
        return <span className="text-orange-500">In Progress</span>;
      default:
        return <span className="text-gray-500">Unknown</span>;
    }
  };

  return (
    <div className="">
      {/* <BlankCard
        header={
          <h4 className="box-title font-bold text-base">
            DOWNLOAD CUSTOMIZE REPORTS
          </h4>
        }
      >
        <div className="flex mt-3 gap-3">
          <div className="flex-1">
            <CustomSelect
              data={reportTenders}
              option_value={"technicalName"}
              option_label={"displayName"}
              onChange={(e) =>
                handleFilterChange("selectedTender", e.target.value)
              }
              value={filterValues?.selectedTender}
            />
          </div>
          <div className="flex-1">
            <DateRangeComponent
              startDate={filterValues?.startDate}
              endDate={filterValues.endDate}
              onDateChange={onDateChange}
            />
          </div>
          <div className="flex-1">
            <DropdownWithCheckbox
              placeholder={"Select Columns"}
              data={reportColumns}
              option_value={"technicalName"}
              option_label={"name"}
              selectedLabel="Columns - "
              selectedOptions={filterValues?.selectedColumns}
              setSelectedOptions={(columns) =>
                handleFilterChange("selectedColumns", columns)
              }
            />
          </div>
          <div className="">
            <PrimaryButton
              disabled={filterValues?.selectedColumns?.length === 0}
              label="Download"
              onClick={downloadCustomReports}
              // loading={loadingDashboard}
            />
          </div>
        </div>
      </BlankCard> */}
      <BlankCard
        header={<h4 className="box-title font-bold text-base">REPORTS</h4>}
      >
        <div className="pt-3 w-full">
          <div className="flex">
            <div className="flex-1">
              <p className="text-black-600">DOWNLOAD GENERATED REPORTS</p>
            </div>
            <div className="flex">
              <p className="color-[#ff9900]" style={{ color: "#000000" }}>
                Auto refreshes in every{" "}
                <span
                  style={{
                    color: "#0000ff",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                >
                  10 seconds
                </span>
              </p>
            </div>
          </div>
          <div
            className="relative overflow-x-auto mt-2 mb-2 custom-table-style"
            style={{ maxHeight: "50vh", overflowY: "auto" }}
          >
            <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                <tr>
                  <th scope="col">Report Type</th>
                  <th scope="col">Start Date</th>
                  <th scope="col">End Date</th>
                  {/* <th scope="col" style={{ minWidth: "120px" }}>
                    File Size (mb)
                  </th> */}
                  <th scope="col">Status</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Created At</th>
                  {/* <th scope="col">File Name</th> */}
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {generatedReports?.map((report) => {
                  return (
                    <tr key={report?.id}>
                      <td>{report?.store_code}</td>
                      <td>
                        {moment(report?.start_date).format("DD MMM YYYY")}
                      </td>
                      <td>{moment(report?.end_date).format("DD MMM YYYY")}</td>
                      {/* <td>{report?.fileSize} mb</td> */}
                      <td>{reportStatus(report?.status)}</td>
                      <td>
                        {report?.status === "processing" &&
                        report?.progress === 100
                          ? 99
                          : report?.progress}
                        %
                      </td>
                      <td>
                        {moment(report?.created_at).format(
                          "DD MMM YYYY hh:mm:ss A"
                        )}
                      </td>
                      {/* <td>{report?.fileName}</td> */}
                      <td className="px-6 py-4 flex justify-center items-center">
                        {report?.status === "completed" ? (
                          <button
                            onClick={() =>
                              window.open(
                                reconciiAdminBaseURL + report?.downloadUrl,
                                "_blank"
                              )
                            }
                          >
                            <i className="fa-solid fa-download"></i>
                          </button>
                        ) : (
                          <div
                            style={{
                              height: "30px",
                              width: "30px",
                              backgroundColor: "rgba(0,0,0,0.5)",
                              borderRadius: "5px",
                            }}
                          >
                            <img src={spinner} alt="spinner" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </BlankCard>
    </div>
  );
}
