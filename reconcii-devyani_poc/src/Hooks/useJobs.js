import React, {useState} from "react"
import { requestCallGet, requestCallPost } from "../ServiceRequest/APIFunctions"
const useJobs = () =>{
    const [companyList, setCompanyList] = useState([])
    const [jobList, setJobList] = useState([])
    const [cityList, setCityList] = useState([])
    const [stateList, setStateList] = useState([])

    

    const getCompanyList = async (req) => {
        try {
            const response = await requestCallGet('getCompanyList');
            if(response.data.Status === 200){
                setCompanyList(response.data?.Content)
            }
            return {status: false, message: 'Something went wrong'}
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const getJobsList = async () => {
        try {
            const response = await requestCallGet('getJobsList');
            if(response.data.Status === 200){
                setJobList(response.data?.content)
            }
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const getStateList = async () => {
        try {
            const response = await requestCallGet('getState/1');
            if(response.data.Status === 200){
                setStateList(response.data?.Data)
            }
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const getCities = async (state_id) => {
        try {
            const response = await requestCallGet('getCities/'+state_id);
            if(response.data.Status === 200){
                setCityList(response.data?.States)
            }
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const getAppliedJobs = async (req) => {
        try {
            const response = await requestCallPost('getCandidateAppliedJobs',
                req,
            );
            return response
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const getCandidateSearchedJobs = async (req) => {
        try {
            const response = await requestCallPost('getCandidateSearchedJobs', req);
            return response
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    const geAllJobsForCandidate = async (candidateId) => {
        try {
            const response = await requestCallGet('getJobsGroupedByStatus/'+candidateId);
            return response
        } catch (error) {
            return {status: false, message: 'Something went wrong'}
        }
    }

    

    return {getAppliedJobs, getCompanyList, companyList, getJobsList, jobList, getStateList, stateList, getCities, cityList, geAllJobsForCandidate, getCandidateSearchedJobs}
}

export default useJobs