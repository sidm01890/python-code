import React, { useEffect, useState } from "react";
import "../../../../Dashboard/InStoreDashboardGraphs/graph.style.css";
import PercentageChart from "../../../../Dashboard/InStoreDashboardGraphs/Charts/PercentageChart";
import { THREE_PO_COLORS } from "../../../../../../Utils/DataVariable";
import LegendTable from "../../components/LegendTable";
import { useSelector } from "react-redux";

const REPORT_TYPES = {
  posVsThreePO: "POSVsThreePO",
  receivablesVsReceipts: "ReceivablesVsReceipts",
  promo: "Promo",
};

export default function StatusComparisonItem({
  chartIndex,
  item,
  selectedDelta,
}) {
  let { loadingDashboard } = useSelector((state) => state.CommonService);
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
    let sales = 0;
    let totalSales = 0;
    // if (dashboardFilters?.salesType === "POS Sales") {
    sales = Number(item?.[selectedDelta]);
    totalSales = Number(item?.threePOSales);
    // } else {
    //   sales = Number(item?.trmSalesData?.[selectedDelta]);
    //   totalSales = Number(item?.trmSalesData?.sales);
    // }
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
  }, [chartIndex, selectedDelta, item?.tenderName, loadingDashboard]);

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
