import React, { useState, useEffect, useRef } from "react";
import UserDropdown from "./UserDropdown"; // Import the UserDropdown component
import { getFirstCharacter } from "../../Utils/UtilityFunctions";
import CustomToggle from "./CustomToggle";
import { useSelector } from "react-redux";
const Navbar = () => {
  const dropdownRef = useRef(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // State for the dropdown
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  let userDetailedProfile = useSelector(
    (state) => state.CommonService.userDetailedProfile
  );
  useEffect(() => {
    // Set the theme on initial load
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    // Function to handle clicks outside the dropdown
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false); // Close the dropdown if clicked outside
      }
    };

    // Add event listener to detect clicks
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const toggleDropdown = () => setIsDropdownOpen((prevState) => !prevState);

  return (
    <>
      <header
        className="flex items-center px-8 py-4 justify-end"
        style={{ backgroundColor: "#f5f5f5" }}
      >
        {/* <CustomToggle
          label={"Dark Theme"}
          checked={theme === "dark"}
          setChecked={(val) => setTheme(val ? "dark" : "light")}
        /> */}
        <div className="relative ml-10">
          <button
            onClick={toggleDropdown}
            className="text-gray-800 rounded-full w-10 h-10 flex items-center justify-center bg-gray-300 font-bold text-lg"
          >
            {getFirstCharacter(userDetailedProfile?.name)}
          </button>
          {isDropdownOpen && (
            <div ref={dropdownRef}>
              <UserDropdown />
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Navbar;
