"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CategoryAverageChart from "@/components/yearly-charts/CategoryAverageChart";
import CategoryByMonthChart from "@/components/yearly-charts/CategoryByMonthChart";
import CategoryMemberBreakdownChart from "@/components/yearly-charts/CategoryMemberBreakdownChart";
import CategoryTotalChart from "@/components/yearly-charts/CategoryTotalChart";
import LocationSpendingChart from "@/components/yearly-charts/LocationSpendingChart";
import MemberCategoryHeatmap from "@/components/yearly-charts/MemberCategoryHeatmap";
import MemberSpendingChart from "@/components/yearly-charts/MemberSpendingChart";
import MonthlySpendingChart from "@/components/yearly-charts/MonthlySpendingChart";
import TopExpensesChart from "@/components/yearly-charts/TopExpensesChart";
import { ExpenseWithDetails } from "@/entities/Expense";
import { cn } from "@/lib/utils";

const CARD_CLASS = "chart-card bg-card text-card-foreground min-w-0 rounded-2xl p-5 shadow-md sm:p-6";

// Sortable chart wrapper component
const SortableChart = ({
  id,
  children,
  colSpan,
}: {
  id: string;
  children: React.ReactNode;
  colSpan: string;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        CARD_CLASS,
        "group/chart relative",
        colSpan,
        isDragging && "ring-ring/40 z-50 opacity-80 ring-2",
      )}
      {...attributes}
    >
      <button
        type="button"
        aria-label="Drag to reorder chart"
        {...listeners}
        className="text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted absolute top-3 right-3 flex size-7 cursor-grab items-center justify-center rounded-md transition-colors active:cursor-grabbing print:hidden"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="pr-8">{children}</div>
    </div>
  );
};

interface YearlyChartsGridProps {
  filteredExpenses: ExpenseWithDetails[];
  currentYear: number;
}

const YearlyChartsGrid = ({
  filteredExpenses,
  currentYear,
}: YearlyChartsGridProps) => {
  // Initialize chart order
  const initializeChartOrder = () => [
    "monthly-spending",
    "category-total",
    "category-average",
    "member-spending",
    "category-member-breakdown",
    "location-spending",
    "top-expenses",
    "member-heatmap",
    "category-by-month",
  ];

  const [tab, setTab] = useState("trends");

  // Chart order state with lazy initialization from localStorage
  const [chartOrder, setChartOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const savedOrder = localStorage.getItem("chart-order");
      return savedOrder ? JSON.parse(savedOrder) : initializeChartOrder();
    }
    return initializeChartOrder();
  });

  // DND Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setChartOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over?.id as string);

        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Save to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("chart-order", JSON.stringify(newOrder));
        }

        return newOrder;
      });
    }
  };

  // Reset chart order
  const resetChartOrder = () => {
    const defaultOrder = initializeChartOrder();
    setChartOrder(defaultOrder);
    if (typeof window !== "undefined") {
      localStorage.setItem("chart-order", JSON.stringify(defaultOrder));
    }
  };

  // Chart configurations
  const chartConfigs: Record<
    string,
    { component: React.ReactNode; colSpan: string }
  > = {
    "category-average": {
      colSpan: "",
      component: <CategoryAverageChart expenses={filteredExpenses} />,
    },
    "category-by-month": {
      colSpan: "lg:col-span-2",
      component: (
        <CategoryByMonthChart expenses={filteredExpenses} year={currentYear} />
      ),
    },
    "category-member-breakdown": {
      colSpan: "",
      component: <CategoryMemberBreakdownChart expenses={filteredExpenses} />,
    },
    "category-total": {
      colSpan: "",
      component: <CategoryTotalChart expenses={filteredExpenses} />,
    },
    "location-spending": {
      colSpan: "lg:col-span-2",
      component: <LocationSpendingChart expenses={filteredExpenses} />,
    },
    "member-heatmap": {
      colSpan: "lg:col-span-2",
      component: <MemberCategoryHeatmap expenses={filteredExpenses} />,
    },
    "member-spending": {
      colSpan: "",
      component: <MemberSpendingChart expenses={filteredExpenses} />,
    },
    "monthly-spending": {
      colSpan: "lg:col-span-2",
      component: (
        <MonthlySpendingChart expenses={filteredExpenses} year={currentYear} />
      ),
    },
    "top-expenses": {
      colSpan: "lg:col-span-2",
      component: <TopExpensesChart expenses={filteredExpenses} limit={10} />,
    },
  };

  const TAB_GROUPS: Record<string, string[]> = {
    all: chartOrder,
    breakdowns: ["category-total", "category-average", "location-spending"],
    people: ["member-spending", "category-member-breakdown", "member-heatmap"],
    top: ["top-expenses"],
    trends: ["monthly-spending", "category-by-month"],
  };

  const renderChartGroup = (ids: string[], draggable = false) => {
    const grid = (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ids.map((chartId) => {
          const config = chartConfigs[chartId];
          if (!config) return null;
          if (draggable) {
            return (
              <SortableChart key={chartId} id={chartId} colSpan={config.colSpan}>
                {config.component}
              </SortableChart>
            );
          }
          return (
            <div key={chartId} className={cn(CARD_CLASS, config.colSpan)}>
              {config.component}
            </div>
          );
        })}
      </div>
    );

    if (draggable) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            {grid}
          </SortableContext>
        </DndContext>
      );
    }
    return grid;
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="-mx-1 max-w-full overflow-x-auto px-1">
          <TabsList>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="breakdowns">Categories</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="top">Top expenses</TabsTrigger>
            <TabsTrigger value="all">All charts</TabsTrigger>
          </TabsList>
        </div>
        {tab === "all" && (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>Drag cards to reorder</span>
            <button
              type="button"
              onClick={resetChartOrder}
              className="hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          </div>
        )}
      </div>

      <TabsContent value="trends">
        {renderChartGroup(TAB_GROUPS.trends)}
      </TabsContent>
      <TabsContent value="breakdowns">
        {renderChartGroup(TAB_GROUPS.breakdowns)}
      </TabsContent>
      <TabsContent value="people">
        {renderChartGroup(TAB_GROUPS.people)}
      </TabsContent>
      <TabsContent value="top">
        {renderChartGroup(TAB_GROUPS.top)}
      </TabsContent>
      <TabsContent value="all">
        {renderChartGroup(TAB_GROUPS.all, true)}
      </TabsContent>
    </Tabs>
  );
};

export default YearlyChartsGrid;
