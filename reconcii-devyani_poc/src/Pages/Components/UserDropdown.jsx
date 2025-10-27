import React from "react";
import { getFirstCharacter } from "../../Utils/UtilityFunctions";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import useMakeLogs from "../../Hooks/useMakeLogs";
import LOG_ACTIONS from "../../Constants/LogAction";

const UserDropdown = () => {
  const navigate = useNavigate();
  const { makeLog } = useMakeLogs();
  let userDetailedProfile = useSelector(
    (state) => state.CommonService.userDetailedProfile
  );
  const logoutMeOut = async () => {
    await makeLog(LOG_ACTIONS.LOGOUT, "Logout", "logout");
    localStorage.clear();
    navigate("/");
  };

  const dropDownClicked = (type) => {
    if (type === "changePassword") {
      navigate("/change-password");
    } else if (type === "updateProfile") {
      navigate("/update-profile");
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-56 rounded-md py-1 z-50 navbar-dropdown">
      <div className="px-4 py-3">
        <div className="flex flex-col justify-center align-center">
          <p className="text-lg text-center mb-1">
            {userDetailedProfile?.name}
          </p>
          <p className="text-xs text-center">{userDetailedProfile?.roleName}</p>
        </div>
      </div>
      <div className="border-t border-gray-200">
        <button
          className="w-full text-left px-4 py-2 flex justify-start"
          onClick={() => dropDownClicked("updateProfile")}
        >
          <span className="material-icons-outlined text-gray-500 mr-2">
            settings
          </span>
          Manage account
        </button>
        <button
          className="w-full text-left px-4 py-2 flex justify-start"
          onClick={() => dropDownClicked("changePassword")}
        >
          <span className="material-icons-outlined text-gray-500 mr-2">
            password
          </span>
          Change Password
        </button>
        <button
          className="w-full text-left px-4 py-2 flex justify-start"
          onClick={logoutMeOut}
        >
          <span className="material-icons-outlined text-gray-500 mr-2">
            logout
          </span>
          Sign out
        </button>
      </div>
      {/* <div className="border-t border-gray-200 px-4 py-2 text-sm text-gray-500">
                Secured by <span className="font-semibold">clerk</span>
            </div> */}
    </div>
  );
};

export default UserDropdown;
