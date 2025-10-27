import React, { useEffect, useState } from "react";
import "../../graph.style.css";
import { useSelector } from "react-redux";
import PercentageChart from "../PercentageChart";
import LegendTable from "../../../3PODashboardGraphs/components/LegendTable";

export default function UnReconciledItem({ chartIndex, item, selectedDelta }) {
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
    if (dashboardFilters?.salesType === "POS Sales") {
      sales = Number(item?.unreconciled);
      totalSales = Number(item?.sales);
    } else {
      sales = Number(item?.trmSalesData.unreconciled);
      totalSales = Number(item?.trmSalesData?.sales);
    }
    let percentage = 0;
    if (sales) {
      percentage = (sales / totalSales) * 100;
    }

    setGraphData({
      labels: ["Un-reconciled", "Remaining"],
      data: [percentage, 100 - percentage],
    });
    setLegendData({
      labels: [item?.tenderName],
      data: [sales],
      colors: ["#4caf50"],
    });
  }, [chartIndex, selectedDelta, dashboardFilters?.salesType]);

  return (
    <div className="chart-container">
      <PercentageChart labels={graphData?.labels} data={graphData.data} />
      <div className="w-100">
        <LegendTable graphData={legendData} reportType={"UnReconciled"} />
      </div>
    </div>
  );
}
