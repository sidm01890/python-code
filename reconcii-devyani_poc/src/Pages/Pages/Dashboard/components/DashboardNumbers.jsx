import React, { useEffect, useState } from "react";
import CardComponent from "../../../Components/CardComponent";
import useDashboardNumber from "./useDashboardNumber";
import TotalSales from "../../../../assets/Images/total_sale.png";
import InStore from "../../../../assets/Images/in_store.png";
import Aggregator from "../../../../assets/Images/aggregator.png";
// import "../Styles/Dashboard.css";

const DashboardNumbers = () => {
  const { totalSalesData, findSalesValue } = useDashboardNumber();
  return (
    <div className="flex-1">
      <div className="grid grid-cols-12 gap-x-6">
        <div className="xxl:col-span-4 md:col-span-4 col-span-12">
          <CardComponent
            label={"TOTAL SALES"}
            number={totalSalesData()?.actual || "0"}
            icon={TotalSales}
          />
        </div>
        <div className="xxl:col-span-4 md:col-span-4 col-span-12">
          <CardComponent
            label={"IN STORE"}
            number={findSalesValue("Store Sales")}
            icon={InStore}
          />
        </div>
        <div className="xxl:col-span-4 md:col-span-4 col-span-12">
          <CardComponent
            label={"AGGREGATOR"}
            number={findSalesValue("Aggregator")}
            icon={Aggregator}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardNumbers;
