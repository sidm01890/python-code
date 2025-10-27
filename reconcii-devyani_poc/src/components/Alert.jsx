import React from "react";

export default function Alert({type, message}) {
    if(type === "error"){
        return (
            <div className="bg-red-300 mb-2 rounded flex-row p-2 text-left">
                <i className="fa-solid fa-circle-exclamation text-rose-800"></i>
                <span className="text-rose-800 text-xs ml-2">{message}</span>
            </div>
        )
    }else{
        return (
            <div className="bg-emerald-300 mb-2 rounded flex-row p-2 text-left">
                <i className="fa-solid fa-circle-exclamation text-green-800"></i>
                <span className="text-green-800 text-xs ml-2">{message}</span>
            </div>
        )
    }
    
}