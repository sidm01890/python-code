import React, { forwardRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./components.css";
export default function DateRangeComponent({
  startDate = new Date(),
  endDate = new Date(),
  onDateChange = () => {},
}) {
  const ExampleCustomInput = forwardRef(
    ({ value, onClick, className }, ref) => (
      <div className="date-range-picker">
        <button
          className={`${className} mt-0.5 flex justify-center items-center`}
          onClick={onClick}
          ref={ref}
        >
          <div className="flex flex-1 flex justify-center">{value}</div>
          <span className="material-icons-outlined">date_range</span>
        </button>
      </div>
    )
  );

  return (
    <DatePicker
      selectsRange={true}
      todayButton="Today"
      customInput={<ExampleCustomInput />}
      dateFormat="MM/dd/yyyy"
      startDate={startDate}
      endDate={endDate}
      monthsShown={2}
      onChange={onDateChange}
      maxDate={new Date()}
      showPreviousMonths
    />
  );
}
