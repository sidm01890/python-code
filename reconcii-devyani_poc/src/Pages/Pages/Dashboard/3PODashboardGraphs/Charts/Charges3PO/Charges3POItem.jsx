import React, { useEffect, useState } from "react";
import "../../../InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import PercentageChart from "../../../InStoreDashboardGraphs/Charts/PercentageChart";
import CustomLegend from "../../../InStoreDashboardGraphs/components/CustomLegend";
import { THREE_PO_COLORS } from "../../../../../../Utils/DataVariable";
import LegendTable from "../../components/LegendTable";

export default function Charges3POItem({ ThreePOData, selectedDelta }) {
  let { dashboardFilters } = useSelector((state) => state.CommonService);
  const [graphData, setGraphData] = useState({
    labels: [],
    data: [],
    legends: [],
    colors: [],
  });

  const chargeReportType = (val) => {
    let value = "";

    switch (val) {
      case "allCharges":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? "AllThreePoCharges"
            : "AllPOSCharges";
        break;
      case "charges":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? "ThreePOCharges"
            : "PosCharges";
        break;
      case "promo":
        value = "Promo";
        break;
      case "discounts":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? "ThreePODiscounts"
            : "PosDiscounts";
        break;
      case "freebies":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? "ThreePOFreebies"
            : "PosFreebies";
        break;
      case "commission":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? "ThreePOCommission"
            : "PosCommission";
        break;
      default:
        break;
    }
    return value;
  };

  const calculateChargeAmount = (item, val) => {
    let value = 0;
    switch (val) {
      case "allCharges":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? Number(item?.threePOCharges) +
              Number(item?.promo) +
              Number(item?.threePODiscounts) +
              Number(item?.threePOFreebies) +
              Number(item?.threePOCommission)
            : Number(item?.posCharges) +
              Number(item?.promo) +
              Number(item?.posDiscounts) +
              Number(item?.posFreebies) +
              Number(item?.posCommission);
        break;
      case "charges":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? item?.threePOCharges
            : item?.posCharges;
        break;
      case "promo":
        value = item?.promo;
        break;
      case "discounts":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? item?.threePODiscounts
            : item?.posDiscounts;
        break;
      case "freebies":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? item?.threePOFreebies
            : item?.posFreebies;
        break;
      case "commission":
        value =
          dashboardFilters?.salesType === "3PO Sales"
            ? item?.threePOCommission
            : item?.posCommission;
        break;
      default:
        break;
    }
    return value;
  };

  useEffect(() => {
    let labels = [];
    let data = [];
    let colors = [];
    ThreePOData?.map((item) => {
      labels?.push(item?.tenderName);
      data?.push(calculateChargeAmount(item, selectedDelta));
      colors?.push(THREE_PO_COLORS[item?.tenderName]);
    });

    setGraphData({
      labels: labels,
      data: data,
      colors: colors,
    });
  }, [dashboardFilters?.salesType, selectedDelta]);

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
          reportType={chargeReportType(selectedDelta)}
        />
      </div>
    </div>
  );
}
