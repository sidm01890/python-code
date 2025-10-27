import React, { useEffect, useState } from "react";
import "../../../InStoreDashboardGraphs/graph.style.css";
import { useSelector } from "react-redux";
import Charges3POItem from "./Charges3POItem";

export default function Charges3PO({ selectedDelta }) {
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
  }, [selectedDelta, dashboard3POData]);

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
