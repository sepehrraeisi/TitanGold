
import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0d0f19]">
      <div className="flex flex-col items-center">
        <svg className="h-12 w-12 text-purple-500 animate-pulse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <p className="text-gray-400 mt-4 text-sm tracking-widest animate-pulse">LOADING TITAN...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
