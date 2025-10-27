import React, { useEffect, useRef, useState } from "react";
import Select from "react-select";
import BlankCard from "../../components/BlankCard";
import DateRangeComponent from "../../components/DateRange";
import { requestCallGet, requestCallPost } from "../../ServiceRequest/APIFunctions";
import { apiEndpoints } from "../../ServiceRequest/APIEndPoints";
import { useDispatch, useSelector } from "react-redux";
import { setTypesData } from "../../Redux/Slices/Reconciliation";
import { dateFormatChangerView, } from "../../Utils/UtilityFunctions";
import PrimaryButton from "../../components/PrimaryButton";
import { toast } from "react-toastify";

export default function Uploads() {
  let { types } = useSelector((state) => state.ReconciliationService);

  let dispatch = useDispatch();

  let [reportTypes, setReportTypes] = useState([]);
  let [files, setFiles] = useState([]);
  let [fileError, setFileError] = useState(false);
  let [dates, setDates] = useState({start: new Date(), end: new Date()});
  const inputFile = useRef(null);
  let [isDataUploading, setIsDataUploading] = useState(false);


  useEffect(() => {
    requestCallGet(apiEndpoints.DATA_SOURCE_FIELD)
      .then((response) => {
        if (response.status) {
          dispatch(setTypesData(response.data));
          let data = response.data.map((item, index) => {
            let tender = item?.tenders.map((tenderItem, tIndex) => {
              let payment = tenderItem?.types.map((paymentItem, pIndex) => {
                return { ...paymentItem, value: paymentItem?.dataSource, label: paymentItem?.type, isSelected: pIndex === 0 };
              });
              return {
                ...tenderItem,
                types: payment,
                value: tenderItem?.tender, label: tenderItem?.tender,
                isSelected: tIndex === 0,
              };
            });
            return {
              ...item,
              tenders: tender,
              isSelected: index === 0,
              value: item?.category,
              label: item?.category,
            };
          });
          setReportTypes(data);
        }
      })
      .catch((error) => {});
  }, []);

  const onFileChange = (event) => {
    event.target?.files[0] ? setFileError(false) : null;
    setFiles(event.target?.files);
  };

  const onDateChanged = (date) => {
    setDates({start: date[0], end: date[1]})
  }

  const onTypeChanged = (item) => {
    let data = reportTypes.map((type) => {
        return {...type, isSelected: item?.value === type?.value}
    })
    setReportTypes(data);
  };

  const onTenderChange = (item) => {    
    let data = reportTypes.map((type) => {
        if (type.isSelected) {
            let tenderData = type.tenders.map((tender) => {
                return {...tender, isSelected: item?.value === tender?.value};
            })
            return {...type, tenders: tenderData};
        } else {
            return type;
        }
    })    
    setReportTypes(data);
  };

  const onPaymentChange = (item) => {    
    let data = reportTypes.map((type) => {
        if (type.isSelected) {
            let tenderData = type.tenders.map((tender) => {
                if (tender.isSelected) {
                    let typeData = tender?.types.map((typeItem) => {
                        return {...typeItem, isSelected: item?.value === typeItem?.value};
                    })
                    return {...tender, types: typeData};
                } else {
                    return tender;
                }
            })
            return {...type, tenders: tenderData};
        } else {
            return type;
        }
    })    
    setReportTypes(data);
  };

  const onSubmit = async () => {

    if (files.length === 0) {
        setFileError(true);
        return;
    }

    let payment = reportTypes.filter((item) => item?.isSelected)[0]?.tenders.filter((item) => item?.isSelected)[0]?.types.filter((item) => item?.isSelected)
    

    const formData = new FormData();
    for (let i = 0; i < files?.length; i++) {
      formData.append("files", files[i]);
    }
    formData.append("datSource", payment[0] ? payment[0]?.dataSource : '');
    formData.append("businessDate", dateFormatChangerView(dates.start));
    formData.append("endDate", dateFormatChangerView(dates.end));

    const promiseData = () =>
      new Promise((resolve, reject) => {
        setIsDataUploading(true);
        requestCallPost(apiEndpoints.UPLOAD_SOURCE_FIELD, formData).then(
          (response) => {
            if (response.status) {
              resolve(response.data?.data);
            } else {
              reject(response.message?.message);
            }
          }
        ).finally(() => {
          setIsDataUploading(false);
          setFiles([]);
          if (inputFile.current) {
            inputFile.current.value = "";
        }
        })
      });
    toast.promise(promiseData, {
      pending: "Uploading data...",
      success: {
        render({ data }) {
          return data;
        },
      },
      error: {
        render({ data }) {
          return data;
        },
      },
    });



    

  }

  return (
    <div className="">
      <BlankCard
        body={
          <div className="pl-6 float-start">
            <div className="flex items-center">
              <div className="w-40">
                <h1>Type</h1>
              </div>
              <div className="w-60">
                <Select
                  style={{ width: "100%" }}
                  menuPortalTarget={document.body}
                  isSearchable={false}
                  value={reportTypes.filter((item) => item?.isSelected)}
                  onChange={onTypeChanged}
                  options={reportTypes}
                />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <div className="w-40">
                <h1>Date</h1>
              </div>
              <div className="w-60 rounded-md border-1 border-gray-300">
                <DateRangeComponent startDate={dates.start} endDate={dates.end} onDateChange={onDateChanged}/>
              </div>
            </div>
            <div className="flex items-center mt-4">
              <div className="w-40">
                <h1>Tender</h1>
              </div>
              <div className="w-60">
                <Select
                  style={{ width: "100%" }}
                  menuPortalTarget={document.body}
                  isSearchable={false}
                  options={reportTypes.filter((item) => item?.isSelected)[0]?.tenders}
                  value={reportTypes.filter((item) => item?.isSelected)[0]?.tenders.filter((item) => item?.isSelected)}
                  onChange={onTenderChange}
                />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <div className="w-40">
                <h1>Payment</h1>
              </div>
              <div className="w-60">
                <Select
                  style={{ width: "100%" }}
                  menuPortalTarget={document.body}
                  isSearchable={false}
                  options={reportTypes.filter((item) => item?.isSelected)[0]?.tenders.filter((item) => item?.isSelected)[0]?.types}
                  value={reportTypes.filter((item) => item?.isSelected)[0]?.tenders.filter((item) => item?.isSelected)[0]?.types.filter((item) => item?.isSelected)}
                  onChange={onPaymentChange}
                />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <div className="w-40">
                <h1>Upload File</h1>
              </div>
              <div className="w-60">
                <input
                  className="hover:cursor-pointer"
                  ref={inputFile}
                  type="file"
                  onChange={onFileChange}
                  multiple
                />
              </div>
            </div>
            {fileError ? <label className="ml-40 text-red-500">File attachment is required</label> : null}
            <div className=" mt-4 ml-40">
              <PrimaryButton label={"Submit"} disabled={isDataUploading} onClick={onSubmit}/>
            </div>
          </div>
        }
      />
    </div>
  );
}
