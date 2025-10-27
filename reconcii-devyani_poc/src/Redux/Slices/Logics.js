import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  tenderList: [],
  activeTender: [],
  tableList: [],
  excelFiles: [],
  logicGroups: [],
  logicData: [],
  activeLogic: null,
  activeLogicIndex: -1,
  dbLogicId: null,
};

export const LogicsSlice = createSlice({
  name: "LogicsService",
  initialState,
  reducers: {
    setExcelFiles: (state, action) => {
      state.excelFiles = action.payload;
    },
    setLogicGroups: (state, action) => {
      state.logicGroups = action.payload;
    },
    setLogicData: (state, action) => {
      state.logicData = action.payload;
    },
    setActiveLogic: (state, action) => {
      state.activeLogic = action.payload;
    },
    setTenderList: (state, action) => {
      state.tenderList = action.payload;
    },
    setTableList: (state, action) => {
      state.tableList = action.payload;
    },
    setActiveLogicIndex: (state, action) => {
      state.activeLogicIndex = action.payload;
    },
    setActiveTender: (state, action) => {
      state.activeTender = action.payload;
    },
    setDBLogicId: (state, action) => {
      state.dbLogicId = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  setExcelFiles,
  setLogicData,
  setActiveLogic,
  setTenderList,
  setTableList,
  setActiveLogicIndex,
  setActiveTender,
  setDBLogicId,
  setLogicGroups,
} = LogicsSlice.actions;

export default LogicsSlice.reducer;
