import React from "react";
import ChartJS from "chart.js/auto";

import { Bar } from "react-chartjs-2";

export default function BarChart(props) {
  return (
    <Bar style={props?.style} data={props?.dataSet} options={props?.options} />
  );
}
