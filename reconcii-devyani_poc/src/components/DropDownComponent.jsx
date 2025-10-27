import { React } from "react";
import Select from "react-select";

const DropDownComponent = (props) => {
  return (
    <Select
      className={props?.class}
      styles={{
        ...props?.style,
        menu: ({ width, ...css }) => ({ ...css }),
      }}
      menuPortalTarget={document.body}
      value={props?.value}
      onChange={props?.onChange}
      options={props?.options}
      {...props}
    />
  );
};

export default DropDownComponent;
