import { format } from "date-fns";
import * as XLSX from "xlsx";

const validateEmail = (mail) => {
  return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
    mail
  );
};
const validateMobile = (mobile) => {
  return /^(\+\d{1,3}[- ]?)?\d{10}$/.test(mobile);
};

const validateAge = (age) => {
  return /^[1-9]?[0-9]{1}$|^100$/.test(age);
};

const validateOnlyDigits = (input) => {
  return /^\d+$/.test(input);
};

function isNumeric(value) {
  const regex = /^[0-9]+$/;
  return regex.test(value);
}

function isValidPassword(password) {
  const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

const getFirstCharacter = (name) => {
  if (name) {
    return name.charAt(0)?.toUpperCase();
  }
  return "";
};

const readExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const binaryStr = event.target.result;
      const workbook = XLSX.read(binaryStr, { type: "binary" });

      // Assuming the first sheet is the one we want to read
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert the sheet to JSON
      const sheetData = XLSX.utils.sheet_to_json(worksheet);
      resolve(sheetData);
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsBinaryString(file);
  });
};

const userTypeFromURL = (url) => {
  if (url?.includes("manager")) {
    return "manager";
  } else if (url?.includes("agent")) {
    return "agent";
  }
  return "admin";
};

const dateFormatChangerView = (dat) => {
  return format(dat, "yyyy-MM-dd");
};

const generateDeviceCode = () => {
  // Generate a random string or use a library to create a unique device code
  const randomCode = Math.random().toString(36).substring(1, 10);
  return randomCode;
};

function formatNumberToLakhsAndCrores(number) {
  const absNumber = Math.abs(number);

  if (isNaN(number) || number === undefined) {
    return number; // Return original value if it's not a valid number
  }

  const lakhs = absNumber / 1e5;
  return `${formatToFixed(lakhs)}`;
}

function formatToFixed(value) {
  // Round to 1 decimal place and remove trailing zeros
  const roundedValue = Number(value.toFixed(2));
  return roundedValue.toString();
}

export {
  validateEmail,
  validateMobile,
  getFirstCharacter,
  readExcelFile,
  userTypeFromURL,
  validateAge,
  isNumeric,
  isValidPassword,
  dateFormatChangerView,
  generateDeviceCode,
  formatNumberToLakhsAndCrores,
  validateOnlyDigits,
};
