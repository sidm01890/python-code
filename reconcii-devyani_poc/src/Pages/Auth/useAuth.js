import React, { useState } from "react";
import { apiEndpoints } from "../../ServiceRequest/APIEndPoints";
import {
  requestCallGet,
  requestCallPost,
} from "../../ServiceRequest/APIFunctions";
import {
  generateDeviceCode,
  isValidPassword,
  validateOnlyDigits,
} from "../../Utils/UtilityFunctions";
import { useDispatch } from "react-redux";
import {
  setUserDetailedProfile,
  setUserProfile,
} from "../../Redux/Slices/Common";
import { useNavigate } from "react-router-dom";
import { useLoader } from "../../Utils/Loader";
import useMakeLogs from "../../Hooks/useMakeLogs";
import LOG_ACTIONS from "../../Constants/LogAction";
const BLANK_LOGIN = {
  username: "",
  password: "",
};

const FORGOT_PASSWORD = {
  email: "",
  username: "",
  resend: false,
  otp: "",
  newPassword: "",
  confirmPassword: "",
};

const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { setLoading, setToastMessage } = useLoader();
  const [loginParams, setLoginParams] = useState(BLANK_LOGIN);
  const [loginErrors, setLoginErrors] = useState(null);
  const { makeLog } = useMakeLogs();
  const [activeStep, setActiveStep] = useState(1);
  const [forgotPasswordParams, setForgotPasswordParams] =
    useState(FORGOT_PASSWORD);
  const [forgotPasswordErrors, setForgotPasswordErrors] = useState(null);

  const handleLoginParamsChanges = (name, value) => {
    if (loginErrors !== null) {
      setLoginErrors(null);
    }
    setLoginParams({ ...loginParams, [name]: value });
  };

  const handleForgotPasswordParamsChanges = (name, value) => {
    if (name === "otp" && value !== "") {
      if (!validateOnlyDigits(value)) {
        return;
      }
    }
    if (forgotPasswordErrors !== null) {
      setForgotPasswordErrors(null);
    }
    setForgotPasswordParams({ ...forgotPasswordParams, [name]: value });
  };

  const doLogin = async () => {
    try {
      if (loginParams.username?.trim() === "") {
        setLoginErrors({ username: "Please enter your email address." });
        return;
      } else if (loginParams.password?.trim() === "") {
        setLoginErrors({ password: "Please enter your password." });
        return;
      }
      setLoading(true);
      let deviceId = generateDeviceCode();
      let additionalHeaders = {
        deviceId: deviceId,
        Authorization: "",
      };
      // const response = await requestCallGet(apiEndpoints.ACCESS_CORS);
      const response = await requestCallPost(
        apiEndpoints.ACCESS_TOKEN,
        loginParams,
        additionalHeaders
      );
      setLoading(false);
      if (response.status) {
        let allowedModules = [];
        let allowedPermission = [];
        const decodedToken = decodeJWT(response.data?.data?.access_token);
        let userDetails = {};
        try {
          userDetails = JSON.parse(decodedToken?.USER_DETAILS);
          console.log("userDetails?.modules", userDetails?.modules);
          userDetails?.modules?.forEach((module) => {
            if (module?.permissions?.length > 0) {
              allowedPermission?.push(module?.permissions[0]?.permission_code);
            }
            allowedModules.push(module?.id);
          });
          allowedModules = [...new Set(allowedModules)];
        } catch (e) {
          //Error in decoding
          console.error(e);
        }

        localStorage.setItem("allowedModules", JSON.stringify(allowedModules));
        localStorage.setItem(
          "allowedPermission",
          JSON.stringify(allowedPermission)
        );

        localStorage.setItem(
          "ReconciiToken",
          response.data?.data?.access_token
        );
        localStorage.setItem(
          "ReconciiRefreshToken",
          response.data?.data?.refresh_token
        );
        localStorage.setItem(
          "userProfile",
          JSON.stringify(response.data?.data)
        );
        dispatch(setUserProfile(response.data?.data));
        makeLog(
          LOG_ACTIONS.LOGIN,
          "Login",
          apiEndpoints.ACCESS_TOKEN,
          {
            username: loginParams.username,
          },
          {},
          userDetails
        );
        fetchProfile();
        navigate("/dashboard");
        return;
      }
      setToastMessage({ message: "Invalid credentials!", type: "error" });
    } catch (error) {
      console.log(error);
      setToastMessage({ message: "Something went wrong!", type: "error" });
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await requestCallGet(apiEndpoints.PROFILE);
      if (response.status) {
        dispatch(setUserDetailedProfile(response?.data?.data));
        localStorage.setItem(
          "userDetailedProfile",
          JSON.stringify(response.data?.data)
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const decodeJWT = (token) => {
    const base64Url = token.split(".")[1]; // Extract payload
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/"); // Format it for decoding
    return JSON.parse(atob(base64)); // Decode base64 and parse JSON
  };

  const doForgotPassword = async (resend) => {
    try {
      let url = "";
      let requestBody = {};

      if (activeStep === 1) {
        if (forgotPasswordParams.email?.trim() === "") {
          setForgotPasswordErrors({
            email: "Please enter your registered email address.",
          });
          return;
        } else if (forgotPasswordParams.username?.trim() === "") {
          setForgotPasswordErrors({ username: "Please enter your username." });
          return;
        }

        url = apiEndpoints.FORGOT_PASSWORD;
        requestBody = {
          email: forgotPasswordParams.email,
          username: forgotPasswordParams.username,
        };
      } else if (activeStep === 2) {
        if (forgotPasswordParams.otp?.length < 6) {
          setForgotPasswordErrors({
            otp: "Please enter valid OTP.",
          });
          return;
        }

        url = apiEndpoints.VERIFY_OTP;
        if (resend === true) {
          console.log("resend", resend);
          url = apiEndpoints.FORGOT_PASSWORD;
          requestBody = {
            email: forgotPasswordParams.email,
            username: forgotPasswordParams.username,
            resend: true,
          };
        } else {
          requestBody = {
            email: forgotPasswordParams.email,
            username: forgotPasswordParams.username,
            otp: forgotPasswordParams.otp,
          };
        }
      } else if (activeStep === 3) {
        if (!isValidPassword(forgotPasswordParams?.newPassword)) {
          setForgotPasswordErrors({
            newPassword:
              "Your password must be 8 character, with at least 1 special character, 1 number and 1 capital letter.",
          });
          return;
        } else if (
          forgotPasswordParams?.newPassword !==
          forgotPasswordParams?.confirmPassword
        ) {
          setForgotPasswordErrors({
            confirmPassword: "Password not matched",
          });
          return;
        }

        url = apiEndpoints.RESET_PASSWORD;
        requestBody = {
          email: forgotPasswordParams.email,
          username: forgotPasswordParams.username,
          newPassword: forgotPasswordParams.newPassword,
        };
      }
      setLoading(true);

      const response = await requestCallPost(url, requestBody);
      setLoading(false);
      if (response.status) {
        if (activeStep === 1) {
          setForgotPasswordErrors({
            status: {
              type: "success",
              message: response?.data?.message,
            },
          });
          setActiveStep(2);
          setTimeout(() => {
            setForgotPasswordErrors(null);
          }, 3000);

          return;
        } else if (activeStep === 2) {
          setForgotPasswordErrors({
            status: {
              type: "success",
              message: response?.data?.message,
            },
          });
          if (resend === true) {
            setForgotPasswordParams({ ...forgotPasswordParams, otp: "" });
          }
          setActiveStep(resend === true ? 2 : 3);
          setTimeout(() => {
            setForgotPasswordErrors(null);
          }, 5000);
          return;
        } else if (activeStep === 3) {
          setToastMessage({
            message: "Password reset successfully! Please login to continue.",
            type: "success",
          });
          navigate("/");
          return;
        }

        // makeLog(
        //   "forgot_password",
        //   "Forgot Password",
        //   apiEndpoints.FORGOT_PASSWORD,
        //   "java",
        //   forgotPasswordParams
        // );
        navigate("/");
        return;
      }

      setForgotPasswordErrors({
        status: {
          type: "error",
          message: response?.message?.data?.message,
        },
      });

      setTimeout(() => {
        setForgotPasswordErrors(null);
      }, 3000);
    } catch (error) {
      console.log(error);
      setToastMessage({ message: "Something went wrong!", type: "error" });
    }
  };

  return {
    loginParams,
    loginErrors,
    handleLoginParamsChanges,
    doLogin,
    fetchProfile,
    forgotPasswordParams,
    forgotPasswordErrors,
    handleForgotPasswordParamsChanges,
    doForgotPassword,
    activeStep,
  };
};

export default useAuth;
