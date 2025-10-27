import { apiEndpoints } from "../../../ServiceRequest/APIEndPoints";
import { requestCallGet } from "../../../ServiceRequest/APIFunctions";
import { useDispatch } from "react-redux";
import {
  setLastReconciliationSync,
  setReconciliationTenders,
} from "../../../Redux/Slices/Reconciliation";

const useReconciliation = () => {
  const dispatch = useDispatch();
  const fetchReconciliationTenders = async () => {
    try {
      const response = await requestCallGet(apiEndpoints.REPORTING_TENDERS);
      if (response.status) {
        let ThreePOTenders = response?.data?.data?.filter(
          (tenderType) => tenderType?.category === "3PO"
        );
        if (ThreePOTenders?.length > 0) {
          dispatch(setReconciliationTenders(ThreePOTenders[0]?.tenders));
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLastReconciliationSync = async (tender) => {
    try {
      let params = {
        dsLog: tender,
      };
      const response = await requestCallGet(
        apiEndpoints.RECONCILIATION_LAST_SYNCED,
        params
      );
      if (response.status) {
        dispatch(setLastReconciliationSync(response.data.data));
      } else {
        let tempRecord = {
          lastReconciled: "18-11-2023",
          lastSyncList: [
            {
              tender: "DotPe",
              type: "Delivery Performance",
              dataSource: "DOTPE",
              lastSynced: "18-11-2023",
            },
            {
              tender: "POS Orders",
              type: "STLD",
              dataSource: "POS_ORDERS",
              lastSynced: "10-09-2024",
            },
          ],
        };
        dispatch(setLastReconciliationSync(tempRecord));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return {
    fetchReconciliationTenders,
    fetchLastReconciliationSync,
  };
};

export default useReconciliation;
