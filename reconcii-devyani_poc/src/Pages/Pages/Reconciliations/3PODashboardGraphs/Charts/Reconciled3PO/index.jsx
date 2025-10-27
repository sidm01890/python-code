import React, { useEffect, useState } from "react";
import "../../../../Dashboard/InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import Reconciled3POItem from "./Reconciled3POItem";

export default function Reconciled3PO() {
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
      {selectedTenderIndex > -1 && (
        <div className="chart-list-horizontal">
          <Reconciled3POItem ThreePOData={storeSalesData} />
        </div>
      )}
    </div>
  );
}
