import { configureStore } from '@reduxjs/toolkit'
import ReconciliationSlice from './Slices/Reconciliation'
import CommonSlice  from './Slices/Common'
import LogicsSlice from './Slices/Logics'
export const store = configureStore({
  reducer: {
    ReconciliationService: ReconciliationSlice,
    CommonService: CommonSlice,
    LogicsService: LogicsSlice
  },
})