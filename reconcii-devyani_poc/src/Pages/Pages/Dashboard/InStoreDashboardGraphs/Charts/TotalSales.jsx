import React, { useEffect, useState } from "react";
import { Chart } from "react-chartjs-2";
import "../graph.style.css";
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
import { useSelector } from "react-redux";
import LegendTable from "../../3PODashboardGraphs/components/LegendTable";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const colors = [
  "#FF6384",
  "#36A2EB",
  "#FFCE56",
  "#4BC0C0",
  "#9966FF",
  "#FF9F40",
]; // Add more colors as needed

export default function TotalSales() {
  const [dataset, setDataSet] = useState({
    heading: "",
    data: [],
    labels: [],
    tenders: [],
  });

  let { dashboardData, dashboardFilters } = useSelector(
    (state) => state.CommonService
  );

  useEffect(() => {
    if (dashboardData?.tenderWiseDataList !== undefined) {
      let fields = tenderAndBankData(dashboardFilters?.salesType);
      if (fields?.length > 0) {
        try {
          fields = [...fields].sort((a, b) => b?.sales - a?.sales);
        } catch (e) {
          console.log("e", e);
        }
      }

      if (dashboardFilters?.salesType === "TRM Sales") {
        let dataList = [];
        let labelList = [];
        let barColorList = [];
        let tendersList = [];
        fields?.forEach((field, index) => {
          dataList?.push(field?.sales);
          labelList.push(field?.bankName);
          tendersList.push(field?.tenderType);
          barColorList.push(colors[index % colors.length]);
        });
        let graphData = {
          heading: "Bank Wise",
          data: dataList,
          labels: labelList,
          colors: barColorList,
          tenders: tendersList,
        };
        setDataSet(graphData);
      } else {
        let dataList = [];
        let labelList = [];
        let barColorList = [];
        fields?.forEach((field, index) => {
          dataList?.push(field?.sales);
          labelList.push(field?.tenderName);
          barColorList.push(colors[index % colors.length]);
        });
        let graphData = {
          heading: "Tender Wise",
          data: dataList,
          labels: labelList,
          colors: barColorList,
        };
        setDataSet(graphData);
      }
    }
  }, [dashboardData?.tenderWiseDataList, dashboardFilters?.salesType]);

  const tenderAndBankData = (key) => {
    let fields = [];
    switch (key) {
      case "TRM Sales":
        fields =
          dashboardData?.tenderWiseDataList
            ?.flatMap((tender) =>
              tender.bankWiseDataList.map((bank) => ({
                ...bank,
                tenderType: tender.tenderName,
              }))
            )
            .reduce((acc, item) => {
              const existing = acc.find(
                (entry) => entry.bankName === item.bankName
              );

              if (existing) {
                // If `bankName` already exists, accumulate `sales` values
                existing.sales += item.sales;
              } else {
                // If not, add new entry to accumulator
                acc.push({ ...item });
              }

              return acc;
            }, []) || [];
        break;

      default:
        fields = dashboardData?.tenderWiseDataList || [];
        break;
    }
    return fields;
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
          maxRotation: 90, // Rotates labels to 90 degrees
          minRotation: 90,
        },
      },
    },
  };

  return (
    <div className="chart-container">
      <Chart data={data} options={options} />
      <div className="w-100">
        <LegendTable
          graphData={dataset}
          reportType={
            dashboardFilters?.salesType === "TRM Sales"
              ? "TRMSales"
              : "POSSales"
          }
        />
      </div>
    </div>
  );
}
