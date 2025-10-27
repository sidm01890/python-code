import React, { useEffect, useState } from "react";
import "../graph.style.css";
import Download from "../../../../../assets/Images/download.png";
import useDashboard from "../../useDashboard";
const GraphCard = ({ title, children, onChange }) => {
  const [reportType, setReportType] = useState(
    title?.reportType || title?.title[0].reportType
  );
  const { downloadAsyncReport } = useDashboard();
  const downloadReport = () => {
    let params = {
      tender: null,
      bank: null,
      reportType: reportType,
    };
    downloadAsyncReport(params);
  };

  const onOptionChange = (e) => {
    onChange(e.target.value);
    const option = title?.title.find((opt) => opt.value === e.target.value);
    setReportType(option?.reportType);
  };

  return (
    <div className="card graph-card">
      {title && (
        <div className="graph-card-title-div">
          {title?.title?.length > 1 ? (
            <select className="title-dropdown" onChange={onOptionChange}>
              {title?.title?.map((item) => {
                return (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                );
              })}
            </select>
          ) : (
            <p>{title?.title[0]}</p>
          )}
          {title?.downloadable && (
            <button
              className="download-button"
              onClick={() => downloadReport()}
            >
              <img src={Download} alt="download" />
            </button>
          )}
        </div>
      )}
      <div className="graph-card-content">{children}</div>
    </div>
  );
};

export default GraphCard;
