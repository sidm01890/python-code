const BLANK_FORMULA = {
  id: 1,
  logicName: "",
  fields: [
    {
      type: "data_field",
      dataset_type: "",
      selectedDataSetValue: "",
      selectedFieldValue: "",
      customFieldValue: "",
      startBrackets: [],
      endBrackets: [],
    },
    {
      type: "operator",
      dataset_type: "",
      selectedFieldValue: "",
    },
    {
      type: "data_field",
      dataset_type: "",
      selectedDataSetValue: "",
      selectedFieldValue: "",
      customFieldValue: "",
      startBrackets: [],
      endBrackets: [],
    },
  ],
  formulaText: "",
  logicNameKey: "",
  multipleColumn: false,
};

export default BLANK_FORMULA;
