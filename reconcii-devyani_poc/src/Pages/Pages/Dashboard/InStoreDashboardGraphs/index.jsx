import React, { useEffect, useState } from "react";
import GraphCard from "./components/GraphCard";
import TotalSales from "./Charts/TotalSales";
import CompareCharts from "./Charts/CompareCharts";
import SalesComparison from "./Charts/SalesComparison/SalesComparison";
import Reconciled from "./Charts/Reconciled";
import UnReconciled from "./Charts/UnReconciled";
import Receipt from "./Charts/Receipt";
import Charges from "./Charts/Charges";

const TITLES_CONST = {
  1: {
    title: ["Total Sales"],
    downloadable: false,
  },
  2: {
    title: [
      {
        label: "POS vs TRM",
        value: "posVsTrm",
        key: "posVsTrm",
        reportType: "POSVsTRM",
        isSelected: true,
      },
      {
        label: "TRM vs MPR",
        value: "trmVsMpr",
        key: "trmVsMpr",
        reportType: "TRMVsMPR",
        isSelected: false,
      },
      {
        label: "MPR vs BANK",
        value: "mprVsBank",
        key: "mprVsBank",
        reportType: "MPRVsBank",
        isSelected: false,
      },
      {
        label: "Sales vs Pickup",
        value: "salesVsPickup",
        key: "salesVsPickup",
        reportType: "SalesVsPickup",
        isSelected: false,
      },
      {
        label: "Pickup vs Receipts",
        value: "pickupVsReceipts",
        key: "pickupVsReceipts",
        reportType: "PickupVsReceipts",
        isSelected: false,
      },
    ],
    downloadable: true,
  },
  3: {
    title: ["Reconciled"],
    downloadable: true,
    reportType: "Reconciled",
  },
  4: {
    title: ["Unreconciled"],
    downloadable: true,
    reportType: "UnReconciled",
  },
  5: {
    title: ["Bank Receipts"],
    downloadable: true,
    reportType: "Receipts",
  },
  6: {
    title: ["All Charges"],
    downloadable: true,
    reportType: "Charges",
  },
};

const InStoreDashboardGraphs = () => {
  const [selectedDelta, setSelectedDelta] = useState(
    TITLES_CONST[2]?.title[0].key
  );
  return (
    <div>
      <div className="flex-1">
        <div class="grid grid-cols-12 gap-x-6">
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[1]}>
              <TotalSales />
            </GraphCard>
          </div>
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[2]} onChange={setSelectedDelta}>
              <SalesComparison selectedDelta={selectedDelta} />
            </GraphCard>
          </div>
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[3]}>
              <Reconciled />
            </GraphCard>
          </div>
        </div>
      </div>
      <div className="flex-1">
        <div class="grid grid-cols-12 gap-x-6">
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[4]}>
              <UnReconciled />
            </GraphCard>
          </div>
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[5]}>
              <Receipt />
            </GraphCard>
          </div>
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[6]}>
              <Charges />
            </GraphCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InStoreDashboardGraphs;
