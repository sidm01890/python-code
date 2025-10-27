import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  types: [],
  reconciliationTenders: [],
  reconciliationFilters: {
    tender: "",
    salesType: "3PO Sales",
  },
  reconciliation3POData: {},
  lastReconciliationSync: {},
};

export const ReconciliationSlice = createSlice({
  name: "ReconciliationService",
  initialState,
  reducers: {
    setTypesData: (state, action) => {
      state.types = action.payload;
    },
    setReconciliationTenders: (state, action) => {
      state.reconciliationTenders = action.payload;
    },
    setReconciliationFilters: (state, action) => {
      state.reconciliationFilters = action.payload;
    },
    setReconciliation3POData: (state, action) => {
      state.reconciliation3POData = action.payload;
    },
    setLastReconciliationSync: (state, action) => {
      state.lastReconciliationSync = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  setTypesData,
  setReconciliationTenders,
  setReconciliationFilters,
  setReconciliation3POData,
  setLastReconciliationSync,
} = ReconciliationSlice.actions;

export default ReconciliationSlice.reducer;
