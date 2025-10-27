import React, { useEffect, useState } from "react";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "../../InStoreDashboardGraphs/graph.style.css";
import { formatNumberToLakhsAndCrores } from "../../../../../Utils/UtilityFunctions";
import Download from "../../../../../assets/Images/download.png";
import useDashboard from "../../useDashboard";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ReceivableVsReceiptsChart({ item }) {
  const { downloadAsyncReport } = useDashboard();

  const dataset = {
    data: [
      parseInt(item?.totalReceivables),
      parseInt(item?.totalReceipts),
      parseInt(item?.totalReceivables - item?.totalReceipts) < 0
        ? 0
        : parseInt(item?.totalReceivables - item?.totalReceipts),
    ],
    labels: ["Receivables", "Receipts", "Difference"],
    colors: ["#FF6384", "#36A2EB", "#FFCE56"],
  };

  const data = {
    datasets: [
      {
        type: "bar",
        data: dataset?.data,
        fill: true,
        backgroundColor: dataset?.colors,
        borderColor: "#742774",
      },
    ],
    labels: dataset?.labels,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false, // Hides the legend completely
      },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: false, // Ensures all labels are shown
          maxRotation: 0, // Rotates labels to 90 degrees
          minRotation: 0,
        },
      },
      y: {
        ticks: {
          callback: function (value) {
            if (value >= 10000000) return `${value / 10000000} Cr`;
            if (value >= 100000) return `${value / 100000} Lac`;
            if (value >= 1000) return `${value / 1000} K`;
            return value;
          },
        },
      },
    },
  };

  const downloadReport = (item, index) => {
    let params = {
      tender: "",
      bank: "",
      reportType: "ReceivableVsReceipts",
    };
    downloadAsyncReport(params);
  };

  return (
    <div className="chart-container">
      <div style={{ width: "70%" }}>
        <Chart data={data} options={options} />
      </div>
      <div className="w-100">
        <div className="w-100 mt-2 border mb-2" style={{ marginTop: "15px" }}>
          <div className="flex">
            {dataset?.labels?.map((item, index) => {
              return (
                <div key={`${index}-lt`} className="flex flex-1">
                  <div className="flex-1 flex justify-start border items-center p-1">
                    <div
                      className="legend-box"
                      style={{ backgroundColor: dataset?.colors[index] }}
                    ></div>
                    <p className="ml-2 text-[11px]">{`${item}`}</p>

                    {dataset?.mappingStatus !== undefined && (
                      <button
                        className="custom-download-button"
                        onClick={() => downloadMissingMappedStores(item)}
                      >
                        {dataset?.mappingStatus[index]?.missing}/
                        {dataset?.mappingStatus[index]?.totalStores}
                        <img src={Download} alt="download" />
                      </button>
                    )}
                  </div>
                  <div
                    className="flex-1 border p-1 flex justify-center space-between"
                    style={{ position: "relative" }}
                  >
                    <p className="text-black text-[12px] whitespace-nowrap">{`₹${formatNumberToLakhsAndCrores(
                      dataset?.data[index]
                    )} lac`}</p>
                  </div>
                </div>
              );
            })}
            <div className="flex align-center justify-center p-1">
              <button
                style={{
                  height: "20px",
                  width: "20px",
                  // position: "absolute",
                  // right: "5px",
                  // top: "5px",
                }}
                className="flex justify-center items-center"
                onClick={() => downloadReport()}
              >
                <img src={Download} alt="download" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
