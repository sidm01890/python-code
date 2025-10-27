import axios from "axios";
import {
  baseURL,
  ssoBaseURL,
  sso,
  reconcii,
  reconciiBaseURL,
  reconciiAdminBaseURL,
  activityURL,
  nodePasswordUrls,
  reconciliationNodeURL,
} from "../ServiceRequest/APIEndPoints";
const instance = axios.create({
  baseURL: baseURL,
  responseType: "json",
  timeout: 60000,
  headers: {
    langId: 1,
    Accept: "application/json",
  },
});

export const handleError = ({ message, data, status }) => {
  return Promise.reject({ message, data, status });
};

// Intercept request to set dynamic baseURL
instance.interceptors.request.use((config) => {
  // If a specific baseURL is passed, use it; otherwise, default to the instance's baseURL
  if (config?.url?.includes(sso)) {
    config.baseURL = ssoBaseURL;
  }
  if (config?.url?.includes(reconcii)) {
    config.baseURL = reconciiBaseURL;
  }
  if (config?.url?.includes(activityURL)) {
    config.baseURL = reconciiAdminBaseURL;
  }
  if (config?.url?.includes(nodePasswordUrls)) {
    config.baseURL = reconciiAdminBaseURL;
  }
  if (config?.url?.includes(reconciliationNodeURL)) {
    config.baseURL = reconciiAdminBaseURL;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  ({ message, response: { data, status } }) => {
    return handleError({ message, data, status });
  }
);

export default instance;
