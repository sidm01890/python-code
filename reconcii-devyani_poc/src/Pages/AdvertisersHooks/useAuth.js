
import { requestCallPost } from "../../ServiceRequest/APIFunctions"
const useAuth = () =>{

    const signIn = async (req) => {
        console.log(req)
        try {
            const response = await requestCallPost('auth/advertiserSignIn',
                req,
            );
            if(response.data.Success === 200){
                return {status: true, ...response.data}
            }
            return {status: false, message: 'Something went wrong'}
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }
    
    return {signIn}
}

export default useAuth