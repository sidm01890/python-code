import React, { useEffect, useState } from "react";
import "../../../../Dashboard/InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import ReceivablesItem from "./ReceivablesItem";

export default function Receivables() {
  const [storeSalesData, setStoreSalesData] = useState([]);
  const [selectedTenderIndex, setSelectedTenderIndex] = useState(-1);
  let { reconciliation3POData } = useSelector(
    (state) => state.ReconciliationService
  );
  let { loadingDashboard } = useSelector((state) => state.CommonService);

  useEffect(() => {
    if (reconciliation3POData?.threePOData) {
      setSelectedTenderIndex(
        reconciliation3POData?.threePOData?.length > 0 ? 0 : -1
      );
      setStoreSalesData(reconciliation3POData?.threePOData);
    }
  }, [
    reconciliation3POData,
    reconciliation3POData?.threePOData[0]?.tenderName,
    loadingDashboard,
  ]);

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
