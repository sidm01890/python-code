import { useSelector } from "react-redux";
import { apiEndpoints } from "../ServiceRequest/APIEndPoints";
import { requestCallPost } from "../ServiceRequest/APIFunctions";

const useMakeLogs = () => {
  const makeLog = async (
    action,
    action_details,
    url,
    reqData = {},
    resData = {},
    profileData = {}
  ) => {
    let profileDetail = {};
    try {
      let profileStr = localStorage.getItem("userDetailedProfile");
      profileDetail = JSON.parse(profileStr);
    } catch (e) {
      console.error(e);
    }
    // Fallback to userProfile saved from login response
    if (!profileDetail || !profileDetail.username) {
      try {
        const userStr = localStorage.getItem("userProfile");
        const user = JSON.parse(userStr || "{}");
        profileDetail = { ...profileDetail, ...user };
      } catch (e) {}
    }

    let reqParams = {
      username: profileData?.username || profileDetail?.username || "unknown",
      user_email: profileData?.email || profileDetail?.email,
      role: "User",
      action: action,
      action_details: action_details,
      request: JSON.stringify(reqData),
      remarks: url,
    };
    try {
      await requestCallPost(apiEndpoints.ACTIVITY_CREATE, reqParams);
    } catch (error) {
      console.error(error);
    }
  };

  return { makeLog };
};

export default useMakeLogs;
