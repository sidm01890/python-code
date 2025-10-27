import React, {useState} from 'react';
import HelpModal from './HelpModal';

const Footer = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    return (
        <footer className="border-gray-200 p-6 theme-background">
            <ul className="flex justify-center space-x-6">
                <li><a href="/about">About Us</a></li>
                <li><a href="#">Terms and Conditions</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="/" onClick={(e) => {e.preventDefault(); openModal()}} >About Us</a></li>    
            </ul>
            {isModalOpen && <HelpModal closeModal={closeModal} />}
        </footer>
    );
}

export default Footer;