import React, { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";
import "./Utils/Theme.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import Pages from "./Pages";
import Login from "./Pages/Auth/Login";
import ForgotPassword from "./Pages/Auth/ForgotPassword";
import ResetPassword from "./Pages/Auth/ResetPassword";
import { useDispatch } from "react-redux";
import { setUserDetailedProfile, setUserProfile } from "./Redux/Slices/Common";
import { LoaderProvider } from "./Utils/Loader";
function MainNavigator() {
  const dispatch = useDispatch();
  useEffect(() => {
    let userProfileStr = localStorage.getItem("userProfile");

    if (userProfileStr) {
      try {
        let userProfile = JSON.parse(userProfileStr);
        dispatch(setUserProfile(userProfile));
      } catch (e) {
        console.log("Parsing failed");
      }
    }
    let userDetailedProfileStr = localStorage.getItem("userDetailedProfile");
    if (userDetailedProfileStr) {
      try {
        let userDetailedProfile = JSON.parse(userDetailedProfileStr);
        dispatch(setUserDetailedProfile(userDetailedProfile));
      } catch (e) {
        console.log("Parsing failed");
      }
    }
  });

  return (
    <Router>
      <LoaderProvider>
        <Routes>
          <Route exact path="/" element={<Login />} />
          <Route exact path="/forgot-password" element={<ForgotPassword />} />
          <Route exact path="/reset-password" element={<ResetPassword />} />
          <Route exact path="/*" element={<Pages />} />
        </Routes>
      </LoaderProvider>
    </Router>
  );
}

export default MainNavigator;
// export default App;
