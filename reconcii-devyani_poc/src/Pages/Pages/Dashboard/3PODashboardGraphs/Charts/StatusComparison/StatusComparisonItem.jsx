import React, { useEffect, useState } from "react";
import "../../../InStoreDashboardGraphs/graph.style.css";
import PercentageChart from "../../../InStoreDashboardGraphs/Charts/PercentageChart";
import { THREE_PO_COLORS } from "../../../../../../Utils/DataVariable";
import LegendTable from "../../components/LegendTable";
import { useSelector } from "react-redux";
import ReceivableVsReceiptsChart from "../../components/ReceivableVsReceiptsChart";

const REPORT_TYPES = {
  posVsThreePO: "POSVsThreePO",
  receivablesVsReceipts: "ReceivablesVsReceipts",
  promo: "Promo",
};

export default function StatusComparisonItem({
  chartIndex,
  item,
  selectedDelta,
  salesType,
}) {
  const [refreshCalc, setRefreshCalc] = useState(false);
  const [graphData, setGraphData] = useState({
    labels: [],
    data: [],
    legends: [],
  });

  const [legendData, setLegendData] = useState({
    labels: [],
    data: [],
    legends: [],
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setRefreshCalc((prev) => !prev);
    }, 1000); // 1000ms = 1 second

    // Cleanup in case component unmounts or `salesType` changes quickly
    return () => clearTimeout(timer);
  }, [salesType]);

  useEffect(() => {
    let sales = 0;
    let totalSales = 0;
    sales = Number(item?.[selectedDelta]);
    totalSales = Number(item?.threePOSales);
    const percentage = (sales / totalSales) * 100;

    setGraphData({
      labels: ["Matched", "Unmatched"],
      data: [percentage, 100 - percentage],
    });
    setLegendData({
      labels: [item?.tenderName],
      data: [Number(item?.[selectedDelta])],
      colors: [THREE_PO_COLORS[item?.tenderName]],
    });
  }, [chartIndex, selectedDelta, refreshCalc]);

  if (selectedDelta === "receivablesVsReceipts") {
    return (
      <div className="chart-container">
        <ReceivableVsReceiptsChart item={item} />
      </div>
    );
  } else {
    return (
      <div className="chart-container">
        <PercentageChart
          labels={graphData?.labels}
          data={graphData.data}
          backgroundColor={THREE_PO_COLORS[item?.tenderName]}
        />
        <div className="w-100">
          <LegendTable
            graphData={legendData}
            reportType={REPORT_TYPES[selectedDelta]}
          />
        </div>
      </div>
    );
  }
}
