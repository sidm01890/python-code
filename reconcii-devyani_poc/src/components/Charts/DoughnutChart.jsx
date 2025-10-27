import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DoughnutChart() {
  const data = {
    labels: ["Customer", "Business", "Shopping"],
    datasets: [
      {
        data: [40, 29, 18],
        backgroundColor: ["rgba(41,96,224,1)", "rgba(236,186,94,1)", "rgba(80,94,128,1)"],
        borderWidth: 1,
      },
    ],
  };

  return <Doughnut data={data}  options={{responsive: true,
    maintainAspectRatio: false}}/>;
}
