import React, { useEffect, useRef, useState } from "react";
import BlankCard from "../../../components/BlankCard";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import "./reports.style.css";
import PrimaryButton from "../../../components/PrimaryButton";
import CustomSelect from "../../../components/CustomSelect";
import useAuditLog from "./useAuditLog";
import LOG_ACTIONS from "../../../Constants/LogAction";
import moment from "moment";

export default function AuditLog() {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const {
    filterValues,
    fetchUserList,
    handleFilterChange,
    setFilterValues,
    userList,
    auditLogList,
    fetchAuditLog,
  } = useAuditLog();

  useEffect(() => {
    fetchUserList();
  }, []);

  return (
    <div className="">
      <BlankCard
        header={<h4 className="box-title font-bold text-base">AUDIT LOG</h4>}
      >
        <div className="flex mt-3 gap-3">
          {/* <div className="flex-1">
            <p>User</p>
            <CustomSelect
              data={[{ username: "", name: "All" }, ...userList]}
              option_value={"username"}
              option_label={"name"}
              onChange={(e) => handleFilterChange("username", e.target.value)}
              value={filterValues?.username}
            />
          </div> */}
          <div className="flex-1">
            <p>Action</p>
            <CustomSelect
              data={[
                { username: "", name: "All" },
                ...Object.keys(LOG_ACTIONS)?.map((logItem) => {
                  return {
                    username: LOG_ACTIONS[logItem],
                    name: LOG_ACTIONS[logItem],
                  };
                }),
              ]}
              option_value={"username"}
              option_label={"name"}
              onChange={(e) => handleFilterChange("action", e.target.value)}
              value={filterValues?.action}
            />
          </div>
          <div className="flex-1">
            <p>From Date</p>
            <DatePicker
              dateFormat="dd-MM-YYYY"
              selected={startDate}
              onChange={(date) => {
                setStartDate(date);
                handleFilterChange(
                  "startDate",
                  moment(date).format("YYYY-MM-DD")
                );
              }}
            />
          </div>
          <div className="flex-1">
            <p>To Date</p>
            <DatePicker
              dateFormat="dd-MM-YYYY"
              selected={endDate}
              onChange={(date) => {
                setEndDate(date);
                handleFilterChange(
                  "endDate",
                  moment(date).format("YYYY-MM-DD")
                );
              }}
            />
          </div>
          <div className="pt-4">
            <PrimaryButton label="Search" onClick={fetchAuditLog} />
          </div>
        </div>
      </BlankCard>
      <BlankCard
      // header={<h4 className="box-title font-bold text-base">AUDIT LOG</h4>}
      >
        <div className="pt-3 w-full">
          <div
            className="relative overflow-x-auto mt-2 mb-2 custom-table-style"
            style={{ maxHeight: "50vh", overflowY: "auto" }}
          >
            <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Action</th>
                  <th scope="col">IP Address</th>
                  {/* <th scope="col">Role</th> */}
                  <th scope="col">Date</th>
                  <th scope="col" style={{ maxWidth: "250px" }}>
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogList?.map((report) => {
                  return (
                    <tr key={report?.id}>
                      <td>{`${report?.user_details?.name} (${report?.user_details?.name})`}</td>
                      <td>{report?.action}</td>
                      <td>{report?.system_ip}</td>
                      <td>
                        {moment(report?.created_at).format(
                          "DD-MM-YYYY hh:mm A"
                        )}
                      </td>
                      <td style={{ maxWidth: "250px" }}>
                        {report?.action_details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </BlankCard>
    </div>
  );
}
