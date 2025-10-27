import React, { useEffect, useRef, useState } from "react";
import BlankCard from "../../../components/BlankCard";
import { useSelector } from "react-redux";
import Select from "react-select";
import useExcelDBMapping from "./useExcelDBMapping";
import PrimaryButton from "../../../components/PrimaryButton";
export default function ExcelDBMapping() {
  const {
    updateExcelDbMappingByDataSource,
    getDataSourceList,
    dataCategoryList,
    filterParams,
    handleFilterParams,
    tenderList,
    mappingData,
    currentMapping,
    setCurrentMapping,
  } = useExcelDBMapping();

  useEffect(() => {
    getDataSourceList();
  }, []);

  const onSubmit = () => {};
  const handleMappingChange = (excelColumn, dbColumn, index) => {
    let localMapping = [...currentMapping];
    let updatedObj = {
      excelColumnName: excelColumn,
      dbColumnName: dbColumn,
    };
    localMapping[index] = updatedObj;
    setCurrentMapping(localMapping);
  };

  return (
    <div className="">
      <BlankCard
        header={<h4 class="box-title font-bold text-base">EXCEL DB MAPPING</h4>}
      >
        <div className="pt-3 w-full flex gap-3">
          <div className="md:w-1/3 mb-3">
            <label>
              Category <span className="required">*</span>
            </label>
            <Select
              onChange={(e) => handleFilterParams("category", e.value)}
              options={dataCategoryList.map((option) => ({
                label: option?.category,
                value: option?.category,
              }))}
            />
          </div>
          <div className="md:w-1/3 mb-3">
            <label>
              Tender <span className="required">*</span>
            </label>
            <Select
              onChange={(e) => handleFilterParams("tender", e)}
              options={tenderList.map((option) => ({
                ...option,
                label: option?.tender,
                value: option?.types[0]?.dataSource,
              }))}
              value={
                filterParams?.tender === "" ? {} : filterParams?.tender_item
              }
            />
          </div>
        </div>
        {mappingData?.dataSource && (
          <div className="data-source-mapping">
            <div className="flex">
              <div className="flex-1 flex items-center">
                <p className="title">{mappingData?.dataSource}</p>
              </div>
              <div className="flex-1 flex items-end justify-end">
                <div>
                  <PrimaryButton
                    label="UPDATE"
                    onClick={updateExcelDbMappingByDataSource}
                  />
                </div>
              </div>
            </div>
            <div className="mt-2">
              <div className="excel-row">
                <div className="flex-1 p-2 flex items-center custom-table-header">
                  Excel Column Name
                </div>
                <div className="flex-1 p-2 custom-table-header">
                  DB Column Name
                </div>
              </div>
              {mappingData?.excelColumns?.map((excelCol, index) => {
                return (
                  <ExcelColumnRow
                    key={excelCol}
                    excelCol={excelCol}
                    dbColumns={mappingData?.dbColumns}
                    currentMapping={currentMapping}
                    handleMappingChange={(excelColumn, dbColumn) =>
                      handleMappingChange(excelColumn, dbColumn, index)
                    }
                  />
                );
              })}
            </div>
            <div className="flex mt-2">
              <div className="flex-1 flex items-center"></div>
              <div className="flex-1 flex items-end justify-end">
                <div>
                  <PrimaryButton
                    label="UPDATE"
                    onClick={updateExcelDbMappingByDataSource}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </BlankCard>
    </div>
  );
}

const ExcelColumnRow = ({
  excelCol,
  dbColumns,
  currentMapping,
  handleMappingChange,
}) => {
  let selectedValue = currentMapping?.filter(
    (mapId) => mapId?.excelColumnName === excelCol
  );
  return (
    <div className="excel-row">
      <div className="flex-1 p-2 flex items-center">{excelCol}</div>
      <div className="flex-1 p-2">
        <Select
          onChange={(e) => handleMappingChange(excelCol, e.value)}
          options={dbColumns.map((option) => ({
            label: option,
            value: option,
          }))}
          value={
            selectedValue?.length > 0
              ? {
                  label: selectedValue[0]?.dbColumnName,
                  value: selectedValue[0]?.dbColumnName,
                }
              : {}
          }
        />
      </div>
    </div>
  );
};
