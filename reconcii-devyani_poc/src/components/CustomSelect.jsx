import React from "react";

const CustomSelect = (props) => {
  return (
    <div style={props.additionalStyle}>
      {props.label && (
        <label className="block text-gray-700 text-sm font-bold mb-2">
          {props.label} {props.required && <span className="required">*</span>}
        </label>
      )}
      <select
        value={props.value}
        name={props.name}
        onChange={props.onChange}
        className="border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
      >
        {props.placeholder && <option value="">{props.placeholder}</option>}
        {props?.data?.map((item) => {
          return (
            <option
              key={item[props.option_value]}
              value={item[props.option_value]}
              disabled={item.disabled === true}
            >
              {item[props.option_label]}
            </option>
          );
        })}
      </select>
      {props.error && (
        <span className="text-box-error-text">{props.error}</span>
      )}
    </div>
  );
};

export default CustomSelect;
