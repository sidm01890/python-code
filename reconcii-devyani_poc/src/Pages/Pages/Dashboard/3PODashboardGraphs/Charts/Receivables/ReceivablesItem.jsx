import React, { useEffect, useState } from "react";
import "../../../InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import PercentageChart from "../../../InStoreDashboardGraphs/Charts/PercentageChart";
import { THREE_PO_COLORS } from "../../../../../../Utils/DataVariable";
import LegendTable from "../../components/LegendTable";

export default function ReceivablesItem({ ThreePOData }) {
  let { dashboardFilters } = useSelector((state) => state.CommonService);
  const [graphData, setGraphData] = useState({
    labels: [],
    data: [],
    legends: [],
    colors: [],
  });

  useEffect(() => {
    let labels = [];
    let data = [];
    let colors = [];
    if (dashboardFilters?.salesType === "3PO Sales") {
      ThreePOData?.map((item) => {
        labels?.push(item?.tenderName);
        data?.push(item?.threePOReceivables);
        colors?.push(THREE_PO_COLORS[item?.tenderName]);
      });
    } else {
      ThreePOData?.map((item) => {
        labels?.push(item?.tenderName);
        data?.push(item?.posReceivables);
        colors?.push(THREE_PO_COLORS[item?.tenderName]);
      });
    }
    setGraphData({
      labels: labels,
      data: data,
      colors: colors,
    });
  }, [dashboardFilters?.salesType]);

  return (
    <div className="chart-container">
      <PercentageChart
        labels={graphData?.labels}
        data={graphData.data}
        colors={graphData.colors}
        amountInRupee={true}
      />
      <div className="w-100">
        <LegendTable
          graphData={graphData}
          reportType={
            dashboardFilters?.salesType === "3PO Sales"
              ? "ThreePOReceivables"
              : "PosReceivables"
          }
        />
      </div>
    </div>
  );
}
