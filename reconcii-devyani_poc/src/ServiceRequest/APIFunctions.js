import AxiosInstance from "../Utils/AxiosInstance";
export async function requestCallPost(
  apiName,
  data,
  additionalHeaders = {},
  topLevelConfig = {}
) {
  // Log the request details for debugging
  if (apiName?.includes("generate-excel") || apiName?.includes("generate-receivable-receipt-excel")) {
    console.log("[requestCallPost] ===== API REQUEST START =====");
    console.log("[requestCallPost] API Name:", apiName);
    console.log("[requestCallPost] Request Data:", JSON.stringify(data, null, 2));
    console.log("[requestCallPost] Data type:", typeof data);
    console.log("[requestCallPost] Data keys:", data ? Object.keys(data) : "No data");
    console.log("[requestCallPost] Data isEmpty:", !data || (typeof data === 'object' && Object.keys(data).length === 0));
  }
  
  let headers = {};
  if (localStorage.getItem("ReconciiToken")) {
    headers = {
      Authorization: "Bearer " + localStorage.getItem("ReconciiToken"),
    };
  }
  headers = { ...headers, ...additionalHeaders };
  
  if (apiName?.includes("generate-excel") || apiName?.includes("generate-receivable-receipt-excel")) {
    console.log("[requestCallPost] Request config:", {
      url: apiName,
      method: "POST",
      headers: headers,
      data: data
    });
  }
  
  return await AxiosInstance.post(apiName, data, {
    headers: headers,
    ...topLevelConfig,
  })
    .then((response) => {
      if (apiName?.includes("generate-excel") || apiName?.includes("generate-receivable-receipt-excel")) {
        console.log("[requestCallPost] ✅ Response received:", JSON.stringify(response.data, null, 2));
        console.log("[requestCallPost] ===== API REQUEST END (Success) =====");
      }
      return {
        status: true,
        message: "",
        data: response.data,
      };
    })
    .catch((err) => {
      if (apiName?.includes("generate-excel") || apiName?.includes("generate-receivable-receipt-excel")) {
        console.error("[requestCallPost] ❌ Error occurred:", err);
        console.error("[requestCallPost] Error response:", err?.response ? {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data
        } : "No response");
        console.log("[requestCallPost] ===== API REQUEST END (Error) =====");
      }
      console.log(err);
      return {
        status: false,
        message: err,
        data: null,
      };
    });
}

export async function requestCallPut(apiName, data) {
  return await AxiosInstance.put(apiName, data, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("ReconciiToken"),
    },
  })
    .then((response) => {
      return {
        status: true,
        message: "",
        data: response.data,
      };
    })
    .catch((err) => {
      return {
        status: false,
        message: err.toString(),
        data: null,
      };
    });
}

// API request call, get method
export async function requestCallGet(
  apiName,
  body,
  additionalHeaders = {},
  topLevelConfig = {}
) {
  let headers = {};
  if (localStorage.getItem("ReconciiToken")) {
    headers = {
      Authorization: "Bearer " + localStorage.getItem("ReconciiToken"),
    };
  }
  headers = { ...headers, ...additionalHeaders };
  return await AxiosInstance.get(apiName, {
    headers: headers,
    params: body,
    ...topLevelConfig,
  })
    .then((response) => {
      return {
        status: true,
        message: "",
        data: response.data,
        response: response,
      };
    })
    .catch((err) => {
      return {
        status: false,
        message: err,
        data: null,
      };
    });
}

export async function requestCallDelete(apiName, body) {
  return await AxiosInstance.delete(apiName, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("ReconciiToken"),
    },
    params: body,
  })
    .then((response) => {
      return {
        status: true,
        message: "",
        data: response.data,
      };
    })
    .catch((err) => {
      return {
        status: false,
        message: err,
        data: null,
      };
    });
}
