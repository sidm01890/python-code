import React, { useEffect, useState } from "react";
import GraphCard from "../../Dashboard/InStoreDashboardGraphs/components/GraphCard";
import TotalSales from "./Charts/TotalSales";
import StatusComparison from "./Charts/StatusComparison";
import Receivables from "./Charts/Receivables";
import Reconciled3PO from "./Charts/Reconciled3PO";
import Charges3PO from "./Charts/Charges3PO";

const TITLES_CONST = {
  1: {
    title: ["Total Sales"],
    downloadable: false,
  },
  2: {
    title: [
      {
        label: "POS vs 3PO",
        value: "posVsThreePO",
        key: "posVsThreePO",
        isSelected: false,
      },
      {
        label: "Receivable vs Receipts",
        value: "receivablesVsReceipts",
        key: "receivablesVsReceipts",
        isSelected: false,
      },
      {
        label: "Promo",
        value: "promo",
        key: "promo",
        isSelected: false,
      },
    ],
    downloadable: false,
  },
  3: {
    title: ["Receivables"],
    downloadable: false,
  },
  4: {
    title: ["Reconciled"],
    downloadable: false,
  },
  5: {
    title: [
      {
        label: "All Charges",
        value: "allCharges",
        key: "allCharges",
      },
      {
        label: "Charges",
        value: "charges",
        key: "charges",
      },
      {
        label: "Promo",
        value: "promo",
        key: "promo",
      },
      {
        label: "Discounts",
        value: "discounts",
        key: "discounts",
      },
      {
        label: "Freebies",
        value: "freebies",
        key: "freebies",
      },
      {
        label: "Commission",
        value: "commission",
        key: "commission",
      },
    ],
    downloadable: false,
  },
};

const ThreePODashboardGraphs = () => {
  const [selectedDelta, setSelectedDelta] = useState(
    TITLES_CONST[2]?.title[0].key
  );
  const [chargesDelta, setChargesDelta] = useState(
    TITLES_CONST[5]?.title[0].key
  );
  return (
    <div>
      <div className="flex-1">
        <div class="grid grid-cols-12 gap-x-6">
          <div class="xxl:col-span-6 md:col-span-6 col-span-12">
            <GraphCard title={TITLES_CONST[1]}>
              <TotalSales />
            </GraphCard>
          </div>
          <div class="xxl:col-span-6 md:col-span-6 col-span-12">
            <GraphCard title={TITLES_CONST[2]} onChange={setSelectedDelta}>
              <StatusComparison selectedDelta={selectedDelta} />
            </GraphCard>
          </div>
          {/* <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[3]}>
              <Reconciled />
            </GraphCard>
          </div> */}
        </div>
      </div>
      <div className="flex-1">
        <div class="grid grid-cols-12 gap-x-6">
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[3]}>
              <Receivables />
            </GraphCard>
          </div>
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[4]}>
              <Reconciled3PO />
            </GraphCard>
          </div>
          <div class="xxl:col-span-4 md:col-span-4 col-span-12">
            <GraphCard title={TITLES_CONST[5]} onChange={setChargesDelta}>
              <Charges3PO selectedDelta={chargesDelta} />
            </GraphCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreePODashboardGraphs;
