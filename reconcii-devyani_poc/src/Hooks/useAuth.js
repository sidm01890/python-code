
import { requestCallPost } from "../ServiceRequest/APIFunctions"
const useAuth = () =>{

    const sendOtp = async (req) => {
        try {
            const response = await requestCallPost('auth/sendEmailOTP',
                req,
            );
            if(response.data.Status === 200){
                return {status: true, OTP: response.data.OTP
                    }
            }
            return {status: false, message: 'Something went wrong'}
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const verifyOtp = async (req) => {
        try {
            const response = await requestCallPost('auth/verifyEmailOTP',
                req,
            );
            if(response.data.Status === 200){
                return {...response.data, status: true}
            }
            return {status: false, message: 'Something went wrong'}
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const candidateRegister = async (req) => {
        try {
            const response = await requestCallPost('auth/setSiteUser',
                req,
            );
            if(response.data.Status === 200){
                return {status: true}
            }
            return {status: false, message: 'Something went wrong'}
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    return {sendOtp, candidateRegister, verifyOtp}
}

export default useAuth