import React from 'react';

interface CryptoNexaLogoProps {
  className?: string;
  size?: number | string;
  rounded?: string;
}

export const CryptoNexaLogo: React.FC<CryptoNexaLogoProps> = ({
  className = 'w-7 h-7',
  rounded = 'rounded-lg',
}) => {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-[#A3FF12] select-none flex-shrink-0 ${rounded} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full p-[2%]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 44.5 38.2 A 19 19 0 0 1 68.5 25.2 L 93.5 18.8 L 44.5 38.2 Z"
          fill="#000000"
        />
        <path
          d="M 48 36.2 L 13 49.5 L 36.8 55.8 L 34.8 79 L 65.2 36.2 Z"
          fill="#000000"
        />
      </svg>
    </div>
  );
};
