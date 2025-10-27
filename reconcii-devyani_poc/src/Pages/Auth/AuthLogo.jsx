import React from "react";
import "./Auth.css";
import Logo from "../../assets/Images/ReconcillLogo.png";
const AuthLogo = () => {
  return (
    <div className="fixed-logo">
      <img src={Logo} />
      <p className="tag-line">Powered by CorePeelers</p>
    </div>
  );
};

export default AuthLogo;
