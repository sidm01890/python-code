import React from "react";
import "./Auth.css";
import CustomInput from "../../components/CustomInput";
import useAuth from "./useAuth";
import Alert from "../../components/Alert";
import { useNavigate } from "react-router-dom";
import AuthLogo from "./AuthLogo";
import bgImage from "../../assets/Images/login_bg.jpg";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { loginParams, loginErrors, handleLoginParamsChanges, doLogin } =
    useAuth();

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
          <p className="text-xl text-black mb-2">RESET PASSWORD</p>
          <p className="text-sm text-black mb-4">
            Please log in to your account
          </p>
          {loginErrors?.status && (
            <Alert type="error" message={loginErrors?.status} />
          )}
          <CustomInput
            type="password"
            name={"password"}
            placeholder="New Password"
            value={loginParams?.password}
            onChange={(e) =>
              handleLoginParamsChanges("password", e.target.value)
            }
            error={loginErrors?.password}
          />
          <CustomInput
            type="password"
            name={"password"}
            placeholder="Confirm Password"
            value={loginParams?.password}
            onChange={(e) =>
              handleLoginParamsChanges("password", e.target.value)
            }
            error={loginErrors?.password}
          />
          <button type="submit" className="login-button mb-2" onClick={doLogin}>
            UPDATE
          </button>
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

export default ResetPassword;
