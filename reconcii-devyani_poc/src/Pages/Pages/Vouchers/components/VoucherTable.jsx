import React, { useEffect, useRef, useState } from "react";

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

export default function VoucherTable() {
  return (
    <div className="relative overflow-x-auto mt-2 mb-2 custom-table-style">
      <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
        <thead className="">
          <tr>
            <th scope="col">Report Type</th>
            <th
              scope="col"

              // style={{ minWidth: "140px" }}
            >
              Start Date
            </th>
            <th
              scope="col"

              // style={{ minWidth: "140px" }}
            >
              End Date
            </th>
            <th scope="col">File Size (mb)</th>
            <th scope="col">Status</th>
            <th scope="col">Generation</th>
            <th scope="col">File Name</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {STATIC_REPORTS?.map((report) => {
            return (
              <tr key={report?.id}>
                <td>{report?.reportType}</td>
                <td>{report?.startDate}</td>
                <td>{report?.endDate}</td>
                <td>{report?.fileSize} mb</td>
                <td>{report?.status}</td>
                <td>{report?.createdAt}</td>
                <td>{report?.fileName}</td>
                <td className="px-6 py-4 flex justify-center items-center">
                  {/* <button
                          download
                          onClick={() => downloadGeneratedReports(report)}
                        >
                          <i className="fa-solid fa-download"></i>
                        </button> */}
                  <a href={`${report.file}`} download="myFile">
                    <i className="fa-solid fa-download"></i>
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
