export interface TicketMetric {
  date: string;
  type: "created" | "resolved";
  count: number;
}

export interface IconSvgProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  width?: number;
  height?: number;
}