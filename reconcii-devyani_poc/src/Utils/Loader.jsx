import React, { useContext, useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';
import spinner from "../assets/Images/spinner.gif"
import "../App.css"
const LoaderContext = React.createContext({
  isLoading: false,
  setLoading: () => {},
  toastMessage: null,
  setToastMessage: () => {},
});
export default function Loader({ loading }) {
  const { setLoading } = useLoader();
  useEffect(() => {
    setLoading(loading);

    return () => {
      setLoading(false);
    };
  }, [loading]);

  return null;
}

function LoaderUI() {
  return (
    <div className='loader-ui'>
      <div className='spinner-div'>
        <img src={spinner} alt="spinner" /> 
      </div> 
    </div>
  );
}

export function LoaderProvider({ children }) {
  const dispatch = useDispatch();
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    // dispatch(setShowingLoader(isLoading));
  }, [isLoading]);

  const [toastMessage, setToastMessage] = useState(null);
  return (
    // eslint-disable-next-line react/jsx-no-constructed-context-values
    <LoaderContext.Provider value={{ isLoading, setLoading, setToastMessage }}>
      {children}
      {isLoading && <LoaderUI />}
      <Alert message={toastMessage?.message} type={toastMessage?.type} />
    </LoaderContext.Provider>
  );
}

export function useLoader() {
  const { isLoading, setLoading, setToastMessage } = useContext(LoaderContext);
  return { isLoading, setLoading, setToastMessage };
}

const Alert = ({ message, type, duration = 3000 }) => {
  const {setToastMessage} = useLoader();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show the alert
    if(message === null){
      return 
    }
    setVisible(true);

    // Set a timer to hide the alert after the specified duration
    const timer = setTimeout(() => {
      setVisible(false);
    }, duration);

    const timer2 = setTimeout(() => {
      setToastMessage(null)
    }, 5000);

    // Cleanup the timer when the component is unmounted
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [message]);

  return (
    <div className={`alert-box ${type} ${visible ? "slide-in" : "slide-out"}`}>
      {message}
    </div>
  );
};
