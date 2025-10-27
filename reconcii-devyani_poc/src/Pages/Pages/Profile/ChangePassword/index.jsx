import React, { useEffect, useRef, useState } from "react";
import BlankCard from "../../../../components/BlankCard";
import CustomInput from "../../../../components/CustomInput";
import useChangePassword from "./useChangePassword";
import PrimaryButton from "../../../../components/PrimaryButton";

export default function ChangePassword() {
  const {
    changePasswordParams,
    changePasswordParamsError,
    handleChangePassword,
    onSubmit
  } = useChangePassword();
  
  return (
    <div className="">
      <BlankCard
        header={<h4 class="box-title font-bold text-base">CHANGE PASSWORD</h4>}
      >
        <div className="pt-3 w-full md:w-1/2">
          <CustomInput
            placeholder="Old Password"
            label="Old Password"
            type="password"
            name="currentPassword"
            value={changePasswordParams?.currentPassword}
            onChange={(e) =>
              handleChangePassword("currentPassword", e.target.value)
            }
            error={changePasswordParamsError?.currentPassword}
          />
          <CustomInput
            placeholder="New Password"
            label="New Password"
            type="password"
            name="newPassword"
            value={changePasswordParams?.newPassword}
            onChange={(e) =>
              handleChangePassword("newPassword", e.target.value)
            }
            error={changePasswordParamsError?.newPassword}
          />
          <CustomInput
            placeholder="Confirm Password"
            label="Confirm Password"
            type="password"
            name="confirmPassword"
            value={changePasswordParams?.confirmPassword}
            onChange={(e) =>
              handleChangePassword("confirmPassword", e.target.value)
            }
            error={changePasswordParamsError?.confirmPassword}
          />
          <PrimaryButton label="Submit" onClick={onSubmit} />
        </div>
      </BlankCard>
    </div>
  );
}
