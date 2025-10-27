import React from "react";
import BlankDashboardImg from "../../../../assets/Images/blank_dashboard.jpg";
import LoadingDashboard from "../../../../assets/Images/loading_dashboard.gif";
import "../dashboard.style.css";
import { useSelector } from "react-redux";
const BlankDashboard = () => {
  return (
    <div className="flex items-center justify-center flex-column">
      <img
        src={BlankDashboardImg}
        alt="blank-dashboard"
        className="blank-dashboard"
      />
      <p>{"Please apply filters and search, to see the data."}</p>
    </div>
  );
};

export default BlankDashboard;
