import { useEffect, useState } from "react";

type TooltipProps = {
  text: string;
  children: React.ReactNode;
};

function readTooltipEnabled() {
  return localStorage.getItem("kv-show-educational-tips") !== "false";
}

function Tooltip({ text, children }: TooltipProps) {
  const [enabled, setEnabled] = useState(() => readTooltipEnabled());

  useEffect(() => {
    const handleStorageChange = () => {
      setEnabled(readTooltipEnabled());
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("kv:settings-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("kv:settings-updated", handleStorageChange);
    };
  }, []);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <span className="tooltip-wrapper">
      {children}
      <span className="tooltip-content">{text}</span>
    </span>
  );
}

export default Tooltip;