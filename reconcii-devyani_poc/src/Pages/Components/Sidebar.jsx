import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import ImgConst from "../../Utils/ImgConstants";
import ReconciiLogo from "../../assets/Images/ReconcillLogo.png";
const MANAGER_SIDEBAR = [
  {
    id: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
    icon: "dashboard",
    db_id: 3,
  },
  {
    id: "reconciliations",
    label: "Reconciliations",
    route: "/reconciliations",
    icon: "currency_exchange",
    db_id: 4,
  },
  // {
  //   id: "vouchers",
  //   label: "Vouchers",
  //   route: "/vouchers",
  //   icon: "confirmation_number",
  //   db_id: 5,
  // },
  {
    id: "reports",
    label: "Reports",
    route: "/reports",
    icon: "report",
    db_id: 10,
  },
  {
    id: "uploads",
    label: "Uploads",
    route: "/uploads",
    icon: "upload_file",
    db_id: 9,
  },
  {
    id: "excel-db-mapping",
    label: "Excel-DB Mapping",
    route: "/excel-db-mapping",
    icon: "handshake",
    db_id: 2,
  },
  {
    id: "definelogic",
    label: "Define Logic",
    route: "/definelogic",
    icon: "input",
    db_id: 1,
  },
  {
    id: "update-profile",
    label: "Audit Log",
    route: "/audit-log",
    icon: "mouse",
    db_id: 8,
  },
  {
    id: "update-profile",
    label: "Settings",
    route: "/update-profile",
    icon: "settings",
    db_id: 11,
  },
];

const Sidebar = () => {
  const [menuArray, setMenuArray] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const parm = useLocation();
  let path = parm.pathname;

  useEffect(() => {
    if (path) {
      selectedSidebar(path);
    }
  }, [path]);

  useEffect(() => {
    let allowedModules = [];
    try {
      let allowedModuleStr = localStorage.getItem("allowedModules");
      allowedModules = JSON.parse(allowedModuleStr);
      console.log("allowedModules", allowedModules);
      let allowedModulesArray = MANAGER_SIDEBAR?.filter((sideItem) =>
        Array.isArray(allowedModules) && allowedModules?.includes(sideItem?.db_id)
      );
      // Fallback: if no allowedModules provided, show full sidebar
      if (!Array.isArray(allowedModules) || allowedModulesArray?.length === 0) {
        setMenuArray(MANAGER_SIDEBAR);
      } else {
        setMenuArray(allowedModulesArray);
      }
    } catch (e) {
      // On parse errors or missing localStorage key, fall back to full sidebar
      setMenuArray(MANAGER_SIDEBAR);
    }
  }, []);

  const selectedSidebar = (key) => {
    // console.log(")(", key);

    const activeMenuIndex = menuArray?.findIndex((menu) =>
      menu?.route?.includes(key)
    );
    if (activeMenuIndex !== -1) {
      setSelectedIndex(activeMenuIndex);
    }
  };

  return (
    <aside className="w-64 flex flex-col">
      <div
        className="flex items-center justify-center py-3"
        style={{ backgroundColor: "#f5f5f5" }}
      >
        <img src={ReconciiLogo} alt="Logo" className="h-14" />
      </div>
      <nav style={{ color: "#ffffff" }}>
        <ul>
          {menuArray?.map((item, i) => {
            return (
              <MenuItem
                key={item?.id}
                menuArray={item}
                selectedIndex={selectedIndex}
                setSelectedIndex={setSelectedIndex}
                index={i}
              />
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;

const MenuItem = ({ menuArray, selectedIndex, setSelectedIndex, index }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onClick = (e) => {
    e.preventDefault();
    if (!menuArray?.children) {
      navigate(menuArray?.route);
    }
    setOpen(!open);
    setSelectedIndex(index);
  };

  return (
    <li>
      <NavLink
        disabled={menuArray?.children}
        onClick={onClick}
        to={"/"}
        exact
        className={`flex p-3 ${
          selectedIndex === index ? "navLinkSelected" : "navLink"
        }`}
      >
        {menuArray?.icon && (
          <span className="material-icons-outlined mr-2">
            {menuArray?.icon}
          </span>
        )}
        <div className="flex-1">{menuArray?.label}</div>
        {menuArray?.children ? (
          <div className="flex justify-center items-end">
            <span className="material-icons-outlined">
              {open ? "keyboard_arrow_down" : "keyboard_arrow_right"}
            </span>
          </div>
        ) : null}
      </NavLink>
      {menuArray?.children && open ? (
        <ul className="ml-8">
          {menuArray?.children?.map((item) => {
            return <MenuItem key={item?.id} menuArray={item} />;
          })}
        </ul>
      ) : null}
    </li>
  );
};
