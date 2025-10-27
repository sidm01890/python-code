import { useState } from "react"

const BLANK_CHANGE_PASSWORD = {
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
}

const useProfile = () =>{

    const [changePasswordParams, setChangePasswordParams] = useState(BLANK_CHANGE_PASSWORD)
    const [changePasswordParamsError, setChangePasswordParamsError] = useState(null)

    const handleChangePassword = (name, value) =>{
        if(changePasswordParamsError !== null){
            setChangePasswordParamsError(null)
        }
        setChangePasswordParams({...changePasswordParams, [name]: value})
    }

    return {
        changePasswordParams,
        changePasswordParamsError,
        handleChangePassword
    }
}

export default useProfile