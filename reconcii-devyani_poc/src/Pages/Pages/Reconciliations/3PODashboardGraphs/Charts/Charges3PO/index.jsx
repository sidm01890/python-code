import React, { useEffect, useState } from "react";
import "../../../../Dashboard/InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import Charges3POItem from "./Charges3POItem";

export default function Charges3PO({ selectedDelta }) {
  const [storeSalesData, setStoreSalesData] = useState([]);
  const [selectedTenderIndex, setSelectedTenderIndex] = useState(-1);
  let { loadingDashboard } = useSelector((state) => state.CommonService);
  let { reconciliation3POData } = useSelector(
    (state) => state.ReconciliationService
  );

  useEffect(() => {
    if (reconciliation3POData?.threePOData) {
      setSelectedTenderIndex(
        reconciliation3POData?.threePOData?.length > 0 ? 0 : -1
      );
      setStoreSalesData(reconciliation3POData?.threePOData);
    }
  }, [
    selectedDelta,
    reconciliation3POData,
    reconciliation3POData?.threePOData[0]?.tenderName,
    loadingDashboard,
  ]);

  return (
    <div className="chart-container">
      {selectedTenderIndex > -1 && (
        <div className="chart-list-horizontal">
          <Charges3POItem
            ThreePOData={storeSalesData}
            selectedDelta={selectedDelta}
          />
        </div>
      )}
    </div>
  );
}
