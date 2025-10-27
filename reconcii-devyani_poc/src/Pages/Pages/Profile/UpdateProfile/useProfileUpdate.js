import { useEffect, useState } from "react";
import {
  requestCallPost,
  requestCallPut,
} from "../../../../ServiceRequest/APIFunctions";
import {
  isValidPassword,
  validateMobile,
} from "../../../../Utils/UtilityFunctions";
import { apiEndpoints } from "../../../../ServiceRequest/APIEndPoints";
import { useSelector } from "react-redux";
import useAuth from "../../../Auth/useAuth";
import { useLoader } from "../../../../Utils/Loader";
import useMakeLogs from "../../../../Hooks/useMakeLogs";
import LOG_ACTIONS from "../../../../Constants/LogAction";

const useProfileUpdate = () => {
  const { setLoading, setToastMessage } = useLoader();
  const { fetchProfile } = useAuth();
  const { makeLog } = useMakeLogs();
  let userDetailedProfile = useSelector(
    (state) => state.CommonService.userDetailedProfile
  );
  const [profileUpdateParams, setProfileUpdateParams] =
    useState(userDetailedProfile);
  const [profileUpdateParamsError, setProfileUpdateParamsError] =
    useState(null);

  useEffect(() => {
    setProfileUpdateParams(userDetailedProfile);
  }, []);

  const handleProfileUpdate = (name, value) => {
    if (profileUpdateParamsError !== null) {
      setProfileUpdateParamsError(null);
    }
    setProfileUpdateParams({ ...profileUpdateParams, [name]: value });
  };

  const onSubmit = async () => {
    try {
      if (profileUpdateParams.name?.trim() === "") {
        setProfileUpdateParamsError({
          name: "Name cannot be blank.",
        });
        return;
      } else if (!validateMobile(profileUpdateParams.mobile)) {
        setProfileUpdateParamsError({
          mobile: "Please enter a valid mobile number.",
        });
        return;
      }
      setLoading(true);
      const response = await requestCallPut(
        apiEndpoints.PROFILE,
        profileUpdateParams
      );
      setLoading(false);
      if (response.status) {
        makeLog(
          LOG_ACTIONS.PROFILE_UPDATE,
          "Profile Update",
          apiEndpoints.PROFILE,
          {
            name: profileUpdateParams.name,
            email: profileUpdateParams.email,
            mobile: profileUpdateParams.mobile,
          }
        );
        setToastMessage({
          message: "Profile details successfully updated!",
          type: "success",
        });
        fetchProfile();
        return;
      }
      setProfileUpdateParamsError({
        currentPassword: "Incorrect old password.",
      });
    } catch (error) {
      setProfileUpdateParamsError({
        currentPassword: "Something went wrong.",
      });
    }
  };

  return {
    profileUpdateParams,
    profileUpdateParamsError,
    handleProfileUpdate,
    onSubmit,
  };
};

export default useProfileUpdate;
