import React from 'react';
import ReactDOM from 'react-dom';

const HelpModal = ({ closeModal }) => {
    return ReactDOM.createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 w-1/3">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Support and Help 🙏</h2>
                    <button onClick={closeModal} className="text-gray-700">X</button>
                </div>
                <p className="mb-4 text-sm">Our team will reach out to you within 24 hours.</p>
                <form>
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1" htmlFor="subject">Subject</label>
                        <input
                            type="text"
                            id="subject"
                            name="subject"
                            className="w-full border border-gray-300 p-2 rounded-lg"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1" htmlFor="message">Message</label>
                        <textarea
                            id="message"
                            name="message"
                            className="w-full border border-gray-300 p-2 rounded-lg"
                            rows="4"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1" htmlFor="attach-images">Attach Images</label>
                        <input
                            type="file"
                            id="attach-images"
                            name="attach-images"
                            className="w-full border border-gray-300 p-2 rounded-lg"
                            multiple
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="bg-green-600 text-white px-4 py-2 rounded-lg"
                        >
                            Submit
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.getElementById('portal-root')
    );
};

export default HelpModal;
