import React from "react";
import "./Auth.css";
import CustomInput from "../../components/CustomInput";
import useAuth from "./useAuth";
import Alert from "../../components/Alert";
import AuthLogo from "./AuthLogo";
import { useNavigate } from "react-router-dom";
import bgImage from "../../assets/Images/login_bg.jpg";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const {
    forgotPasswordParams,
    forgotPasswordErrors,
    handleForgotPasswordParamsChanges,
    doForgotPassword,
    activeStep,
  } = useAuth();

  const pageTitle = () => {
    if (activeStep === 1) {
      return "FORGOT PASSWORD";
    } else if (activeStep === 2) {
      return "VERIFY OTP";
    } else if (activeStep === 3) {
      return "RESET PASSWORD";
    }
  };

  const pageSubTitle = () => {
    if (activeStep === 1) {
      return "Please enter your registered username & email";
    } else if (activeStep === 2) {
      return "Please enter OTP";
    } else if (activeStep === 3) {
      return "Please enter new password";
    }
  };

  const actionButtonText = () => {
    if (activeStep === 1) {
      return "SUBMIT";
    } else if (activeStep === 2) {
      return "VERIFY";
    } else if (activeStep === 3) {
      return "SUBMIT";
    }
  };

  return (
    <div>
      <div
        className="login-container"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="login-box">
          <p className="text-xl text-black mb-2">{pageTitle()}</p>
          <p className="text-sm text-black mb-4">{pageSubTitle()}</p>
          {forgotPasswordErrors?.status?.type && (
            <Alert
              type={forgotPasswordErrors?.status?.type}
              message={forgotPasswordErrors?.status?.message}
            />
          )}
          {activeStep === 1 && (
            <>
              <CustomInput
                type="email"
                placeholder="Username"
                value={forgotPasswordParams?.username}
                onChange={(e) =>
                  handleForgotPasswordParamsChanges("username", e.target.value)
                }
                error={forgotPasswordErrors?.username}
              />
              <CustomInput
                type="email"
                placeholder="Email"
                value={forgotPasswordParams?.email}
                onChange={(e) =>
                  handleForgotPasswordParamsChanges("email", e.target.value)
                }
                error={forgotPasswordErrors?.email}
              />
            </>
          )}
          {activeStep === 2 && (
            <>
              <CustomInput
                type="email"
                placeholder="OTP"
                value={forgotPasswordParams?.otp}
                onChange={(e) =>
                  handleForgotPasswordParamsChanges("otp", e.target.value)
                }
                error={forgotPasswordErrors?.otp}
                maxLength={6}
                additionalInputStyle={{
                  letterSpacing: "5px",
                  textAlign: "center",
                }}
              />
            </>
          )}
          {activeStep === 3 && (
            <>
              <CustomInput
                type="email"
                placeholder="New Password"
                value={forgotPasswordParams?.newPassword}
                onChange={(e) =>
                  handleForgotPasswordParamsChanges(
                    "newPassword",
                    e.target.value
                  )
                }
                error={forgotPasswordErrors?.newPassword}
              />
              <CustomInput
                type="email"
                placeholder="Confirm Password"
                value={forgotPasswordParams?.confirmPassword}
                onChange={(e) =>
                  handleForgotPasswordParamsChanges(
                    "confirmPassword",
                    e.target.value
                  )
                }
                error={forgotPasswordErrors?.confirmPassword}
              />
            </>
          )}
          <button
            type="button"
            className="login-button mb-2"
            onClick={doForgotPassword}
          >
            {actionButtonText()}
          </button>
          {activeStep === 2 && (
            <div className="flex justify-center mb-2 mt-2">
              <p style={{ fontSize: "14px" }}>
                No OTP received?{" "}
                <a
                  style={{ color: "#0000ff" }}
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    doForgotPassword(true);
                  }}
                >
                  Resend
                </a>
              </p>
            </div>
          )}

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
            className="forgot-password"
          >
            Login
          </a>
        </div>
      </div>
      <AuthLogo />
    </div>
  );
};

export default ForgotPassword;
