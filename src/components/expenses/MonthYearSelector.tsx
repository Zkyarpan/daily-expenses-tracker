"use client";

import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMonthLabels } from "@/lib/dateUtils";

import YearSelector from "../YearSelector";

interface MonthYearSelectorProps {
  currentMonth: number; // 0-11
  currentYear: number;
  onMonthYearChange: (month: number, year: number) => void;
}

/**
 * ‹ Month Year › Today. One row at every width: on phones it fills the row,
 * the month select stretches, and "Today" becomes an icon.
 */
const MonthYearSelector = ({
  currentMonth,
  currentYear,
  onMonthYearChange,
}: MonthYearSelectorProps) => {
  const months = getMonthLabels();

  const handlePrevious = () => {
    if (currentMonth === 0) {
      onMonthYearChange(11, currentYear - 1);
    } else {
      onMonthYearChange(currentMonth - 1, currentYear);
    }
  };

  const handleNext = () => {
    if (currentMonth === 11) {
      onMonthYearChange(0, currentYear + 1);
    } else {
      onMonthYearChange(currentMonth + 1, currentYear);
    }
  };

  const handleMonthChange = (monthIndex: string) => {
    onMonthYearChange(parseInt(monthIndex), currentYear);
  };

  const handleYearChange = (year: number) => {
    onMonthYearChange(currentMonth, year);
  };

  const label = months[currentMonth];

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto sm:gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={handlePrevious}
        className="size-9 shrink-0"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
        <SelectTrigger aria-label="Month" className="min-w-0 flex-1 px-2.5 sm:w-32 sm:flex-none sm:px-3">
          <SelectValue>
            {/* Narrow phones get "Sep" so the row never wraps or cuts off. */}
            <span className="min-[24rem]:hidden">{label.slice(0, 3)}</span>
            <span className="hidden min-[24rem]:inline">{label}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {months.map((month, index) => (
            <SelectItem key={month} value={index.toString()}>
              {month}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <YearSelector
        value={currentYear}
        onValueChange={handleYearChange}
        range={10}
        triggerClassName="w-[5rem] shrink-0 px-2.5 sm:w-24 sm:px-3"
      />

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        className="size-9 shrink-0"
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>

      <Button
        variant="ghost"
        onClick={() => {
          const now = new Date();
          onMonthYearChange(now.getMonth(), now.getFullYear());
        }}
        // Hidden on the very narrowest phones (320px) so the month stays readable.
        className="size-9 shrink-0 px-0 max-[22rem]:hidden sm:h-9 sm:w-auto sm:px-3"
        aria-label="Go to this month"
        title="Today"
      >
        <CalendarCheck className="size-4 sm:hidden" aria-hidden />
        <span className="hidden sm:inline">Today</span>
      </Button>
    </div>
  );
};

export default MonthYearSelector;
