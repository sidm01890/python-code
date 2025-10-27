import React from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PieChart(props) {
  const data = {
    labels: props?.labels,
    datasets: [
      {
        data: props?.dataValue,
        backgroundColor: props?.color,
        borderWidth: 1,
      },
    ],
  };

  return <Pie data={data}  options={{responsive: true,
    maintainAspectRatio: false}}/>;
}
