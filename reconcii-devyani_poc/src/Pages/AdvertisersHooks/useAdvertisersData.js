import React, {useState} from "react"
import { requestCallGet, requestCallPost } from "../../ServiceRequest/APIFunctions"
const useAdvertisersData = (type) =>{

    const [advertisementList, setAdvertisementList] = useState([])
    const getAdvertisements = async (req, returnStatus = false) => {
        try {
            const response = await requestCallPost("getAdvertisements", req);
            if(returnStatus){
                return {status: true, data: response.data?.Content}
            }
            if(response.data.Status === 200){
                setAdvertisementList(response.data?.Content)
                return 
            }
            return {status: false, message: 'Something went wrong'}
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const setAdvertisements = async (req) => {
        try {
            const response = await requestCallPost("setAdvertisements", req);
            if(response.data.Status === 200){
                return {status: true, message: 'Something went wrong'}
            }
            return {status: false, message: 'Something went wrong'}
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    return {
        advertisementList,
        getAdvertisements,
        setAdvertisements,
    }
}

export default useAdvertisersData