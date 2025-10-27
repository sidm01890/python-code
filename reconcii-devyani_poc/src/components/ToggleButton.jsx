import React from 'react';

const ToggleButton = (props) => {
    return (
        <label class="switch">
            <input type="checkbox" checked={props?.checked} onChange={props?.onChange}/>
            <span class="slider round"></span>
        </label>
    );
}

export default ToggleButton;


