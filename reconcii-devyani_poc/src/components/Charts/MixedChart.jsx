import React from "react";
import { Chart } from "react-chartjs-2";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
  } from 'chart.js';
  
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function MixedChart() {

  const data = {
    datasets: [{
      type: 'bar',
      label: 'Bar Dataset',
      data: [10, 20, 30, 40],
      
      fill: true,
            backgroundColor: "rgba(75,192,192,0.2)",
            borderColor: "#742774"
  }, {
      type: 'line',
      label: 'Line Dataset',
      data: [45, 47.5, 50, 45],
      borderColor: "rgba(75,192,192,1)",
      backgroundColor: "rgba(75,192,192,0.2)",
  }],
  labels: ['January', 'February', 'March', 'April']
  };

    return (
        <Chart data={data}/>
    )
}