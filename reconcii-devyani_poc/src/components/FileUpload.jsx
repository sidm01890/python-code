import React, { useRef, useState } from "react";
import PrimaryButton from "./PrimaryButton";

export default function FileUpload() {
  // Create a reference to the hidden file input element
  const hiddenFileInput = useRef(null);


  let [fileList, setFileList] = useState([]);

  const handleClick = (event) => {
    hiddenFileInput.current.click();
  };

  const handleFile = fileData => {
    
    let data = fileData.map((item,index) => {
        return {filename: item.name, id: new Date().getTime()+index, size: item.size}
    })
    setFileList([...fileList, ...data])
  };
  
  const handleChange = (event) => {
    const fileUploaded = Object.values(event.target.files);
    handleFile(fileUploaded);
  };

  const onRemove = (file) => {
    let data = fileList.filter((item) => {
        return file?.id !== item?.id 
    })
    setFileList(data);
  };



  return (
    <div class="font-Roboto text-Text-secondary border-text-primary border-1 rounded-md">
      {fileList[0] && (
        <>
          <div class="p-2">
            {fileList.map((dataItem) => {
              return (
                <div key={dataItem?.id} className="flex py-1 border-text-primary gap-1 items-center">
                    <span className="material-icons-outlined">description</span>
                    <label className="flex w-100">{dataItem.filename}</label>
                    <span className="material-icons-outlined text-DangerColor" onClick={()=>onRemove(dataItem)}>close</span>
                </div>
              );
            })}
          </div>
          <div className="border-text-primary border-t" />
        </>
      )}
      <div className="px-3 py-2 flex items-start">
        <input type="file" ref={hiddenFileInput} onChange={handleChange} style={{ display: "none" }} multiple />
        <div className="">
            <PrimaryButton
                label={"Browse File"}
                leftIcon={
                    <span className="material-icons-outlined">upload_file</span>
                }
                onClick={handleClick}
            />
        </div>
      </div>
    </div>
  );
}
