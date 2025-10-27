import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  userProfile: {},
  userDetailedProfile: {},
  cityList: [],
  storeList: [],
  dashboardFilters: {
    salesLocation: "Store Sales",
    salesType: "POS Sales",
  },
  dashboardData: {},
  dashboard3POData: {},
  loadingDashboard: false,
  currentDashboardRequest: {},
  tenderWiseStoresMissedInMapping: [],
  dataEffectiveDate: "",
  dashboardFilterValues: null,
};

export const CommonSlice = createSlice({
  name: "CommonService",
  initialState,
  reducers: {
    setUserProfile: (state, action) => {
      state.userProfile = action.payload;
    },
    setUserDetailedProfile: (state, action) => {
      state.userDetailedProfile = action.payload;
    },
    setCityList: (state, action) => {
      state.cityList = action.payload;
    },
    setStoreList: (state, action) => {
      state.storeList = action.payload;
    },
    setDashboardFilters: (state, action) => {
      state.dashboardFilters = action.payload;
    },
    setDashboardData: (state, action) => {
      state.dashboardData = action.payload;
    },
    setDashboard3POData: (state, action) => {
      state.dashboard3POData = action.payload;
    },
    setLoadingDashboard: (state, action) => {
      state.loadingDashboard = action.payload;
    },
    setCurrentDashboardRequest: (state, action) => {
      state.currentDashboardRequest = action.payload;
    },
    setTenderWiseStoresMissedInMapping: (state, action) => {
      state.tenderWiseStoresMissedInMapping = action.payload;
    },
    setDataEffectiveDate: (state, action) => {
      state.dataEffectiveDate = action.payload;
    },
    setDashboardFilterValues: (state, action) => {
      state.dashboardFilterValues = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  setUserProfile,
  setUserDetailedProfile,
  setCityList,
  setStoreList,
  setDashboardFilters,
  setDashboardData,
  setDashboard3POData,
  setLoadingDashboard,
  setCurrentDashboardRequest,
  setTenderWiseStoresMissedInMapping,
  setDataEffectiveDate,
  setDashboardFilterValues,
} = CommonSlice.actions;

export default CommonSlice.reducer;
