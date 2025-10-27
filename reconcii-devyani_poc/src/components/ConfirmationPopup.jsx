import React from "react";

const ConfirmationPopup = (props) => {
  return (
    <div
      id="modal"
      className={"fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"+ (props.visible ? '': ' hidden') }
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <h2 className="text-xl font-bold">Confirm?</h2>
        </div>
        <div className="mb-4">
          <p>Are you sure to remove this record?</p>
        </div>
        <div className="flex justify-end">
          <button
            id="closeModalBtn2"
            className="bg-gray-500 text-white px-4 py-2 rounded mr-2"
            onClick={props.onCancel}
          >
            CANCEL
          </button>
          <button onClick={props.onConfirm} className="bg-red-400 text-white px-4 py-2 rounded">
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPopup
