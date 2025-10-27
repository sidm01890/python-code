import { useState } from "react";
import { apiEndpoints } from "../../../ServiceRequest/APIEndPoints";
import {
  requestCallGet,
  requestCallPost,
} from "../../../ServiceRequest/APIFunctions";
import VOUCHER_TABS from "./components/constants";
const useVouchers = () => {
  const [activeTab, setActiveTab] = useState(VOUCHER_TABS[0].id);

  return {
    activeTab,
    setActiveTab,
  };
};

export default useVouchers;
