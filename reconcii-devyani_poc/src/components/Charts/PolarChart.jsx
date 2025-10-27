import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function PolarChart() {
  var ctx = document.getElementById("myChart").getContext("2d");

  var myChart = new Chart(ctx, {
    type: "polarArea",
    data: {
      labels: ["Tokyo", "Mumbai", "Mexico City", "Shanghai"],
      datasets: [
        {
          data: [500, 50, 2424, 14040], // Specify the data values array

          borderColor: ["#2196f38c", "#f443368c", "#3f51b570", "#00968896"], // Add custom color border (Line)
          backgroundColor: ["#2196f38c", "#f443368c", "#3f51b570", "#00968896"], // Add custom color background (Points and Fill)
          borderWidth: 1, // Specify bar border width
        },
      ],
    },
    options: {
      responsive: true, // Instruct chart js to respond nicely.
      maintainAspectRatio: false, // Add to prevent default behaviour of full-width/height
      animation: {
        animateRotate: true,
        animateScale: true,
      },
    },
  });

  return <Chart data={myChart}/>;
}
