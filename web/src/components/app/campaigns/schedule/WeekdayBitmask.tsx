// Active-days picker — a grid of 7 day pills backed by a uint8 day-of-week
// bitmask (bit i = weekday i). On-theme: sky-600 active, slate idle, h-7
// rounded-md pills. Mirrors the create wizard's ScheduleStep.

export default function WeekdayBitmask({
    weekdays,
    value,
    setValue,
}: {
    weekdays: string[];
    value: number;
    setValue: (v: number) => void;
}) {
    return (
        <div className="grid grid-cols-7 gap-1.5">
            {weekdays.map((day, index) => {
                const mask = 1 << index;
                const active = (value & mask) !== 0;
                return (
                    <button
                        key={day}
                        type="button"
                        aria-pressed={active}
                        title={day}
                        onClick={() => setValue(value ^ mask)}
                        className={`h-7 rounded-md text-[11.5px] font-medium transition-colors ${
                            active
                                ? "bg-sky-600 text-white"
                                : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        }`}
                    >
                        {day.slice(0, 3)}
                    </button>
                );
            })}
        </div>
    );
}
