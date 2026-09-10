import clsx from "clsx";

interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-primary-200 px-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            active === tab.id
              ? "border-primary-600 text-primary-800"
              : "border-transparent text-primary-400 hover:text-primary-600"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
