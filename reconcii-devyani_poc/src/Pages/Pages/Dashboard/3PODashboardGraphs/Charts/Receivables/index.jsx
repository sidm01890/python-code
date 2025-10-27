import React, { useEffect, useState } from "react";
import "../../../InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import ReceivablesItem from "./ReceivablesItem";

export default function Receivables() {
  const [storeSalesData, setStoreSalesData] = useState([]);
  const [selectedTenderIndex, setSelectedTenderIndex] = useState(-1);
  let { dashboard3POData, dashboardFilters } = useSelector(
    (state) => state.CommonService
  );

  useEffect(() => {
    if (dashboardFilters?.salesType === "3PO Sales") {
      if (dashboard3POData?.threePOData) {
        setSelectedTenderIndex(
          dashboard3POData?.threePOData?.length > 0 ? 0 : -1
        );
        setStoreSalesData(dashboard3POData?.threePOData);
      }
    } else {
      if (dashboard3POData?.tenderWisePOSData) {
        setSelectedTenderIndex(
          dashboard3POData?.tenderWisePOSData?.length > 0 ? 0 : -1
        );
        setStoreSalesData(dashboard3POData?.tenderWisePOSData);
      }
    }
  }, [dashboard3POData, dashboardFilters?.salesType]);

  return (
    <div className="chart-container">
      {/* <div className="flex justify-end items-end w-100">
        <select
          className="chart-select"
          value={selectedTenderIndex}
          onChange={(e) => setSelectedTenderIndex(e.target.value)}
        >
          {storeSalesData?.map((item, index) => {
            return (
              <option value={index} key={item?.tenderName}>
                {item?.tenderName}
              </option>
            );
          })}
        </select>
      </div> */}
      {selectedTenderIndex > -1 && (
        <div className="chart-list-horizontal">
          <ReceivablesItem ThreePOData={storeSalesData} />
        </div>
      )}
    </div>
  );
}
