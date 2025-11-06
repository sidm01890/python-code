import { useEffect, useState } from "react";
import { apiEndpoints } from "../../../ServiceRequest/APIEndPoints";
import {
  requestCallGet,
  requestCallPost,
} from "../../../ServiceRequest/APIFunctions";
import { useLoader } from "../../../Utils/Loader";
import LOG_ACTIONS from "../../../Constants/LogAction";
import useMakeLogs from "../../../Hooks/useMakeLogs";

const BLANK_FILTERS = {
  client: "",
  type: "",
  tender: "",
  payment: "",
};

const CLIENT_OPTIONS = [
  { value: "devyani", label: "Devyani", disabled: false },
  { value: "bercos", label: "Bercos", disabled: false },
  { value: "subway", label: "Subway", disabled: true }, // Temporarily disabled
];

const BLANK_PAYMENT_TYPE = [{ type: "-Select Payment Type-", dataSource: "" }];

const useUploads = () => {
  const { setToastMessage, setLoading } = useLoader();
  const { makeLog } = useMakeLogs();
  const [dataSource, setDataSource] = useState([]);
  const [values, setValues] = useState(BLANK_FILTERS);
  const [paymentTypeList, setPaymentTypeList] = useState(BLANK_PAYMENT_TYPE);
  const [files, setFiles] = useState([]);

  const handleFileChange = (e) => {
    setFiles(e);
  };

  const handleChange = (name, value) => {
    if (name === "client") {
      // Reset all filters when client changes
      setValues({ ...BLANK_FILTERS, [name]: value });
      setPaymentTypeList(BLANK_PAYMENT_TYPE);
      return;
    }

    if (name === "type") {
      setValues({ ...values, [name]: value, tender: "", payment: "" });
      managePaymentTypeList(value);
      return;
    }

    if (name === "tender") {
      setValues({ ...values, [name]: value, payment: "" });
      managePaymentTypeList(value);
      return;
    }
    setValues({ ...values, [name]: value });
  };

  const managePaymentTypeList = (value) => {
    let activeTenders =
      dataSource?.filter((type) => type.category === values?.type)[0]
        ?.tenders || [];

    let activePaymentTypeList =
      activeTenders?.filter((tender) => tender.tender === value)[0]?.types ||
      [];
    setPaymentTypeList([...BLANK_PAYMENT_TYPE, ...activePaymentTypeList]);
  };

  useEffect(() => {
    fetchDataSource();
  }, []);

  const fetchDataSource = async () => {
    try {
      const response = await requestCallGet(
        apiEndpoints.NEW_DATA_SOURCE_FIELDS
      );
      if (response.status) {
        setDataSource(response.data?.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const onSubmit = async () => {
    try {
      if (values?.client === "") {
        setToastMessage({
          message: "Please select client.",
          type: "error",
        });
        return;
      }

      if (values?.payment === "") {
        setToastMessage({
          message: "Please select payment type.",
          type: "error",
        });
        return;
      }

      if (files?.length === 0) {
        setToastMessage({
          message: "Please select file.",
          type: "error",
        });
        return;
      }
      setLoading(true);
      const formData = new FormData();
      for (let i = 0; i < files?.length; i++) {
        formData.append("files", files[i]);
      }

      const customConfig = {
        langId: 1,
        Accept: "application/json",
        "Content-Type": "multipart/form-data",
      };

      const response = await requestCallPost(
        `${apiEndpoints.UPLOAD_FILE}?datasource=${values?.payment}&client=${values?.client}`,
        formData,
        customConfig
      );
      if (response.status) {
        makeLog(
          LOG_ACTIONS.UPLOAD,
          `Uploaded - ${values?.payment}`,
          `${apiEndpoints.UPLOAD_FILE}?datasource=${values?.payment}`,
          values
        );
        setValues(BLANK_FILTERS);
        setFiles([]);
        setToastMessage({
          message: "File uploaded successfully.",
          type: "success",
        });
      }
    } catch (error) {
      console.error(error);
      setToastMessage({
        message: error?.response?.data?.detail || "Upload failed. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchDataSource,
    dataSource,
    handleChange,
    values,
    paymentTypeList,
    handleFileChange,
    onSubmit,
    files,
    clientOptions: CLIENT_OPTIONS,
  };
};

export default useUploads;
