import React, { useEffect, useState } from "react";
import SimpleSelectBox from "../../../../components/SimpleSelectBox";
import {
  AGGREGATOR_SALES_ITEM,
  DASHBOARD_ITEMS,
  STORE_SALES_ITEM,
} from "../DashboardConstants";
import "../dashboard.style.css";
import DateRangeComponent from "../../../../components/DateRange";
import useDashboard from "../useDashboard";
import CustomSelect from "../../../../components/CustomSelect";
import DropdownWithCheckbox from "../../../../components/DropDownWithCheckbox";
import { useDispatch, useSelector } from "react-redux";
import InStore from "../../../../assets/Images/in_store.png";
import Download from "../../../../assets/Images/download.png";
import {
  setCurrentDashboardRequest,
  setDashboardFilters,
  setDashboardFilterValues,
  setStoreList,
} from "../../../../Redux/Slices/Common";
import { format } from "date-fns";
import PrimaryButton from "../../../../components/PrimaryButton";
import { useLoader } from "../../../../Utils/Loader";
import moment from "moment";
const BLANK_FILTERS = {
  startDate: new Date(),
  endDate: new Date(),
  salesLocation: "",
  salesType: "",
  cities: [],
  stores: [],
};
const DashboardFilter = () => {
  const dispatch = useDispatch();
  const { setToastMessage } = useLoader();
  const {
    fetchCityList,
    fetchStoreList,
    getDashboard,
    downloadStoreReport,
    downloadSummaryReport,
    fetchTenderWiseStoresMissedInMapping,
    fetchOldEffectiveDate,
  } = useDashboard();
  let { cityList, storeList, loadingDashboard, dashboardFilterValues, currentDashboardRequest } =
    useSelector((state) => state.CommonService);
  const [filterValues, setFilterValues] = useState({});

  useEffect(() => {
    fetchCityListAndSet();
    fetchTenderWiseStoresMissedInMapping();
    fetchOldEffectiveDate();

    // const savedFilters = localStorage.getItem("dashboardFilters");
    // if (savedFilters) {
    //   const parsed = JSON.parse(savedFilters);

    //   setFilterValues({
    //     ...parsed,
    //     startDate: parsed.startDate ? new Date(parsed.startDate) : null,
    //     endDate: parsed.endDate ? new Date(parsed.endDate) : null,
    //   });
    // } else if (dashboardFilterValues) {
    //   setFilterValues({
    //     ...dashboardFilterValues,
    //     startDate: dashboardFilterValues.startDate
    //       ? new Date(dashboardFilterValues.startDate)
    //       : null,
    //     endDate: dashboardFilterValues.endDate
    //       ? new Date(dashboardFilterValues.endDate)
    //       : null,
    //   });
    // } else {
    const initialFilters = {
      ...BLANK_FILTERS,
      salesLocation: DASHBOARD_ITEMS[0]?.key,
      salesType: STORE_SALES_ITEM[0]?.key,
    };
    setFilterValues(initialFilters);
    
    // Initialize Redux state with default filters to ensure calculations work
    dispatch(setDashboardFilters({
      salesLocation: DASHBOARD_ITEMS[0]?.key,
      salesType: STORE_SALES_ITEM[0]?.key,
    }));
    // }
  }, []);

  // useEffect(() => {
  //   // Convert date to string before saving to Redux
  //   const serializedFilterValues = {
  //     ...filterValues,
  //     startDate: filterValues?.startDate?.toISOString?.() || null,
  //     endDate: filterValues?.endDate?.toISOString?.() || null,
  //   };

  //   dispatch(setDashboardFilterValues(serializedFilterValues));
  //   localStorage.setItem(
  //     "dashboardFilters",
  //     JSON.stringify(serializedFilterValues)
  //   ); // <-- Save to localStorage
  // }, [filterValues]);

  const fetchCityListAndSet = async () => {
    let cityList = await fetchCityList();
    // Don't set all cities as selected - leave cities empty so user selects manually
    // setFilterValues({ ...filterValues, cities: cityList }); // REMOVED - was causing all cities to be selected
  };

  // Remove the useEffect that auto-triggers onCityChange
  // This was causing all cities to be sent to API on initial load
  // useEffect(() => {
  //   if (filterValues?.cities?.length) {
  //     onCityChange(filterValues?.cities);
  //   }
  // }, [filterValues?.cities?.length]);

  const handleFilterChange = (name, value) => {
    if (name === "salesLocation") {
      let updatedObj = {
        [name]: value,
        salesType:
          value === DASHBOARD_ITEMS[0]?.key
            ? STORE_SALES_ITEM[0]?.key
            : AGGREGATOR_SALES_ITEM[0].key,
      };
      setFilterValues({
        ...filterValues,
        [name]: value,
        salesType:
          value === DASHBOARD_ITEMS[0]?.key
            ? STORE_SALES_ITEM[0]?.key
            : AGGREGATOR_SALES_ITEM[0].key,
      });
      dispatch(setDashboardFilters(updatedObj));
    } else if (name === "salesType") {
      let updatedObj = {
        salesLocation: filterValues["salesLocation"],
        [name]: value,
      };
      setFilterValues({
        ...filterValues,
        [name]: value,
      });
      dispatch(setDashboardFilters(updatedObj));
    }
  };

  const onDateChange = (date) => {
    setFilterValues({ ...filterValues, startDate: date[0], endDate: date[1] });
  };

  const onCityChange = async (cities) => {
    console.log("[DashboardFilter] onCityChange called:", { cities, citiesLength: cities?.length });
    
    if (cities?.length === 0) {
      console.log("[DashboardFilter] Cities empty, clearing stores");
      dispatch(setStoreList([]));
      setFilterValues((prev) => ({ ...prev, cities: cities, stores: [] }));
      return null;
    }
    
    // Extract city_id values from selected cities
    // DropdownWithCheckbox may return either full objects or just city_id values
    // We need to normalize to extract only city_id values for the API
    const cityIds = cities.map((city) => {
      // If city is an object, extract city_id
      if (typeof city === 'object' && city !== null) {
        return city.city_id || city.id || city;
      }
      // If city is already a string/number (city_id), use it directly
      return city;
    });
    
    console.log("[DashboardFilter] Extracted city IDs:", {
      cityIds,
      cityIdsLength: cityIds?.length,
      cityIdsSample: cityIds?.slice(0, 5),
    });
    
    // Update cities immediately (keep original format for display)
    setFilterValues((prev) => ({ ...prev, cities: cities }));
    
    // Prepare API params with only city IDs (not full objects)
    let params = {
      startDate: moment(filterValues?.startDate).format("YYYY-MM-DD"),
      endDate: moment(filterValues?.endDate).format("YYYY-MM-DD"),
      cities: cityIds, // Send only city IDs to API
    };
    
    console.log("[DashboardFilter] Fetching store list with params:", {
      ...params,
      citiesCount: params.cities?.length,
      citiesSample: params.cities?.slice(0, 5),
    });
    
    try {
      let storeList = await fetchStoreList(params);
      console.log("[DashboardFilter] Store list fetched:", {
        storeListLength: storeList?.length,
        firstStore: storeList?.[0],
        storeListSample: storeList?.slice(0, 3),
      });
      
      // Dispatch storeList to Redux for the dropdown component
      // This ensures only stores from selected cities are shown
      dispatch(setStoreList(storeList || []));
      
      // Clear selected stores - let user manually select stores
      // Only stores with posDataSync === true will be enabled (handled by disableOptionOnKey)
      setFilterValues((prev) => ({ ...prev, stores: [] }));
      
      console.log("[DashboardFilter] Store list updated in Redux, stores cleared from selection");
    } catch (error) {
      console.error("[DashboardFilter] Error fetching store list:", error);
      dispatch(setStoreList([]));
      setFilterValues((prev) => ({ ...prev, stores: [] }));
    }
  };

  const onStoreChange = (stores) => {
    setFilterValues({ ...filterValues, stores: stores });
  };

  const searchDashboardData = () => {
    console.log("[DashboardFilter] ===== SEARCH DASHBOARD DATA START =====");
    console.log("[DashboardFilter] Filter values:", {
      startDate: filterValues?.startDate,
      endDate: filterValues?.endDate,
      storesCount: filterValues?.stores?.length,
      stores: filterValues?.stores
    });
    
    let params = {
      startDate: moment(filterValues?.startDate).format("YYYY-MM-DD 00:00:00"),
      endDate: moment(filterValues?.endDate).format("YYYY-MM-DD 23:59:59"),
      stores: filterValues.stores,
    };
    
    console.log("[DashboardFilter] Formatted params:", JSON.stringify(params, null, 2));
    console.log("[DashboardFilter] Params details:", {
      startDate: params.startDate,
      endDate: params.endDate,
      storesCount: params.stores?.length,
      firstFewStores: params.stores?.slice(0, 5),
      lastFewStores: params.stores?.slice(-5)
    });
    
    console.log("[DashboardFilter] Setting currentDashboardRequest in Redux...");
    dispatch(setCurrentDashboardRequest(params));
    console.log("[DashboardFilter] ✅ currentDashboardRequest set in Redux");
    
    console.log("[DashboardFilter] Calling getDashboard...");
    getDashboard(params);
    console.log("[DashboardFilter] ===== SEARCH DASHBOARD DATA END =====");
  };

  const submitStoreReportRequest = async () => {
    let req = {
      cities: filterValues.cities,
    };
    setToastMessage({
      message: "Reports generation is disabled",
      type: "error",
    });

    return;
    await downloadStoreReport(req);
  };

  return (
    <div>
      <div className="box filter-row gap-3">
        <CustomSelect
          data={DASHBOARD_ITEMS}
          option_value={"key"}
          option_label={"label"}
          onChange={(e) => handleFilterChange("salesLocation", e.target.value)}
          value={filterValues?.salesLocation}
          additionalStyle={{ minWidth: "150px" }}
        />
        <DateRangeComponent
          startDate={filterValues?.startDate}
          endDate={filterValues.endDate}
          onDateChange={onDateChange}
        />
        <CustomSelect
          data={
            filterValues?.salesLocation === DASHBOARD_ITEMS[0]?.key
              ? STORE_SALES_ITEM
              : AGGREGATOR_SALES_ITEM
          }
          option_value={"key"}
          option_label={"label"}
          onChange={(e) => handleFilterChange("salesType", e.target.value)}
          value={filterValues?.salesType}
          additionalStyle={{ minWidth: "150px" }}
        />
        <DropdownWithCheckbox
          placeholder={"Select City"}
          data={cityList}
          option_value={"city_id"}
          option_label={"city_name"}
          selectedLabel="Cities - "
          selectedOptions={filterValues.cities}
          setSelectedOptions={onCityChange}
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
            disabled={filterValues.stores?.length === 0}
            label="Search"
            onClick={searchDashboardData}
            loading={loadingDashboard}
          />
        </div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
          <div style={{ width: "auto", display: "inline-block" }}>
            <PrimaryButton
              disabled={!currentDashboardRequest || !currentDashboardRequest.startDate || !currentDashboardRequest.stores || currentDashboardRequest.stores.length === 0}
              label="Download Summary"
              onClick={downloadSummaryReport}
              style={{ 
                backgroundColor: "#6c757d", 
                color: "white",
                opacity: (!currentDashboardRequest || !currentDashboardRequest.startDate || !currentDashboardRequest.stores || currentDashboardRequest.stores.length === 0) ? 0.5 : 1,
                width: "auto !important",
                minWidth: "auto",
                padding: "6px 12px",
                fontSize: "14px",
                height: "auto"
              }}
            />
          </div>
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
    </div>
  );
};

export default DashboardFilter;
