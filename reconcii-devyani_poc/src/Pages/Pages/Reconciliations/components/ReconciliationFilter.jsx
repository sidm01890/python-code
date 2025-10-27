import React, { useEffect, useState } from "react";
import "../dashboard.style.css";
import DateRangeComponent from "../../../../components/DateRange";
import CustomSelect from "../../../../components/CustomSelect";
import DropdownWithCheckbox from "../../../../components/DropDownWithCheckbox";
import { useDispatch, useSelector } from "react-redux";
import InStore from "../../../../assets/Images/in_store.png";
import Download from "../../../../assets/Images/download.png";
import { setStoreList } from "../../../../Redux/Slices/Common";
import { format } from "date-fns";
import PrimaryButton from "../../../../components/PrimaryButton";
import useReconciliation from "../useReconciliation";
import useDashboard from "../../Dashboard/useDashboard";
import { setReconciliationFilters } from "../../../../Redux/Slices/Reconciliation";
import moment from "moment";
import ReconciliationDateModal from "./ReconciliationDateModal";
const BLANK_FILTERS = {
  startDate: new Date(),
  endDate: new Date(),
  salesType: "",
  cities: [],
  stores: [],
  tender: "",
};
const DashboardFilter = () => {
  const dispatch = useDispatch();
  const {
    fetchCityList,
    fetchStoreList,
    getDashboard3POData,
    downloadStoreReport,
    fetchTenderWiseStoresMissedInMapping,
  } = useDashboard();
  const { fetchReconciliationTenders, fetchLastReconciliationSync } =
    useReconciliation();
  let { cityList, storeList, loadingDashboard } = useSelector(
    (state) => state.CommonService
  );
  let { reconciliationTenders, lastReconciliationSync } = useSelector(
    (state) => state.ReconciliationService
  );
  const [reconciliationModalVisible, setReconciliationModalVisible] =
    useState(false);
  const [filterValues, setFilterValues] = useState({
    ...BLANK_FILTERS,
    tender: "",
    salesType: "3PO Sales",
  });

  useEffect(() => {
    fetchCityListAndSet();
    fetchTenderWiseStoresMissedInMapping();
    fetchReconciliationTenders();
  }, []);

  const fetchCityListAndSet = async () => {
    let cityList = await fetchCityList();
    setFilterValues({ ...filterValues, cities: cityList });
  };

  useEffect(() => {
    onCityChange(filterValues?.cities);
  }, [filterValues?.cities?.length]);

  const handleFilterChange = (name, value) => {
    if (name === "salesType") {
      let updatedObj = {
        tender: filterValues["tender"],
        [name]: value,
      };
      setFilterValues({
        ...filterValues,
        [name]: value,
      });
      dispatch(setReconciliationFilters(updatedObj));
      return;
    } else {
      let updatedObj = {
        salesType: filterValues["salesType"],
        [name]: value,
      };
      setFilterValues({
        ...filterValues,
        [name]: value,
      });
      dispatch(setReconciliationFilters(updatedObj));
      searchReconciliationData(value);
    }
  };

  const onDateChange = (date) => {
    setFilterValues({ ...filterValues, startDate: date[0], endDate: date[1] });
  };

  const onCityChange = async (cities) => {
    if (cities?.length === 0) {
      setFilterValues({ ...filterValues, stores: [] });
      dispatch(setStoreList([]));
      return null;
    }
    let params = {
      startDate: format(filterValues?.startDate, "yyyy-MM-dd"),
      endDate: format(filterValues?.endDate, "yyyy-MM-dd"),
      cities: cities,
    };
    let storeList = await fetchStoreList(params);
    let storeListIds = storeList
      ?.filter((str) => str.posDataSync === true)
      ?.map((item) => item?.code);
    setFilterValues({ ...filterValues, stores: storeListIds });
  };

  const onStoreChange = (stores) => {
    setFilterValues({ ...filterValues, stores: stores });
  };

  const searchReconciliationData = (tender = "") => {
    if (filterValues.stores?.length === 0) {
      return;
    }

    let params = {
      startDate: format(filterValues?.startDate, "yyyy-MM-dd 00:00:00"),
      endDate: format(filterValues?.endDate, "yyyy-MM-dd 23:59:59"),
      stores: filterValues.stores,
      tender: tender || filterValues.tender,
    };
    getDashboard3POData(params, true);
    fetchLastReconciliationSync(tender || filterValues.tender);
    // dispatch(setCurrentDashboardRequest(params));
  };

  const submitStoreReportRequest = async () => {
    let req = {
      cities: filterValues.cities,
    };
    await downloadStoreReport(req);
  };

  return (
    <div>
      <div className="box filter-row gap-3">
        <CustomSelect
          data={[
            { technicalName: "", displayName: "Select Tender" },
            ...reconciliationTenders,
          ]}
          option_value={"technicalName"}
          option_label={"displayName"}
          onChange={(e) => handleFilterChange("tender", e.target.value)}
          value={filterValues?.tender}
          additionalStyle={{ minWidth: "200px" }}
        />
        <DateRangeComponent
          startDate={filterValues?.startDate}
          endDate={filterValues.endDate}
          onDateChange={onDateChange}
        />
        <DropdownWithCheckbox
          placeholder={"Select City"}
          data={cityList}
          option_value={"key"}
          option_label={"label"}
          selectedLabel="Cities - "
          selectedOptions={filterValues.cities}
          setSelectedOptions={(cities) =>
            setFilterValues({ ...filterValues, cities: cities })
          }
        />
        <DropdownWithCheckbox
          data={storeList}
          placeholder={"Select Store"}
          option_value={"code"}
          option_label={"name"}
          selectedLabel="Stores - "
          selectedOptions={filterValues.stores}
          setSelectedOptions={onStoreChange}
          disableOptionOnKey={{ key: "posDataSync", value: false }}
        />

        <div>
          <PrimaryButton
            disabled={
              filterValues.stores?.length === 0 || filterValues?.tender === ""
            }
            label="Search"
            onClick={() => searchReconciliationData()}
            loading={loadingDashboard}
          />
        </div>
      </div>

      <div className="flex justify-between">
        <div className="selected-store-div">
          {lastReconciliationSync?.lastReconciled && (
            <div className="">
              <span className="material-icons-outlined mr-2">
                calendar_month
              </span>
              <p>
                Last Reconciliation On:{" "}
                <b>
                  {moment(
                    lastReconciliationSync?.lastReconciled,
                    "DD-MM-YYYY"
                  ).format("DD MMM, YYYY")}
                </b>
              </p>
              <button
                onClick={() => setReconciliationModalVisible(true)}
                style={{ height: "24px" }}
              >
                <span className="material-icons-outlined mr-2">
                  keyboard_arrow_down
                </span>
              </button>
            </div>
          )}
        </div>
        <div className="selected-store-div">
          <div className="">
            <img src={InStore} alt="store" />
            <p>
              Selected Stores: <b>{filterValues.stores?.length}</b>
            </p>
          </div>
          <div>
            <img src={InStore} alt="store" />
            <p>
              Total Stores: <b>{storeList?.length}</b>
            </p>
          </div>
          <div>
            <a
              style={{ opacity: filterValues.cities?.length === 0 ? 0.2 : 1 }}
              href="/"
              disabled={filterValues.cities?.length === 0}
              onClick={(e) => {
                e.preventDefault();
                submitStoreReportRequest();
              }}
            >
              <img src={Download} alt="store" style={{ marginRight: 0 }} />
            </a>
          </div>
        </div>
      </div>
      {reconciliationModalVisible && (
        <ReconciliationDateModal
          lastSyncList={lastReconciliationSync?.lastSyncList}
          closeModal={() => setReconciliationModalVisible(false)}
        />
      )}
    </div>
  );
};

export default DashboardFilter;
