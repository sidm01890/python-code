import AxiosInstance from "../Utils/AxiosInstance";
export async function requestCallPost(
  apiName,
  data,
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
  return await AxiosInstance.post(apiName, data, {
    headers: headers,
    ...topLevelConfig,
  })
    .then((response) => {
      return {
        status: true,
        message: "",
        data: response.data,
      };
    })
    .catch((err) => {
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
