import { useId, type KeyboardEvent, type ReactNode } from 'react';

interface TabsProps<T extends string> {
  label: string;
  tabs: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  children: ReactNode;
}

/** Onglets accessibles (modèle ARIA Tabs) : flèches, Début et Fin pour naviguer. */
export function Tabs<T extends string>({ label, tabs, value, onChange, children }: TabsProps<T>) {
  const base = useId().replace(/:/g, '');

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    document.getElementById(`${base}-tab-${tabs[next].id}`)?.focus();
  }

  return (
    <div>
      <div className="tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            id={`${base}-tab-${tab.id}`}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab.id === value}
            aria-controls={`${base}-panel`}
            tabIndex={tab.id === value ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${value}`} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}
