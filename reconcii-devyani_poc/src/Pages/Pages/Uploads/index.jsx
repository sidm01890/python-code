import React, { useEffect, useRef, useState } from "react";
import BlankCard from "../../../components/BlankCard";
import PrimaryButton from "../../../components/PrimaryButton";

import { FileUploader } from "react-drag-drop-files";

// const fileTypes = ["JPG", "PNG", "GIF"];
import "./upload.style.css";
import CustomSelect from "../../../components/CustomSelect";
import useUploads from "./useUploads";

export default function Uploads() {
  const {
    dataSource,
    values,
    handleChange,
    paymentTypeList,
    handleFileChange,
    onSubmit,
    files,
    clientOptions,
  } = useUploads();

  return (
    <div className="">
      <BlankCard header={<h4 class="box-title font-bold text-base">UPLOAD</h4>}>
        <div className="pt-3 w-full">
          <div className="md:w-1/3 mb-3">
            <CustomSelect
              label="Client"
              required
              data={[{ value: "-Select Client-", label: "-Select Client-" }, ...clientOptions]}
              option_value={"value"}
              option_label={"label"}
              onChange={(e) => handleChange("client", e.target.value)}
              value={values?.client}
            />
          </div>
          <div className="md:w-1/3 mb-3">
            <CustomSelect
              label="Type"
              data={[{ category: "-Select Type-" }, ...dataSource]}
              option_value={"category"}
              option_label={"category"}
              onChange={(e) => handleChange("type", e.target.value)}
              value={values?.type}
              required
              disabled={!values?.client}
            />
          </div>
          <div className="md:w-1/3 mb-3">
            <CustomSelect
              label="Tender"
              required
              data={[
                { tender: "-Select Tender-", types: [] },
                ...(dataSource?.filter(
                  (type) => type.category === values?.type
                )[0]?.tenders || []),
              ]}
              option_value={"tender"}
              option_label={"tender"}
              onChange={(e) => handleChange("tender", e.target.value)}
              value={values?.tender}
              disabled={!values?.type}
            />
          </div>
          <div className="md:w-1/3 mb-3">
            <CustomSelect
              label="Payment"
              required
              data={paymentTypeList}
              option_value={"dataSource"}
              option_label={"type"}
              onChange={(e) => handleChange("payment", e.target.value)}
              value={values?.payment}
              disabled={!values?.tender}
            />
          </div>
          <div className="custom-file-picker">
            <FileUploader
              handleChange={handleFileChange}
              name="file"
              // types={fileTypes}
              multiple
            >
              <div className="drag-drop-component">
                <i
                  className="fas fa-file-alt"
                  style={{ fontSize: "30px", marginBottom: "15px" }}
                ></i>
                <p>Drag & Drop your files here</p>
              </div>
            </FileUploader>
            <div className="flex gap-2">
              {[...files]?.map((file, index) => {
                return (
                  <div key={index} className="added-file-list">
                    <p>{file?.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="md:w-1/3 mt-3">
            <PrimaryButton label="Upload" onClick={onSubmit} />
          </div>
        </div>
      </BlankCard>
    </div>
  );
}
