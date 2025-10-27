import React, { useEffect, useRef, useState } from "react";

import "../vouchers.style.css";
import VOUCHER_TABS from "./constants";

export default function VoucherTabs({ activeTab, setActiveTab }) {
  return (
    <div className="flex gap-2 mt-3">
      {VOUCHER_TABS?.map((tab) => {
        return (
          <VoucherTab
            key={tab?.id}
            tab={tab}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        );
      })}
    </div>
  );
}

const VoucherTab = ({ tab, activeTab, setActiveTab }) => {
  return (
    <button
      className={`voucher-tab ${activeTab === tab.id ? "active" : ""}`}
      onClick={() => setActiveTab(tab.id)}
    >
      {tab?.label}
    </button>
  );
};
