import moment from "moment";
import React from "react";
import ReactDOM from "react-dom";

const ReconciliationDateModal = ({ closeModal, lastSyncList = [] }) => {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-1/3">
        <div className="pt-3 w-full">
          <div className="flex justify-between">
            <p className="text-black-600">LAST SYNC DATES</p>
            <button onClick={closeModal} className="text-gray-700">
              <span className="material-icons-outlined mr-2">close</span>
            </button>
          </div>
          <div className="relative overflow-x-auto mt-2 mb-2">
            <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    Tender (Type)
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {lastSyncList?.map((report) => {
                  return (
                    <tr
                      key={report?.dataSource}
                      className="bg-white border-b dark:bg-gray-800 dark:border-gray-700"
                    >
                      <td className="px-6 py-4">{`${report?.tender}(${report?.type})`}</td>
                      <td className="px-6 py-4" style={{ width: "150px" }}>
                        {moment(report?.lastSynced, "DD-MM-YYYY").format(
                          "DD MMM, YYYY"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.getElementById("portal-root")
  );
};

export default ReconciliationDateModal;
