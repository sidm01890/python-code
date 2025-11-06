import React, { useEffect, useState, useRef } from "react";
import "../dashboard.style.css";
import DateRangeComponent from "../../../../components/DateRange";
import CustomSelect from "../../../../components/CustomSelect";
import DropdownWithCheckbox from "../../../../components/DropDownWithCheckbox";
import { useDispatch, useSelector } from "react-redux";
import InStore from "../../../../assets/Images/in_store.png";
import Download from "../../../../assets/Images/download.png";
import { setStoreList, setCurrentDashboardRequest } from "../../../../Redux/Slices/Common";
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
  const filterValuesRef = useRef(filterValues);
  
  // Keep ref in sync with state
  useEffect(() => {
    filterValuesRef.current = filterValues;
  }, [filterValues]);

  useEffect(() => {
    fetchCityListAndSet();
    fetchTenderWiseStoresMissedInMapping();
    fetchReconciliationTenders();
  }, []);

  const initialCitiesLoaded = useRef(false);

  const fetchCityListAndSet = async () => {
    let cityList = await fetchCityList();
    console.log('[ReconciliationFilter] fetchCityListAndSet - cityList received:', {
      cityListLength: cityList?.length,
      firstCity: cityList?.[0],
      cityListSample: cityList?.slice(0, 3),
    });
    
    // Extract city_id values for selectedOptions (dropdown expects array of IDs, not objects)
    const cityIds = cityList?.map((city) => city.city_id || city.id || city) || [];
    
    console.log('[ReconciliationFilter] fetchCityListAndSet - extracted cityIds:', {
      cityIdsLength: cityIds.length,
      cityIdsSample: cityIds.slice(0, 5),
    });
    
    setFilterValues((prev) => ({ ...prev, cities: cityIds }));
    // Automatically fetch stores when cities are initially loaded
    if (cityIds?.length > 0) {
      initialCitiesLoaded.current = true;
      await onCityChange(cityIds);
    }
  };

  useEffect(() => {
    // Only trigger when cities change after initial load (user interaction)
    // Skip if this is the initial load (handled in fetchCityListAndSet)
    if (initialCitiesLoaded.current && filterValues?.cities?.length > 0) {
      onCityChange(filterValues.cities);
    }
  }, [filterValues?.cities?.length]);

  const handleFilterChange = (name, value) => {
    if (name === "salesType") {
      setFilterValues((prev) => {
        const updatedObj = {
          tender: prev["tender"],
          [name]: value,
        };
        dispatch(setReconciliationFilters(updatedObj));
        return { ...prev, [name]: value };
      });
      return;
    } else {
      setFilterValues((prev) => {
        const updatedObj = {
          salesType: prev["salesType"],
          [name]: value,
        };
        dispatch(setReconciliationFilters(updatedObj));
        return { ...prev, [name]: value };
      });
      // Use setTimeout to ensure state is updated before calling searchReconciliationData
      setTimeout(() => {
        searchReconciliationData(value);
      }, 0);
    }
  };

  const onDateChange = (date) => {
    setFilterValues((prev) => ({ ...prev, startDate: date[0], endDate: date[1] }));
  };

  const onCityChange = async (cities) => {
    console.log('[ReconciliationFilter] onCityChange called:', { cities, citiesLength: cities?.length });
    if (cities?.length === 0) {
      console.log('[ReconciliationFilter] Cities empty, clearing stores');
      setFilterValues((prev) => {
        dispatch(setStoreList([]));
        return { ...prev, stores: [] };
      });
      return null;
    }
    // Use ref to get current dates without closure issues
    const currentFilterValues = filterValuesRef.current;
    const params = {
      startDate: format(currentFilterValues?.startDate, "yyyy-MM-dd"),
      endDate: format(currentFilterValues?.endDate, "yyyy-MM-dd"),
      cities: cities,
    };
    
    console.log('[ReconciliationFilter] Fetching store list with params:', params);
    try {
      const storeList = await fetchStoreList(params);
      console.log('[ReconciliationFilter] Store list fetched:', {
        storeListLength: storeList?.length,
        firstStore: storeList?.[0],
        storeListSample: storeList?.slice(0, 3),
      });
      
      // Dispatch storeList to Redux for the dropdown component
      dispatch(setStoreList(storeList || []));
      
      const storeListIds = storeList
        ?.filter((str) => str.posDataSync === true)
        ?.map((item) => item?.code);
      
      console.log('[ReconciliationFilter] Filtered store IDs:', {
        storeListIdsLength: storeListIds?.length,
        storeListIdsSample: storeListIds?.slice(0, 5),
      });
      
      setFilterValues((prev) => ({ ...prev, stores: storeListIds }));
    } catch (error) {
      console.error('[ReconciliationFilter] Error fetching store list:', error);
    }
  };

  const onStoreChange = (stores) => {
    console.log('[ReconciliationFilter] onStoreChange called:', {
      stores,
      storesLength: stores?.length,
      storesType: typeof stores,
      storesIsArray: Array.isArray(stores),
      firstStore: stores?.[0],
      firstStoreType: typeof stores?.[0],
    });
    
    // Safety check: ensure stores is an array
    if (!Array.isArray(stores)) {
      console.error('[ReconciliationFilter] onStoreChange received non-array:', stores);
      return;
    }
    
    // Log if any store is an object (should be just IDs/codes)
    const objectStores = stores.filter(s => typeof s === 'object' && s !== null);
    if (objectStores.length > 0) {
      console.warn('[ReconciliationFilter] onStoreChange received object stores (expected primitives):', objectStores);
    }
    
    setFilterValues((prev) => ({ ...prev, stores: stores }));
  };

  const searchReconciliationData = (tender = "") => {
    console.log("[ReconciliationFilter] ===== SEARCH RECONCILIATION DATA START =====");
    console.log("[ReconciliationFilter] Filter values:", {
      startDate: filterValues?.startDate,
      endDate: filterValues?.endDate,
      storesCount: filterValues?.stores?.length,
      stores: filterValues?.stores,
      tender: tender || filterValues.tender
    });
    
    if (filterValues.stores?.length === 0) {
      console.warn("[ReconciliationFilter] ⚠️ No stores selected, returning early");
      return;
    }

    let params = {
      startDate: format(filterValues?.startDate, "yyyy-MM-dd 00:00:00"),
      endDate: format(filterValues?.endDate, "yyyy-MM-dd 23:59:59"),
      stores: filterValues.stores,
      tender: tender || filterValues.tender,
    };
    
    console.log("[ReconciliationFilter] Formatted params:", JSON.stringify(params, null, 2));
    console.log("[ReconciliationFilter] Params details:", {
      startDate: params.startDate,
      endDate: params.endDate,
      storesCount: params.stores?.length,
      firstFewStores: params.stores?.slice(0, 5),
      lastFewStores: params.stores?.slice(-5),
      tender: params.tender
    });
    
    // Set currentDashboardRequest in Redux for download functionality
    console.log("[ReconciliationFilter] Setting currentDashboardRequest in Redux...");
    dispatch(setCurrentDashboardRequest({
      startDate: params.startDate,
      endDate: params.endDate,
      stores: params.stores,
    }));
    console.log("[ReconciliationFilter] ✅ currentDashboardRequest set in Redux");
    
    console.log("[ReconciliationFilter] Calling getDashboard3POData...");
    getDashboard3POData(params, true);
    fetchLastReconciliationSync(tender || filterValues.tender);
    console.log("[ReconciliationFilter] ===== SEARCH RECONCILIATION DATA END =====");
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
          option_value={"city_id"}
          option_label={"city_name"}
          selectedLabel="Cities - "
          selectedOptions={filterValues.cities}
          setSelectedOptions={(cities) => {
            console.log('[ReconciliationFilter] Cities selected:', {
              cities,
              citiesLength: cities?.length,
              citiesType: typeof cities,
              citiesIsArray: Array.isArray(cities),
              firstCity: cities?.[0],
              firstCityType: typeof cities?.[0],
            });
            setFilterValues((prev) => ({ ...prev, cities: cities }));
          }}
        />
        <DropdownWithCheckbox
          data={storeList}
          placeholder={"Select Store"}
          option_value={"code"}
          option_label={"store_name"}
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
