import React from "react";
import "../Styles/CardComponent.css";

export default function CardComponent({ label, number, icon }) {
  return (
    <div className="box box-with-border">
      <div className="box-body">
        <div className="flex">
          <div className="flex-1">
            <p className="card-label">{label}</p>
            <p className="card-number">
              ₹{number}
              <p className="lac-label"> lac</p>
            </p>
          </div>
          <div className="flex-1 flex justify-end items-center">
            <div className="icon-box shadow-black">
              <img src={icon} alt="icon" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
