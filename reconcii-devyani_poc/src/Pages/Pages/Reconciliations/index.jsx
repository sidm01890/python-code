import React, { useEffect } from "react";
import ReconciliationFilter from "./components/ReconciliationFilter";
import { useDispatch, useSelector } from "react-redux";
import ThreePODashboardGraphs from "./3PODashboardGraphs";
import BlankDashboard from "../Dashboard/components/BlankDashboard";
import { setReconciliationFilters } from "../../../Redux/Slices/Reconciliation";

const Reconciliations = () => {
  const dispatch = useDispatch();
  let { reconciliationFilters, reconciliation3POData } = useSelector(
    (state) => state.ReconciliationService
  );

  useEffect(() => {
    return () => {
      dispatch(
        setReconciliationFilters({ tender: "", salesType: "POS Sales" })
      );
    };
  }, []);

  return (
    <div>
      <ReconciliationFilter />
      {reconciliationFilters?.tender === "" ||
      reconciliation3POData?.posSales === undefined ? (
        <BlankDashboard />
      ) : (
        <ThreePODashboardGraphs />
      )}
    </div>
  );
};

export default Reconciliations;
