import React from "react";
import ReactDOM from "react-dom";

const ColumnMappingModal = ({ 
  isOpen, 
  onClose, 
  columnMappings = [], 
  tableName = null 
}) => {
  if (!isOpen) return null;

  const mappedCount = columnMappings.filter((col) => col.is_mapped).length;
  const unmappedCount = columnMappings.filter((col) => !col.is_mapped).length;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-4/5 max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <h2 className="text-2xl font-bold">Column Mapping Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {tableName && (
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <p className="text-sm">
              <span className="font-semibold">Target Table:</span> {tableName}
            </p>
          </div>
        )}

        <div className="mb-4 flex gap-4">
          <span className="text-sm">
            <span className="font-semibold text-green-600">Mapped:</span> {mappedCount}
          </span>
          <span className="text-sm">
            <span className="font-semibold text-red-600">Unmapped:</span> {unmappedCount}
          </span>
        </div>

        <div className="relative overflow-x-auto mb-4">
          <table className="w-full text-sm text-left text-gray-500 border-collapse">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-4 py-3 border border-gray-300">
                  Excel Column Name
                </th>
                <th scope="col" className="px-4 py-3 border border-gray-300">
                  System Column Name
                </th>
                <th scope="col" className="px-4 py-3 border border-gray-300">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {columnMappings.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-4 py-4 text-center text-gray-500">
                    No columns found
                  </td>
                </tr>
              ) : (
                columnMappings.map((mapping, index) => (
                  <tr
                    key={index}
                    className={`bg-white border-b ${
                      mapping.is_mapped ? "hover:bg-green-50" : "hover:bg-red-50"
                    }`}
                  >
                    <td className="px-4 py-3 border border-gray-300 font-medium">
                      {mapping.excel_column}
                    </td>
                    <td className="px-4 py-3 border border-gray-300">
                      {mapping.system_column || "(No match found)"}
                    </td>
                    <td className="px-4 py-3 border border-gray-300">
                      {mapping.is_mapped ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Mapped
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ✗ Unmapped
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {unmappedCount > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">Warning:</span> {unmappedCount} column(s) could not be
              automatically mapped. These columns may not be processed during upload.
            </p>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close & Continue
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ColumnMappingModal;

