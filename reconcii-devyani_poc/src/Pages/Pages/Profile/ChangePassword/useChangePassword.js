import { useState } from "react";
import { requestCallPost } from "../../../../ServiceRequest/APIFunctions";
import { isValidPassword } from "../../../../Utils/UtilityFunctions";
import { apiEndpoints } from "../../../../ServiceRequest/APIEndPoints";
import { useLoader } from "../../../../Utils/Loader";
import useMakeLogs from "../../../../Hooks/useMakeLogs";
import LOG_ACTIONS from "../../../../Constants/LogAction";

const BLANK_CHANGE_PASSWORD = {
  confirmPassword: "",
  currentPassword: "",
  newPassword: "",
};

const useChangePassword = () => {
  const { makeLog } = useMakeLogs();
  const { setLoading, setToastMessage } = useLoader();
  const [changePasswordParams, setChangePasswordParams] = useState(
    BLANK_CHANGE_PASSWORD
  );
  const [changePasswordParamsError, setChangePasswordParamsError] =
    useState(null);

  const handleChangePassword = (name, value) => {
    if (changePasswordParamsError !== null) {
      setChangePasswordParamsError(null);
    }
    setChangePasswordParams({ ...changePasswordParams, [name]: value });
  };

  const onSubmit = async () => {
    try {
      if (changePasswordParams.currentPassword?.trim() === "") {
        setChangePasswordParamsError({
          currentPassword: "Please enter your current password.",
        });
        return;
      } else if (!isValidPassword(changePasswordParams.newPassword)) {
        setChangePasswordParamsError({
          newPassword:
            "Your password must be 8 character, with at least 1 special character, 1 number and 1 capital letter.",
        });
        return;
      } else if (
        changePasswordParams.confirmPassword !==
        changePasswordParams.newPassword
      ) {
        setChangePasswordParamsError({
          confirmPassword: "Password not matched.",
        });
        return;
      }
      setLoading(true);
      const response = await requestCallPost(
        apiEndpoints.CHANGE_PASSWORD,
        changePasswordParams
      );
      setLoading(false);
      if (response.status) {
        makeLog(
          LOG_ACTIONS.CHANGE_PASSWORD,
          "Change Password",
          apiEndpoints.CHANGE_PASSWORD
        );
        setToastMessage({
          message: "Password reset successfully.",
          type: "success",
        });
        return;
      }
      setChangePasswordParamsError({
        currentPassword: "Incorrect old password.",
      });
    } catch (error) {
      setToastMessage({ message: "Something went wrong.", type: "error" });
    }
  };

  return {
    changePasswordParams,
    changePasswordParamsError,
    handleChangePassword,
    onSubmit,
  };
};

export default useChangePassword;
