import React, { useEffect } from "react";
import "../../Styles/DefineLogic.css";
import ExpandableCard from "./ExpandableCard";
import ManageDataSet from "./Components/ManageDataSet";
import { useSelector } from "react-redux";
import SetLogics from "./SetLogics";
import useLogic from "./useLogic";
import moment from "moment";

const DefineLogic = () => {
  const { getTenderList } = useLogic();
  let { tableList, logicGroups } = useSelector((state) => state.LogicsService);

  useEffect(() => {
    getTenderList();
  }, []);

  const getGroupName = (item, index) => {
    let groupName = `Group ${index + 1} (`;
    if (item?.effectiveFrom) {
      groupName += moment(item?.effectiveFrom).format("DD MMM, YYYY");
    } else {
      groupName += "From Start";
    }
    groupName += " to ";
    if (item?.effectiveTo && item.effectiveTo !== "2099-12-31") {
      groupName += moment(item?.effectiveTo).format("DD MMM, YYYY");
    } else {
      groupName += " Till Date";
    }

    groupName += ")";
    return groupName;
  };

  return (
    <div className="">
      <ExpandableCard header={"Select Tender"}>
        <ManageDataSet />
      </ExpandableCard>
      {tableList?.length > 0 && (
        <>
          {logicGroups?.map((group, index) => {
            return (
              <ExpandableCard
                header={getGroupName(group, index)}
                key={`group_${index}`}
                index={index}
              >
                <SetLogics group={group} index={index} />
              </ExpandableCard>
            );
          })}
        </>
      )}
    </div>
  );
};

export default DefineLogic;
