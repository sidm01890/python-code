import { useSelector } from "react-redux";
import { formatNumberToLakhsAndCrores } from "../../../../Utils/UtilityFunctions";
const useDashboardNumber = () => {
  let { dashboardData, dashboard3POData, dashboardFilters } = useSelector(
    (state) => state.CommonService
  );

  const totalSalesData = () => {
    let totalS = 0;
    if (dashboardData?.sales > 0 || dashboardData?.trmSalesData?.sales) {
      totalS = dashboardData?.sales;
      if (dashboardFilters?.salesType === "POS Sales") {
        totalS = dashboardData?.sales;
      } else if (dashboardFilters?.salesType === "TRM Sales") {
        totalS = dashboardData?.trmSalesData?.sales;
      }
    }
    if (dashboard3POData?.posSales > 0 || dashboard3POData?.threePOSales > 0) {
      if (dashboardFilters?.salesType === "3PO Sales") {
        totalS += dashboard3POData?.threePOSales;
      } else if (dashboardFilters?.salesType === "POS Sales") {
        totalS += dashboard3POData?.posSales;
      }
    }

    return (
      {
        actual: formatNumberToLakhsAndCrores(totalS),
        tooltip: formatNumberToLakhsAndCrores(totalS),
        totalSales: totalS,
      } || {}
    );
  };

  const findSalesValue = (type) => {
    let totalS = 0;

    if (type === "Store Sales") {
      if (dashboardFilters?.salesType === "POS Sales") {
        totalS = dashboardData?.sales;
      } else if (dashboardFilters?.salesType === "TRM Sales") {
        totalS = dashboardData?.trmSalesData?.sales;
      }
    } else {
      if (dashboardFilters?.salesType === "3PO Sales") {
        totalS += dashboard3POData?.threePOSales;
      } else if (dashboardFilters?.salesType === "POS Sales") {
        totalS += dashboard3POData?.posSales;
      }
    }
    return formatNumberToLakhsAndCrores(totalS || 0);
  };

  return {
    totalSalesData,
    findSalesValue,
  };
};
export default useDashboardNumber;
