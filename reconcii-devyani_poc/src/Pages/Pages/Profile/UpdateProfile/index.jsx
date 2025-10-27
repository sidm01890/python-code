import React, { useEffect, useRef, useState } from "react";
import BlankCard from "../../../../components/BlankCard";
import CustomInput from "../../../../components/CustomInput";
import PrimaryButton from "../../../../components/PrimaryButton";
import useProfileUpdate from "./useProfileUpdate";
import Alert from "../../../../components/Alert";

export default function UpdateProfile() {
  const {
    profileUpdateParams,
    profileUpdateParamsError,
    handleProfileUpdate,
    onSubmit,
  } = useProfileUpdate();

  return (
    <div className="">
      <BlankCard
        header={<h4 class="box-title font-bold text-base">UPDATE PROFILE</h4>}
      >
        <div className="pt-3 w-full md:w-1/2">
          {profileUpdateParams?.status && (
            <Alert type="success" message={profileUpdateParams?.status} />
          )}
          <CustomInput
            placeholder="Name"
            label="Name"
            type="text"
            name="name"
            value={profileUpdateParams?.name}
            onChange={(e) => handleProfileUpdate("name", e.target.value)}
            error={profileUpdateParamsError?.name}
          />
          <CustomInput
            placeholder="Email"
            label="Email"
            type="text"
            name="email"
            value={profileUpdateParams?.email}
            onChange={(e) => handleProfileUpdate("email", e.target.value)}
            error={profileUpdateParamsError?.email}
            // disabled
          />
          <CustomInput
            placeholder="Mobile"
            label="Mobile"
            type="text"
            name="mobile"
            value={profileUpdateParams?.mobile}
            onChange={(e) => handleProfileUpdate("mobile", e.target.value)}
            error={profileUpdateParamsError?.mobile}
          />
          <PrimaryButton label="Submit" onClick={onSubmit} />
        </div>
      </BlankCard>
    </div>
  );
}
