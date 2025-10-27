import React from "react";
import DashboardFilter from "./components/DashboardFilter";
import DashboardNumbers from "./components/DashboardNumbers";
import InStoreDashboardGraphs from "./InStoreDashboardGraphs";
import BlankDashboard from "./components/BlankDashboard";
import { useSelector } from "react-redux";
import { DASHBOARD_ITEMS } from "./DashboardConstants";
import ThreePODashboardGraphs from "./3PODashboardGraphs";
import { useLoader } from "../../../Utils/Loader";

const Dashboard = () => {
  const { isLoading } = useLoader();
  let { dashboardData, dashboardFilters } = useSelector(
    (state) => state.CommonService
  );

  return (
    <div>
      <DashboardFilter />
      <DashboardNumbers />
      {isLoading ? (
        <div>
          <BlankDashboard />
        </div>
      ) : (
        <div>
          {dashboardFilters?.salesLocation === DASHBOARD_ITEMS[0]?.key &&
            (dashboardData?.sales !== undefined ? (
              <InStoreDashboardGraphs />
            ) : (
              <BlankDashboard />
            ))}
          {dashboardFilters?.salesLocation === DASHBOARD_ITEMS[1]?.key &&
            (dashboardData?.sales !== undefined ? (
              <ThreePODashboardGraphs />
            ) : (
              <BlankDashboard />
            ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
