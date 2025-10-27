import React, { useEffect, useState } from "react";
import "../../graph.style.css";
import { useSelector } from "react-redux";
import ReceiptItem from "./ReceiptItem";

export default function Receipt() {
  const [storeSalesData, setStoreSalesData] = useState([]);
  const [selectedTenderIndex, setSelectedTenderIndex] = useState(-1);
  let { dashboardData } = useSelector((state) => state.CommonService);

  useEffect(() => {
    if (dashboardData?.tenderWiseDataList) {
      let data = dashboardData?.tenderWiseDataList?.map((item) => {
        let bankList = item.bankWiseDataList.map((bank, index) => {
          return { ...bank, isSelected: index === 0 ? true : false };
        });
        return { ...item, bankWiseDataList: bankList };
      });
      setSelectedTenderIndex(data?.length > 0 ? 0 : -1);
      setStoreSalesData(data);
    }
  }, [dashboardData]);

  return (
    <div className="chart-container">
      <div className="flex justify-end items-end w-100">
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
      </div>
      {selectedTenderIndex > -1 && (
        <div className="chart-list-horizontal">
          <ReceiptItem
            item={storeSalesData[selectedTenderIndex]}
            chartIndex={selectedTenderIndex}
          />
        </div>
      )}
    </div>
  );
}
