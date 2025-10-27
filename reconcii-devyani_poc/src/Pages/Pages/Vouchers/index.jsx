import React, { useEffect, useRef, useState } from "react";
import BlankCard from "../../../components/BlankCard";

import "./vouchers.style.css";
import VoucherTabs from "./components/Tabs";
import useVouchers from "./useVouchers";
import VoucherFilters from "./components/VoucherFilters";
import VoucherTable from "./components/VoucherTable";

export default function Vouchers() {
  const { activeTab, setActiveTab } = useVouchers();

  return (
    <div className="">
      <BlankCard
        header={<h4 className="box-title font-bold text-base">VOUCHERS</h4>}
      >
        <VoucherTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="voucher-content-area">
          <VoucherFilters />
          <VoucherTable />
        </div>
      </BlankCard>
    </div>
  );
}
