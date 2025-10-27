import {defaultThemes} from 'react-data-table-component'
const CustomTableStyle = {
    header: {
        style: {
            minHeight: '48px',
        },
    },
    headRow: {
        style: {
            borderTopStyle: 'solid',
            borderTopWidth: '1px',
            borderLeftStyle: 'solid',
            borderLeftWidth: '1px',
            borderTopColor: defaultThemes.default.divider.default,
            minHeight: '48px',
        },
    },
    headCells: {
        style: {
            // '&:not(:last-of-type)': {
                borderRightStyle: 'solid',
                borderRightWidth: '1px',
                borderRightColor: defaultThemes.default.divider.default,
                backgroundColor:"rgb(243 244 246)",
                color:"#000000",
                fontWeight:"bold",
                fontFamily: 'Open Sans, sans-serif'
            // },
        },
    },
    cells: {
        style: {
            borderRightStyle: 'solid',
            borderRightWidth: '1px',
            borderRightColor: defaultThemes.default.divider.default,
        },
    },
};

export default CustomTableStyle;