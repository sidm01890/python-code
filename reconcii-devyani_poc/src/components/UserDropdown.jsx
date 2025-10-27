import React from 'react';
import { getFirstCharacter } from '../Utils/UtilityFunctions';
import { useNavigate } from 'react-router-dom';

const UserDropdown = () => {
    const navigate = useNavigate()
    const logoutMeOut = () =>{
        localStorage.clear()
        navigate('/')
    }
    const manageMeOut = () =>{
        
        navigate('/user/properties/list')
    }
    
    

    return (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50">
            <div className="px-4 py-3">
                <div className="flex items-center space-x-3">
                    <div className="flex flex-col">
                        <span className="font-semibold text-gray-800">{localStorage.getItem('candidateName')}</span>
                        <span className="text-gray-500 text-sm">{localStorage.getItem('candidateEmail')}</span>
                    </div>
                </div>
            </div>
            <div className="border-t border-gray-200">
                <button className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100" onClick={manageMeOut}>
                    <span className="material-icons-outlined text-gray-500 mr-2">settings</span>
                    Manage Listing
                </button>
                <button className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100" onClick={logoutMeOut}>
                    <span className="material-icons-outlined text-gray-500 mr-2">logout</span>
                    Sign out
                </button>
            </div>
            {/* <div className="border-t border-gray-200 px-4 py-2 text-sm text-gray-500">
                Secured by <span className="font-semibold">clerk</span>
            </div> */}
        </div>
    );
};

export default UserDropdown;
