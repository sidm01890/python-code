import React from "react";
import "../../../Dashboard/InStoreDashboardGraphs/graph.style.css";
import Download from "../../../../../assets/Images/download.png";
import { formatNumberToLakhsAndCrores } from "../../../../../Utils/UtilityFunctions";
import useReconciliation from "../../useReconciliation";
import useReports from "../../../Reports/useReports";
import useDashboard from "../../../Dashboard/useDashboard";
const LegendTable = ({ graphData, reportType = "", bank = null }) => {
  const { downloadAsyncReport } = useDashboard();
  const { downloadMissingMappedStores } = useReports();
  const downloadReport = (item, index) => {
    let params = {
      tender: reportType === "TRMSales" ? graphData?.tenders[index] : item,
      bank: reportType === "TRMSales" ? item : bank,
      reportType: reportType,
    };
    downloadAsyncReport(params);
  };

  return (
    <div className="w-100 mt-2 border mb-2">
      {graphData?.labels?.map((item, index) => {
        return (
          <div key={`${index}-lt`} className="flex">
            <div className="flex-1 flex justify-start border items-center p-1">
              <div
                className="legend-box"
                style={{ backgroundColor: graphData?.colors[index] }}
              ></div>
              <p className="ml-2">{`${item}`}</p>

              {graphData?.mappingStatus !== undefined &&
                graphData?.mappingStatus[index] && (
                  <button
                    className="custom-download-button"
                    onClick={() => downloadMissingMappedStores(item)}
                  >
                    {graphData?.mappingStatus[index]?.missing}/
                    {graphData?.mappingStatus[index]?.totalStores}
                    <img src={Download} alt="download" />
                  </button>
                )}
            </div>
            <div className="flex-1 border p-1 flex justify-center">
              <p className="text-black">{`₹${formatNumberToLakhsAndCrores(
                graphData?.data[index]
              )} lac`}</p>
              <button
                style={{ height: "20px", width: "20px" }}
                className="ml-2 flex justify-center items-center"
                onClick={() => downloadReport(item, index)}
              >
                <img src={Download} alt="download" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LegendTable;
