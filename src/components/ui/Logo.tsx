import React from "react";

type LogoProps = {
  className?: string;
};

export const Logo: React.FC<LogoProps> = ({
  className = "w-12 h-12",
}) => {
  return (
    <img 
      src="https://i.postimg.cc/dt7c6Csw/Gemini-Generated-Image-r8kw67r8kw67r8kw-removebg-preview.png"
      alt="KastronSec Logo"
      className={`${className} object-contain`}
      referrerPolicy="no-referrer"
    />
  );
};
