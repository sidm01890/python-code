import React, { useEffect, useState } from "react";
import "../../../InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import PercentageChart from "../../../InStoreDashboardGraphs/Charts/PercentageChart";
import CustomLegend from "../../../InStoreDashboardGraphs/components/CustomLegend";
import { THREE_PO_COLORS } from "../../../../../../Utils/DataVariable";
import LegendTable from "../../components/LegendTable";

export default function Reconciled3POItem({ ThreePOData }) {
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
    // if (dashboardFilters?.salesType === "3PO Sales") {
    ThreePOData?.map((item) => {
      labels?.push(item?.tenderName);
      data?.push(item?.reconciled);
      colors?.push(THREE_PO_COLORS[item?.tenderName]);
    });
    // } else {
    //   ThreePOData?.map((item) => {
    //     labels?.push(item?.tenderName);
    //     data?.push(item?.reconciled);
    //     colors?.push(THREE_PO_COLORS[item?.tenderName]);
    //   });
    // }
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
      <div className="flex">
        {graphData?.legends?.map((legend, index) => {
          return (
            <CustomLegend
              color={legend.color}
              key={`${index.toString()}-key`}
              value={`₹${legend?.amount}`}
            />
          );
        })}
      </div>
      <div className="w-100">
        <LegendTable graphData={graphData} reportType={"Reconciled"} />
      </div>
    </div>
  );
}
