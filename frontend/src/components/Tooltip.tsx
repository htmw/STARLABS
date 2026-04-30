type TooltipProps = {
  text: string;
  children: React.ReactNode;
};

function Tooltip({ text, children }: TooltipProps) {
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className="tooltip-content">{text}</span>
    </span>
  );
}

export default Tooltip;