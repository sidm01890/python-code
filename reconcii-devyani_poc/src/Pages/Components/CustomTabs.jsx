import React, { useEffect, useRef, useState } from "react";

// import "../vouchers.style.css";

export default function CustomTabs({ tabs, activeTab, setActiveTab }) {
  return (
    <div className="flex gap-2 mt-3">
      {tabs?.map((tab) => {
        return (
          <Tab
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

const Tab = ({ tab, activeTab, setActiveTab }) => {
  return (
    <button
      className={`voucher-tab ${activeTab === tab.id ? "active" : ""}`}
      onClick={() => setActiveTab(tab.id)}
    >
      {tab?.label}
    </button>
  );
};
