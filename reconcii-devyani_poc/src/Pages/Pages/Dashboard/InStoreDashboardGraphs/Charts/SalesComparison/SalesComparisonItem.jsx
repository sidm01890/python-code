import React, { useEffect, useState } from "react";
import "../../graph.style.css";
import { useSelector } from "react-redux";
import PercentageChart from "../PercentageChart";
import LegendTable from "../../../3PODashboardGraphs/components/LegendTable";

const REPORT_TYPES = {
  posVsTrm: "POSVsTRM",
  trmVsMpr: "TRMVsMPR",
  mprVsBank: "MPRVsBank",
  salesVsPickup: "SalesVsPickup",
  pickupVsReceipts: "PickupVsReceipts",
};

export default function SalesComparisonItem({
  chartIndex,
  item,
  selectedDelta,
  cashKeys = [],
}) {
  const [graphData, setGraphData] = useState({
    labels: [],
    data: [],
    legends: [],
  });

  const [legendData, setLegendData] = useState({
    labels: [],
    data: [],
    colors: [],
  });

  let { dashboardFilters } = useSelector((state) => state.CommonService);
  useEffect(() => {
    let sales = 0;
    let totalSales = 0;
    if (cashKeys?.includes(selectedDelta)) {
      sales = Number(item?.[selectedDelta]);
      totalSales = Number(item?.sales);
    } else if (dashboardFilters?.salesType === "POS Sales") {
      sales = Number(item?.[selectedDelta]);
      totalSales = Number(item?.sales);
    } else {
      sales = Number(item?.trmSalesData?.[selectedDelta]);
      totalSales = Number(item?.trmSalesData?.sales);
    }
    let percentage = 0;
    if (sales) {
      percentage = (sales / totalSales) * 100;
    }
    setGraphData({
      labels: ["Matched", "Unmatched"],
      data: [percentage, 100 - percentage],
    });
    setLegendData({
      labels: [item?.tenderName],
      data: [sales],
      colors: ["#4caf50"],
    });
  }, [
    chartIndex,
    selectedDelta,
    dashboardFilters?.salesType,
    item?.tenderName,
  ]);

  return (
    <div className="chart-container">
      <PercentageChart labels={graphData?.labels} data={graphData.data} />
      <div className="w-100">
        <LegendTable
          graphData={legendData}
          reportType={REPORT_TYPES[selectedDelta]}
        />
      </div>
    </div>
  );
}
