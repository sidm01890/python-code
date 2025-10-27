import React, { useEffect, useRef, useState } from "react";

import CustomSelect from "../../../../components/CustomSelect";
import DateRangeComponent from "../../../../components/DateRange";
import DropdownWithCheckbox from "../../../../components/DropDownWithCheckbox";
import PrimaryButton from "../../../../components/PrimaryButton";

const VoucherFilters = () => {
  return (
    <div>
      <div className="flex mt-2 gap-3">
        <div className="flex-1">
          Select Type
          <CustomSelect
            data={[]}
            option_value={"key"}
            option_label={"label"}
            //   onChange={(e) => handleFilterChange("selectedTender", e.target.value)}
            //   value={filterValues?.selectedTender}
          />
        </div>
        <div className="flex-1">
          Select Tender
          <CustomSelect
            data={[]}
            option_value={"key"}
            option_label={"label"}
            //   onChange={(e) => handleFilterChange("selectedTender", e.target.value)}
            //   value={filterValues?.selectedTender}
          />
        </div>
        <div className="flex-1">
          Transaction Type
          <CustomSelect
            data={[]}
            option_value={"key"}
            option_label={"label"}
            //   onChange={(e) => handleFilterChange("selectedTender", e.target.value)}
            //   value={filterValues?.selectedTender}
          />
        </div>
        <div className="flex-1">
          Voucher Type
          <CustomSelect
            data={[]}
            option_value={"key"}
            option_label={"label"}
            //   onChange={(e) => handleFilterChange("selectedTender", e.target.value)}
            //   value={filterValues?.selectedTender}
          />
        </div>
        <div className="flex-1">
          Date Range
          <DateRangeComponent
          // startDate={filterValues?.startDate}
          // endDate={filterValues.endDate}
          // onDateChange={onDateChange}
          />
        </div>
      </div>
      <div className="flex items-end justify-end mt-2">
        <div>
          <PrimaryButton
            //   disabled={filterValues?.selectedColumns?.length === 0}
            label="Search"
            // onClick={searchDashboardData}
            // loading={loadingDashboard}
          />
        </div>
      </div>
    </div>
  );
};

export default VoucherFilters;
