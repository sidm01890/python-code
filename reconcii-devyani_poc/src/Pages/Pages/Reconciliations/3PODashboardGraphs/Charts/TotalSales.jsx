import React, { useEffect, useState } from "react";
import { Chart } from "react-chartjs-2";
import "../../../Dashboard/InStoreDashboardGraphs/graph.style.css";
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
  let { loadingDashboard } = useSelector((state) => state.CommonService);
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
    reconciliation3POData,
    reconciliationFilters,
    tenderWiseStoresMissedInMapping,
  } = useSelector((state) => state.ReconciliationService);

  useEffect(() => {
    // Ensure tenderWiseStoresMissedInMapping is an array to prevent filter errors
    const mappingData = Array.isArray(tenderWiseStoresMissedInMapping) 
      ? tenderWiseStoresMissedInMapping 
      : [];
    
    if (reconciliation3POData?.threePOData !== undefined) {
      if (reconciliationFilters?.salesType === "3PO Sales") {
        let dataList = [];
        let labelList = [];
        let barColor = [];
        let mappingStatus = [];
        reconciliation3POData?.threePOData?.forEach((field) => {
          dataList?.push(field?.threePOSales);
          labelList.push(field?.tenderName);
          barColor?.push(THREE_PO_COLORS[field?.tenderName]);
          let mappingItem = mappingData?.filter(
            (tenderMapping) => tenderMapping?.threePO === field?.tenderName
          );
          mappingStatus?.push(mappingItem && mappingItem.length > 0 ? mappingItem[0] : undefined);
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
        reconciliation3POData?.threePOData?.forEach((field) => {
          dataList?.push(field?.posSales);
          labelList.push(field?.tenderName);
          barColor?.push(THREE_PO_COLORS[field?.tenderName]);
          let mappingItem = mappingData?.filter(
            (tenderMapping) => tenderMapping?.threePO === field?.tenderName
          );
          mappingStatus?.push(mappingItem && mappingItem.length > 0 ? mappingItem[0] : undefined);
        });
        let graphData = {
          heading: "Tender Wise",
          data: dataList,
          labels: labelList,
          barColor: barColor,
        };
        setDataSet(graphData);
        console.log("mappingStatus", mappingStatus);
        setLegendData({
          labels: labelList,
          data: dataList,
          colors: barColor,
          mappingStatus: mappingStatus,
        });
      }
    }
  }, [
    reconciliation3POData,
    reconciliationFilters?.salesType,
    loadingDashboard,
    tenderWiseStoresMissedInMapping,
  ]);

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
            reconciliationFilters?.salesType === "POS Sales"
              ? "POSSales"
              : "ThreePOSales"
          }
        />
      </div>
    </div>
  );
}
