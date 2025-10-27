import React, { useEffect, useState } from "react";
import { Chart } from "react-chartjs-2";
import "../../InStoreDashboardGraphs/graph.style.css";
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
import { THREE_PO_COLORS } from "../../../../../Utils/DataVariable";
import LegendTable from "../components/LegendTable";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function TotalSales() {
  const [legendData, setLegendData] = useState({
    labels: [],
    data: [],
    legends: [],
    mappingStatus: [],
  });

  const [dataset, setDataSet] = useState({
    heading: "",
    data: [],
    labels: [],
    barColor: [],
  });
  let {
    dashboardData,
    dashboard3POData,
    dashboardFilters,
    tenderWiseStoresMissedInMapping,
  } = useSelector((state) => state.CommonService);

  useEffect(() => {
    if (dashboard3POData?.threePOData !== undefined) {
      if (dashboardFilters?.salesType === "3PO Sales") {
        let dataList = [];
        let labelList = [];
        let barColor = [];
        let mappingStatus = [];
        dashboard3POData?.threePOData?.forEach((field) => {
          dataList?.push(field?.threePOSales);
          labelList.push(field?.tenderName);
          barColor?.push(THREE_PO_COLORS[field?.tenderName]);
          let mappingItem = tenderWiseStoresMissedInMapping?.filter(
            (tenderMapping) => tenderMapping?.threePO === field?.tenderName
          );
          mappingStatus?.push(mappingItem ? mappingItem[0] : undefined);
        });
        let graphData = {
          heading: "Bank Wise",
          data: dataList,
          labels: labelList,
          barColor: barColor,
        };
        setDataSet(graphData);
        setLegendData({
          labels: labelList,
          data: dataList,
          colors: barColor,
          mappingStatus: mappingStatus,
        });
      } else {
        let dataList = [];
        let labelList = [];
        let barColor = [];
        let mappingStatus = [];
        dashboard3POData?.tenderWisePOSData?.forEach((field) => {
          dataList?.push(field?.posSales);
          labelList.push(field?.tenderName);
          barColor?.push(THREE_PO_COLORS[field?.tenderName]);
          let mappingItem = tenderWiseStoresMissedInMapping?.filter(
            (tenderMapping) => tenderMapping?.threePO === field?.tenderName
          );
          mappingStatus?.push(mappingItem ? mappingItem[0] : undefined);
        });
        let graphData = {
          heading: "Tender Wise",
          data: dataList,
          labels: labelList,
          barColor: barColor,
        };
        setDataSet(graphData);
        setLegendData({
          labels: labelList,
          data: dataList,
          colors: barColor,
          mappingStatus: mappingStatus,
        });
      }
    }
  }, [dashboardData?.tenderWiseDataList, dashboardFilters?.salesType]);

  const data = {
    datasets: [
      {
        type: "bar",
        // label: dataset?.heading, //dataset?.labels,
        data: dataset?.data,
        fill: true,
        backgroundColor: dataset?.barColor,
        borderColor: "#742774",
      },
    ],
    labels: dataset?.labels,
  };

  const options = {
    plugins: {
      legend: {
        display: false, // Hides the legend completely
      },
    },
  };

  return (
    <div className="chart-container">
      <Chart data={data} options={options} />
      <div className="w-100">
        <LegendTable
          graphData={legendData}
          reportType={
            dashboardFilters?.salesType === "POS Sales"
              ? "POSSales"
              : "ThreePOSales"
          }
        />
      </div>
    </div>
  );
}
