import React, { useEffect, useState } from "react";
import "../../../InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import Reconciled3POItem from "./Reconciled3POItem";

export default function Reconciled3PO() {
  const [storeSalesData, setStoreSalesData] = useState([]);
  const [selectedTenderIndex, setSelectedTenderIndex] = useState(-1);
  let { dashboard3POData } = useSelector((state) => state.CommonService);

  useEffect(() => {
    if (dashboard3POData?.threePOData) {
      setSelectedTenderIndex(
        dashboard3POData?.threePOData?.length > 0 ? 0 : -1
      );
      setStoreSalesData(dashboard3POData?.threePOData);
    }
  }, [dashboard3POData]);

  console.log("storeSalesData", storeSalesData);

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
