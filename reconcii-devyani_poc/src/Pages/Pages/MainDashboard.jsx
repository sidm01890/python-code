import React, { useEffect, useState } from "react";
// import useDashboard from '../AdminHooks/useAdminData';
import { useLocation } from "react-router-dom";
import CardComponent from "../Components/CardComponent";
import "../Styles/Dashboard.css";
import LineChart from "../../components/Charts/Line";
import BlankCard from "../../components/BlankCard";
import BarChart from "../../components/Charts/Bar";
import PieChart from "../../components/Charts/Pie";
import DoughnutChart from "../../components/Charts/DoughnutChart";
import MixedChart from "../../components/Charts/MixedChart";
import PolarChart from "../../components/Charts/PolarChart";
import DropDownComponent from "../../components/DropDownComponent";
import { scales } from "chart.js";
import { DATETYPE, INSTORETYPE, THREEPOTYPE } from "../../Utils/DataVariable";
import { BLUE, GREEN, RED } from "../../Utils/Colors";
import moment from "moment/moment";

const MainDashboard = () => {
  const [inStoreValue, setInStoreValue] = useState(INSTORETYPE[0]);
  const [threePOValue, setThreePOValue] = useState(THREEPOTYPE[0]);
  const [salesType, setSalesType] = useState(DATETYPE[0]);
  const [figureType, setFigureType] = useState(DATETYPE[0]);

  let [barGraphData, setBarGraphData] = useState({
    labels: ["First", "Second", "Third", "Fourth"],
    datasets: [
      {
        data: [334838483, 343467373, 347366747, 478729837],
        backgroundColor: [BLUE, GREEN, RED, BLUE],
        borderWidth: 1,
      },
    ],
  });
  let pieGraphData = [
    { type: "Reconciled", value: 334838483, bg: BLUE },
    { type: "Unreconciled", value: 34346733, bg: RED },
  ];

  let inStoreData = {
    TRM: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          label: "Card",
          data: [33, 43, 25, 41, 44, 38],
          fill: true,
          backgroundColor: BLUE,
          borderColor: BLUE,
          borderWidth: 2,
        },
        {
          label: "UPI",
          data: [33, 25, 35, 51, 54, 76],
          fill: false,
          backgroundColor: RED,
          borderColor: RED,
          borderWidth: 2,
        },
      ],
    },
    POS: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          label: "Card",
          data: [33, 25, 35, 51, 54, 76],
          fill: true,
          backgroundColor: BLUE,
          borderColor: BLUE,
          borderWidth: 2,
        },
        {
          label: "UPI",
          data: [33, 43, 68, 41, 44, 65],
          fill: false,
          backgroundColor: RED,
          borderColor: RED,
          borderWidth: 2,
        },
      ],
    },
  };
  let threePOData = {
    ThreePOSales: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          label: "Swiggy",
          data: [8, 17, 28, 20, 33, 29],
          fill: true,
          borderWidth: 2,
          backgroundColor: BLUE,
          borderColor: BLUE,
        },
        {
          label: "Zomato",
          data: [33, 25, 35, 51, 54, 76],
          fill: false,
          borderWidth: 2,
          backgroundColor: RED,
          borderColor: RED,
        },
        {
          label: "MagicPin",
          data: [3, 28, 43, 41, 39, 50],
          fill: true,
          borderWidth: 2,
          backgroundColor: GREEN,
          borderColor: GREEN,
        },
      ],
    },
    PoSSales: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          label: "Swiggy",
          data: [3, 28, 43, 41, 39, 50],
          fill: true,
          backgroundColor: BLUE,
          borderColor: BLUE,
        },
        {
          label: "Zomato",
          data: [8, 17, 28, 20, 33, 29],
          fill: false,
          backgroundColor: RED,
          borderColor: RED,
        },
        {
          label: "MagicPin",
          data: [33, 25, 35, 51, 54, 76],
          fill: true,
          backgroundColor: GREEN,
          borderColor: GREEN,
        },
      ],
    },
  };

  useEffect(() => {
    switch (salesType?.value) {
      case "Day Wise":
        const dates = [];
        const NUM_OF_DAYS = 7;

        for (let i = 0; i < NUM_OF_DAYS; i++) {
          let date = moment().subtract(i, "d").format("MM-DD-YYYY");
          dates.push(date);
        }
        setBarGraphData({
          labels: dates.reverse(),
          datasets: [
            {
              data: [284849, 364859, 958493, 847594, 941939, 794763, 604847],
              backgroundColor: [BLUE, GREEN, RED, BLUE],
              borderWidth: 1,
            },
          ],
        });
        break;
      case "Week Wise":
        setBarGraphData({
          labels: ["First", "Second", "Third", "Fourth"],
          datasets: [
            {
              data: [958493, 847594, 941939, 794763],
              backgroundColor: [BLUE, GREEN, RED, BLUE],
              borderWidth: 1,
            },
          ],
        });
        break;
      case "Month Wise":
        setBarGraphData({
          labels: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ],
          datasets: [
            {
              data: [
                284849, 364859, 958493, 847594, 941939, 794763, 604847, 364859,
                958493, 794763, 284849, 941939,
              ],
              backgroundColor: [BLUE, GREEN, RED, BLUE],
              borderWidth: 1,
            },
          ],
        });
        break;
      case "Quarterly":
        setBarGraphData({
          labels: ["First", "Second", "Third", "Fourth"],
          datasets: [
            {
              data: [364927, 384938, 843627, 746398],
              backgroundColor: [BLUE, GREEN, RED, BLUE],
              borderWidth: 1,
            },
          ],
        });
        break;
      case "Half Yearly":
        break;
      case "Yearly":
        break;
      default:
        break;
    }
  }, [salesType]);

  const onChangeSalesType = (data) => {
    setSalesType(data);
  };
  const onChangeFigureType = (data) => {
    setFigureType(data);
  };
  const onChangeInStore = (data) => {
    setInStoreValue(data);
  };
  const onChangeThreePO = (data) => {
    setThreePOValue(data);
  };

  return (
    <div className="flex-1">
      <div class="grid grid-cols-12 gap-x-5">
        <div class="xxl:col-span-3 md:col-span-6 col-span-12">
          <BlankCard
            header={<h4 class="box-title font-bold text-base">Total Sales</h4>}
            body={
              <div>
                <div className="flex float-end my-3">
                  <DropDownComponent
                    style={{ width: 20, backgroundColor: "red" }}
                    options={DATETYPE}
                    value={salesType}
                    onChange={onChangeSalesType}
                  />
                </div>
                <BarChart
                  dataSet={barGraphData}
                  options={{
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    // scales: {
                    //   x: {
                    //     title: {
                    //       display: true,
                    //       text: "Quarter",
                    //     },
                    //   },
                    // },
                  }}
                />
              </div>
            }
          />
        </div>
        <div class="xxl:col-span-3 md:col-span-6 col-span-12">
          <BlankCard
            // header={<h4 class="box-title font-bold text-base">Reconciled / Unreconciled</h4>}
            body={
              <div>
                <div className="flex my-3 justify-end">
                  <DropDownComponent
                    options={DATETYPE}
                    value={figureType}
                    onChange={onChangeFigureType}
                  />
                </div>
                <div className="h-72">
                  <PieChart
                    labels={pieGraphData.map((item) => item?.type)}
                    dataValue={pieGraphData.map((item) => item?.value)}
                    color={pieGraphData.map((item) => item?.bg)}
                  />
                </div>
              </div>
            }
          />
        </div>
      </div>
      <div class="grid grid-cols-12 gap-x-5">
        <div class="xxl:col-span-3 md:col-span-6 col-span-12">
          <BlankCard
            header={<h4 class="box-title font-bold text-base">In Store</h4>}
            body={
              <div>
                <div className="flex float-end my-3">
                  <DropDownComponent
                    options={INSTORETYPE}
                    value={inStoreValue}
                    onChange={onChangeInStore}
                  />
                </div>
                <LineChart dataset={inStoreData[inStoreValue.value]} />
              </div>
            }
          />
        </div>
        <div class="xxl:col-span-3 md:col-span-6 col-span-12">
          <BlankCard
            header={<h4 class="box-title font-bold text-base">3PO</h4>}
            body={
              <div>
                <div className="flex float-end my-3">
                  <DropDownComponent
                    style={{ width: 20, backgroundColor: "red" }}
                    options={THREEPOTYPE}
                    value={threePOValue}
                    onChange={onChangeThreePO}
                  />
                </div>
                <LineChart dataset={threePOData[threePOValue.value]} />
              </div>
            }
          />
        </div>
      </div>

      {/* <div class="grid grid-cols-12 gap-x-6">
        <div class="xxl:col-span-3 md:col-span-3 col-span-12">
          <CardComponent />
        </div>
        <div class="xxl:col-span-3 md:col-span-3 col-span-12">
          <CardComponent />
        </div>
        <div class="xxl:col-span-3 md:col-span-3 col-span-12">
          <CardComponent />
        </div>
        <div class="xxl:col-span-3 md:col-span-3 col-span-12">
          <CardComponent />
        </div>
      </div> */}

      {/* <div class="grid grid-cols-12 gap-x-6 font-Roboto">
        <div class="xxl:col-span-3 md:col-span-3 col-span-12">
          <div class="box overflow-hidden">
            <div class="box-body !p-0">
              <div class="box-header !border-b-0 !pb-0">
                <div class="flex justify-between">
                  <h4 class="box-title mb-2 font-bold">Recent Orders</h4>
                </div>
                <div>
                  <p class="text-[.75rem] text-Text-primary font-normal mb-0">
                    Tracking Your Latest Shopping Adventures.
                  </p>
                </div>
              </div>
              <div class="">
                <ul class="pt-4">
                  <li class="px-4">
                    <div class="mb-6">
                      <div class="flex items-center">
                        <a href="javascript:void(0);">
                          <span class="avatar avatar-md br-5 bg-primary/10 !text-primary bg-Background-dark me-3">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              fill="currentColor"
                              class="bi bi-box"
                              viewBox="0 0 16 16"
                            >
                              <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z" />
                            </svg>
                          </span>
                        </a>
                        <div class="w-full">
                          <a href="javascript:void(0);">
                            <h6 class="mb-2 mt-1 text-[0.925rem] font-medium text-default">
                              Fashion
                            </h6>
                          </a>
                          <div class="progress progress-xs">
                            <div
                              class="progress-bar progress-bar-striped progress-bar-animated bg-warning"
                              style={{ width: "90%" }}
                            ></div>
                          </div>
                        </div>
                        <div class="ms-auto my-auto">
                          <p class="mb-3 fs-13 text-Text-primary">
                            <i class="fe fe-arrow-up-right mx-1 text-success brround"></i>
                            93.0%
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li class="px-4">
                    <div class="mb-6">
                      <div class="flex">
                        <a href="javascript:void(0);">
                          <span class="avatar avatar-md br-5 bg-danger/10 !text-danger bg-Text-secondary me-3">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              fill="currentColor"
                              class="bi bi-house-door"
                              viewBox="0 0 16 16"
                            >
                              <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v4z" />
                            </svg>
                          </span>
                        </a>
                        <div class="w-full">
                          <a href="javascript:void(0);">
                            <h6 class="mb-2 mt-1 text-[0.925rem] font-medium text-default">
                              Home Furniture
                            </h6>
                          </a>
                          <div class="progress progress-xs">
                            <div
                              class="progress-bar progress-bar-striped progress-bar-animated !bg-danger"
                              style={{ width: "80%" }}
                            ></div>
                          </div>
                        </div>
                        <div class="ms-auto my-auto">
                          <p class="mb-3 fs-13 text-Text-primary">
                            <i class="fe fe-arrow-up-right mx-1 text-success brround"></i>
                            80.5%
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li class="px-4">
                    <div class="mb-6">
                      <div class="flex">
                        <a href="javascript:void(0);">
                          <span class="avatar avatar-md br-5 bg-success/10 !text-success bg-Text-secondary me-3">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              fill="currentColor"
                              class="bi bi-layers"
                              viewBox="0 0 16 16"
                            >
                              <path d="M8.235 1.559a.5.5 0 0 0-.47 0l-7.5 4a.5.5 0 0 0 0 .882L3.188 8 .264 9.559a.5.5 0 0 0 0 .882l7.5 4a.5.5 0 0 0 .47 0l7.5-4a.5.5 0 0 0 0-.882L12.813 8l2.922-1.559a.5.5 0 0 0 0-.882zm3.515 7.008L14.438 10 8 13.433 1.562 10 4.25 8.567l3.515 1.874a.5.5 0 0 0 .47 0zM8 9.433 1.562 6 8 2.567 14.438 6z" />
                            </svg>
                          </span>
                        </a>
                        <div class="w-full">
                          <a href="javascript:void(0);">
                            <h6 class="mb-2 mt-1 text-[0.925rem] font-medium text-default">
                              Groceries
                            </h6>
                          </a>
                          <div class="progress progress-xs">
                            <div
                              class="progress-bar progress-bar-striped progress-bar-animated !bg-success"
                              style={{ width: "60%" }}
                            ></div>
                          </div>
                        </div>
                        <div class="ms-auto my-auto">
                          <p class="mb-3 fs-13 text-Text-primary">
                            <i class="fe fe-arrow-up-right mx-1 text-success brround"></i>
                            60.7%
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li class="px-4">
                    <div class="mb-6">
                      <div class="flex">
                        <a href="javascript:void(0);">
                          <span class="avatar avatar-md br-5 bg-info/10 !text-info bg-Text-secondary me-3">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              fill="currentColor"
                              class="bi bi-tv"
                              viewBox="0 0 16 16"
                            >
                              <path d="M2.5 13.5A.5.5 0 0 1 3 13h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5M13.991 3l.024.001a1.5 1.5 0 0 1 .538.143.76.76 0 0 1 .302.254c.067.1.145.277.145.602v5.991l-.001.024a1.5 1.5 0 0 1-.143.538.76.76 0 0 1-.254.302c-.1.067-.277.145-.602.145H2.009l-.024-.001a1.5 1.5 0 0 1-.538-.143.76.76 0 0 1-.302-.254C1.078 10.502 1 10.325 1 10V4.009l.001-.024a1.5 1.5 0 0 1 .143-.538.76.76 0 0 1 .254-.302C1.498 3.078 1.675 3 2 3zM14 2H2C0 2 0 4 0 4v6c0 2 2 2 2 2h12c2 0 2-2 2-2V4c0-2-2-2-2-2" />
                            </svg>
                          </span>
                        </a>
                        <div class="w-full">
                          <a href="javascript:void(0);">
                            <h6 class="mb-2 mt-1 text-[0.925rem] font-medium text-default">
                              Electronics
                            </h6>
                          </a>
                          <div class="progress progress-xs">
                            <div
                              class="progress-bar progress-bar-striped progress-bar-animated !bg-info"
                              style={{ width: "60%" }}
                            ></div>
                          </div>
                        </div>
                        <div class="ms-auto my-auto">
                          <p class="mb-3 fs-13 text-Text-primary">
                            <i class="fe fe-arrow-up-right mx-1 text-success brround"></i>
                            60.7%
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li class="px-4">
                    <div class="mb-6">
                      <div class="flex">
                        <a href="javascript:void(0);">
                          <span class="avatar avatar-md br-5 bg-warning/10 !text-warning bg-Text-secondary me-3">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              fill="currentColor"
                              class="bi bi-bullseye"
                              viewBox="0 0 16 16"
                            >
                              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
                              <path d="M8 13A5 5 0 1 1 8 3a5 5 0 0 1 0 10m0 1A6 6 0 1 0 8 2a6 6 0 0 0 0 12" />
                              <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
                              <path d="M9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" />
                            </svg>
                          </span>
                        </a>
                        <div class="w-full">
                          <a href="javascript:void(0);">
                            <h6 class="mb-2 mt-1 text-[0.925rem] font-medium text-default">
                              Toys &amp; Games
                            </h6>
                          </a>
                          <div class="progress progress-xs">
                            <div
                              class="progress-bar progress-bar-striped progress-bar-animated !bg-warning"
                              style={{ width: "60%" }}
                            ></div>
                          </div>
                        </div>
                        <div class="ms-auto my-auto">
                          <p class="mb-3 fs-13 text-Text-primary">
                            <i class="fe fe-arrow-up-right mx-1 text-success brround"></i>
                            60.7%
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-12 gap-x-6 font-Roboto">
        <div class="xxl:col-span-6 md:col-span-6 col-span-12">
          <BlankCard
            header={<h4 class="box-title font-bold">CHARTJS LINE CHART</h4>}
          />
        </div>
        <div class="xxl:col-span-3 md:col-span-6 col-span-12">
          <BlankCard
            header={<h4 class="box-title font-bold">CHARTJS BAR CHART</h4>}
          />
        </div>
      </div>
      <div class="grid grid-cols-12 gap-x-6 font-Roboto">
        <div class="xxl:col-span-6 md:col-span-6 col-span-12">
          <BlankCard
            header={<h4 class="box-title font-bold">CHARTJS PIE CHART</h4>}
            body={<div className="h-64"></div>}
          />
        </div>
        <div class="xxl:col-span-3 md:col-span-6 col-span-12">
          <BlankCard
            header={<h4 class="box-title font-bold">CHARTJS DOUGHNUT CHART</h4>}
            body={
              <div className="h-64">
                <DoughnutChart />
              </div>
            }
          />
        </div>
      </div>
      <div class="grid grid-cols-12 gap-x-6 font-Roboto">
        <div class="xxl:col-span-6 md:col-span-6 col-span-12">
          <BlankCard
            header={<h4 class="box-title font-bold">CHARTJS MIXED CHART</h4>}
            body={<MixedChart />}
          />
        </div>
      </div> */}
    </div>
  );
};

export default MainDashboard;
