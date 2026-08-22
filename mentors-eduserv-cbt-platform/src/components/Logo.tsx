import React from "react";
import logoImg from "../assets/images/an_tech_logo_1787301542435.jpg";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
  subtitle?: string;
  invertText?: boolean;
  withTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = "md",
  className = "",
  showText = false,
  subtitle = "BUILD • AUTOMATE • INNOVATE",
  invertText = false,
  withTagline = false,
}) => {
  const sizeMap = {
    xs: { icon: "w-7 h-7", text: "text-sm", sub: "text-[9px]" },
    sm: { icon: "w-9 h-9", text: "text-base", sub: "text-[10px]" },
    md: { icon: "w-11 h-11", text: "text-lg", sub: "text-xs" },
    lg: { icon: "w-16 h-16", text: "text-2xl", sub: "text-xs" },
    xl: { icon: "w-24 h-24", text: "text-3xl", sub: "text-sm" },
  };

  const dim = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* AN TECH Logo Icon Container */}
      <div
        className={`${dim.icon} rounded-xl overflow-hidden shrink-0 bg-white border border-slate-200 shadow-sm p-0.5 flex items-center justify-center transition-transform hover:scale-105`}
      >
        <img
          src={logoImg}
          alt="AN TECH Logo"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight uppercase leading-none font-sans ${dim.text} ${
                invertText ? "text-white" : "text-slate-950"
              }`}
            >
              AN <span className="text-sky-600">TECH</span>
            </span>
          </div>
          {withTagline && (
            <span
              className={`font-bold tracking-wider text-[10px] uppercase mt-0.5 ${
                invertText ? "text-sky-300" : "text-sky-700"
              }`}
            >
              BUILD • AUTOMATE • INNOVATE
            </span>
          )}
          {subtitle && !withTagline && (
            <span
              className={`font-semibold tracking-wide ${dim.sub} ${
                invertText ? "text-slate-300" : "text-slate-500"
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
