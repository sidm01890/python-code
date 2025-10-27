import React, { useEffect, useRef, useState } from "react";
import Select from "react-select";
import BlankCard from "../../components/BlankCard";
import ToggleButton from "../../components/ToggleButton";
import DateRangeComponent from "../../components/DateRange";
import {
  requestCallGet,
  requestCallPost,
} from "../../ServiceRequest/APIFunctions";
import { apiEndpoints } from "../../ServiceRequest/APIEndPoints";
import { useDispatch, useSelector } from "react-redux";
import { setTypesData } from "../../Redux/Slices/Reconciliation";
import { dateFormatChangerView } from "../../Utils/UtilityFunctions";
import PrimaryButton from "../../components/PrimaryButton";
import { toast } from "react-toastify";
import CustomInput from "../../components/Input";

export default function Settings() {
  let { types } = useSelector((state) => state.ReconciliationService);

  let dispatch = useDispatch();

  const tabs = ["Profile", "Security", "Multi Factor Authentication"];
  const [selectedTab, setSelectedTab] = useState(0);
  let [isDataUploading, setIsDataUploading] = useState(false);

  const onSubmit = async () => {};

  const renderProfileSection = () => {
    return (
      <div className="pl-6 mt-3 float-start">
        <div className="flex items-center">
          <div className="w-40">
            <h1>Full Name</h1>
          </div>
          <div className="w-60">
            <CustomInput placeholder={"Full Name"} defaultValue={"User"} />
          </div>
        </div>
        <div className="flex items-center mt-4">
          <div className="w-40">
            <h1>Password</h1>
          </div>
          <div className="w-60 ">
            <CustomInput placeholder={"Password"} disabled />
          </div>
        </div>
        <div className="flex items-center mt-4">
          <div className="w-40">
            <h1>Designation</h1>
          </div>
          <div className="w-60">
            <CustomInput defaultValue={"ADMIN"} disabled />
          </div>
        </div>
        <div className="flex items-center mt-4">
          <div className="w-40">
            <h1>Country/Region</h1>
          </div>
          <div className="w-60">
            <CustomInput placeholder={"Country/Region"} disabled />
          </div>
        </div>
        <div className="flex items-center mt-4">
          <div className="w-40">
            <h1>Email Address</h1>
          </div>
          <div className="w-60">
            <CustomInput defaultValue={"admin@support.reconcii.com"} disabled />
          </div>
        </div>
        <div className="flex items-center mt-4">
          <div className="w-40">
            <h1>Mobile Number</h1>
          </div>
          <div className="w-60">
            <CustomInput />
          </div>
        </div>
        <div className=" mt-4 ml-40">
          <PrimaryButton
            label={"Save Profile"}
            disabled={isDataUploading}
            onClick={onSubmit}
          />
        </div>
      </div>
    );
  };

  const renderSecurity = () => {

    let tableData = [{deviceType: 'Desktop/Laptop', OS: 'Windows', date: '29 june 2023', location: 'Gurugram'},{deviceType: 'Desktop/Laptop', OS: 'Windows', date: '29 june 2023', location: 'Gurugram'}]

    return (
      <div className="pl-6">
        <h1 className="text-base mt-3">Password</h1>
        <h1 className="text-Text-primary">Last changed 3 months ago</h1>
        <div className="my-4 border bg-Text-primary" />
        <table>
          <tr className="border-b">
            <th className=""></th>
            <th className="p-2">DEVICE TYPE</th>
            <th className="p-2">OPERATING SYSTEM</th>
            <th className="p-2">DATE</th>
            <th className="p-2">LOCATION</th>
          </tr>
          {tableData.map((item) => {
            return (
              <tr className="border-b">
                <td className=""><span class="material-icons-outlined ">remove</span></td>
                <td className="p-2">{item?.deviceType}</td>
                <td className="p-2">{item?.OS}</td>
                <td className="p-2">{item?.date}</td>
                <td className="p-2">{item?.location}</td>
              </tr>
            )
          })}
          
         
        </table>
      </div>
    );
  };
  
  const renderMultiFactor = () => {
    return (
      <div className="pl-6">
        <div className="flex gap-2 mt-4 items-center">
          <ToggleButton
            isOn={isOn}
            onChange={(e) => {
              setIsOn(e.target?.checked);
            }}
          />
          <h1>
            Use multi-factor authentication to add an extra layer of security to
            your account.
          </h1>
        </div>
        <h1 className="mt-10 text-base">SMS Based OTP</h1>
        <div className="flex items-center">
          <div className="rounded border p-3 mt-1">
            <span
              class="mb-1 ml-6 material-icons-outlined"
              style={{ fontSize: 64 }}
            >
              phone_iphone
            </span>
            <h1>+91 997 835 7237</h1>
          </div>
        </div>
        <div className="mt-3 ml-8 flex items-center">
          <span class=" material-icons-outlined bg-red-500 rounded-full text-white mr-1 hover:cursor-pointer">
            remove
          </span>
          <h1 class="hover:cursor-pointer">Remove</h1>
        </div>
      </div>
    );
  };

  const [isOn, setIsOn] = useState(false);

  return (
    <div className="">
      <div className="flex gap-1 bg-Background-light">
        {tabs.map((tab, index) => {
          return (
            <div
              key={index}
              className={`hover:cursor-pointer border-l border-t border-r p-2 rounded-t-md ${
                selectedTab === index && "bg-white font-bold"
              }`}
              onClick={() => setSelectedTab(index)}
            >
              {tab}
            </div>
          );
        })}
      </div>
      <BlankCard
        body={
          <div className="flex justify-between">
            {selectedTab === 0 ? renderProfileSection() : selectedTab === 1 ? renderSecurity() : renderMultiFactor()}
            <div className="p-3 rounded-md bg-Background-light w-80">
              <h1 className="text-sm">
                Make sure to use accurate and up-to-date information when adding
                your email address and mobile number.
              </h1>
              <h1 className="text-sm mt-4">
                If you encounter any issues during this process, contact your
                company’s IT support or relevant department for assistance.
              </h1>
            </div>
          </div>
        }
      />
    </div>
  );
}
