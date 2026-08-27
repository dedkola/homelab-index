"use client";

import {
  ChartLegend,
  TimeseriesChart,
} from "@cloudflare/kumo/components/chart";
import { Text } from "@cloudflare/kumo";
import { LineChart } from "echarts/charts";
import {
  AriaComponent,
  AxisPointerComponent,
  BrushComponent,
  GridComponent,
  ToolboxComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useState } from "react";

import type { TimeSeriesPoint } from "@/features/dashboard/types";

echarts.use([
  LineChart,
  AriaComponent,
  AxisPointerComponent,
  BrushComponent,
  GridComponent,
  ToolboxComponent,
  TooltipComponent,
  CanvasRenderer,
]);

interface MetricSeries {
  name: string;
  color: string;
  data: TimeSeriesPoint[];
}

interface MetricChartProps {
  label: string;
  value: string;
  unit: string;
  detail: React.ReactNode;
  series: MetricSeries[];
  footer: React.ReactNode;
  tooltipValueFormat: (value: number) => string;
}

function ensureRenderableSeries(points: TimeSeriesPoint[]): TimeSeriesPoint[] {
  if (points.length >= 2) {
    return points;
  }

  const currentPoint = points[0] ?? [Date.now(), 0];
  return [[currentPoint[0] - 30_000, currentPoint[1]], currentPoint];
}

function tickTime(value: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function MetricChart({
  label,
  value,
  unit,
  detail,
  series,
  footer,
  tooltipValueFormat,
}: MetricChartProps) {
  const [height, setHeight] = useState(150);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 2400px)");
    const updateHeight = () => setHeight(query.matches ? 198 : 150);

    updateHeight();
    query.addEventListener("change", updateHeight);
    return () => query.removeEventListener("change", updateHeight);
  }, []);

  const chartData = useMemo(
    () =>
      series.map((item) => ({
        ...item,
        data: ensureRenderableSeries(item.data),
      })),
    [series],
  );
  const hasData = series.some((item) => item.data.length > 0);

  return (
    <section className="metric-panel" aria-label={label}>
      <div className="metric-heading">
        <ChartLegend.LargeItem
          name={label}
          color={series[0]?.color ?? "#92959b"}
          value={value}
          unit={unit}
          className="metric-legend"
        />
        <div className="metric-detail">{detail}</div>
      </div>
      <div className="metric-chart">
        {hasData ? (
          <TimeseriesChart
            echarts={echarts}
            isDarkMode={false}
            data={chartData}
            height={height}
            xAxisTickCount={2}
            xAxisTickFormat={tickTime}
            yAxisTickCount={3}
            yAxisTickFormat={(point) => Math.round(point).toString()}
            tooltipValueFormat={tooltipValueFormat}
            tooltipFollowCursor="x"
            ariaDescription={`${label} history`}
          />
        ) : (
          <div className="metric-chart-empty" style={{ height }}>
            <Text as="span" variant="mono-secondary">
              No data
            </Text>
          </div>
        )}
      </div>
      <div className="metric-footer">{footer}</div>
    </section>
  );
}
