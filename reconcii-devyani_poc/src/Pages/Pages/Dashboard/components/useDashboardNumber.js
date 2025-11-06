import { useSelector } from "react-redux";
import { formatNumberToLakhsAndCrores } from "../../../../Utils/UtilityFunctions";
const useDashboardNumber = () => {
  let { dashboardData, dashboard3POData, dashboardFilters } = useSelector(
    (state) => state.CommonService
  );

  const totalSalesData = () => {
    let totalS = 0;

    // Add null/undefined guards
    if (!dashboardFilters || !dashboardFilters.salesLocation) {
      return {
        actual: formatNumberToLakhsAndCrores(0),
        tooltip: formatNumberToLakhsAndCrores(0),
        totalSales: 0,
      };
    }

    try {
      if (dashboardFilters.salesLocation === "Store Sales") {
        if (dashboardFilters?.salesType === "POS Sales") {
          totalS =
            parseFloat(dashboardData?.aggregatorTotal || 0) +
            parseFloat(dashboardData?.sales || 0);
        } else if (dashboardFilters?.salesType === "TRM Sales") {
          totalS =
            parseFloat(dashboardData?.aggregatorTotal || 0) +
            parseFloat(dashboardData?.trmSalesData?.sales || 0);
        }
      } else if (dashboardFilters.salesLocation === "Aggregator") {
        if (dashboardFilters?.salesType === "3PO Sales") {
          // total as per all available tenders
          let totalTenderWiseSales = 0;
          if (dashboard3POData?.threePOData && Array.isArray(dashboard3POData.threePOData)) {
            dashboard3POData.threePOData.forEach((tender) => {
              totalTenderWiseSales += parseFloat(tender?.threePOSales || 0);
            });
          }
          totalS =
            parseFloat(dashboard3POData?.instoreTotal || 0) +
            parseFloat(totalTenderWiseSales);
        } else if (dashboardFilters?.salesType === "POS Sales") {
          totalS =
            parseFloat(dashboard3POData?.instoreTotal || 0) +
            parseFloat(dashboard3POData?.posSales || 0);
        }
      }
    } catch (error) {
      console.error("Error calculating totalSalesData:", error);
      totalS = 0;
    }

    // if (dashboardData?.sales > 0 || dashboardData?.trmSalesData?.sales) {
    //   totalS = dashboardData?.sales;
    //   if (dashboardFilters?.salesType === "POS Sales") {
    //     totalS = dashboardData?.sales;
    //   } else if (dashboardFilters?.salesType === "TRM Sales") {
    //     totalS = dashboardData?.trmSalesData?.sales;
    //   }
    // }
    // if (dashboard3POData?.posSales > 0 || dashboard3POData?.threePOSales > 0) {
    //   if (dashboardFilters?.salesType === "3PO Sales") {
    //     totalS += dashboard3POData?.threePOSales;
    //   } else if (dashboardFilters?.salesType === "POS Sales") {
    //     totalS += dashboard3POData?.posSales;
    //   }
    // }

    return {
      actual: formatNumberToLakhsAndCrores(totalS),
      tooltip: formatNumberToLakhsAndCrores(totalS),
      totalSales: totalS,
    };
  };

  const findSalesValue = (type) => {
    let totalS = 0;

    // Add null/undefined guards
    if (!dashboardFilters || !dashboardFilters.salesLocation) {
      return formatNumberToLakhsAndCrores(0);
    }

    try {
      if (type === "Store Sales") {
        if (dashboardFilters.salesLocation === "Store Sales") {
          if (dashboardFilters?.salesType === "POS Sales") {
            totalS = parseFloat(dashboardData?.sales || 0);
          } else if (dashboardFilters?.salesType === "TRM Sales") {
            totalS = parseFloat(dashboardData?.trmSalesData?.sales || 0);
          }
        } else if (dashboardFilters.salesLocation === "Aggregator") {
          totalS = parseFloat(dashboard3POData?.instoreTotal || 0);
        }
      } else {
        // Aggregator Value
        if (dashboardFilters.salesLocation === "Store Sales") {
          totalS = parseFloat(dashboardData?.aggregatorTotal || 0);
        } else if (dashboardFilters.salesLocation === "Aggregator") {
          if (dashboardFilters?.salesType === "3PO Sales") {
            let totalTenderWiseSales = 0;
            if (dashboard3POData?.threePOData && Array.isArray(dashboard3POData.threePOData)) {
              dashboard3POData.threePOData.forEach((tender) => {
                totalTenderWiseSales += parseFloat(tender?.threePOSales || 0);
              });
            }
            totalS = parseFloat(totalTenderWiseSales);
          } else if (dashboardFilters?.salesType === "POS Sales") {
            totalS = parseFloat(dashboard3POData?.posSales || 0);
          }
        }
      }
    } catch (error) {
      console.error("Error calculating findSalesValue:", error);
      totalS = 0;
    }

    // if (type === "Store Sales") {
    //   if (dashboardFilters?.salesType === "POS Sales") {
    //     totalS = dashboardData?.sales;
    //   } else if (dashboardFilters?.salesType === "TRM Sales") {
    //     totalS = dashboardData?.trmSalesData?.sales;
    //   }
    // } else {
    //   if (dashboardFilters?.salesType === "3PO Sales") {
    //     totalS += dashboard3POData?.threePOSales;
    //   } else if (dashboardFilters?.salesType === "POS Sales") {
    //     totalS += dashboard3POData?.posSales;
    //   }
    // }
    return formatNumberToLakhsAndCrores(totalS || 0);
  };

  return {
    totalSalesData,
    findSalesValue,
  };
};
export default useDashboardNumber;
