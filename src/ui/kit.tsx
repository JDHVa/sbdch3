/**
 * Piezas de interfaz reutilizables: íconos (Bootstrap Icons), tarjetas,
 * interruptores y controles segmentados.
 */

import type { ReactNode } from 'react';

/** Ícono de Bootstrap Icons por nombre (sin el prefijo `bi-`). */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <i className={`bi bi-${name} ${className}`} aria-hidden="true" />;
}

export function Card({
  icon,
  title,
  right,
  children,
}: {
  icon: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <header className="card-head">
        <span className="card-icon">
          <Icon name={icon} />
        </span>
        <h2>{title}</h2>
        {right && <div className="card-right">{right}</div>}
      </header>
      {children}
    </section>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track">
        <span className="switch-thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}

export interface SegmentOption<T> {
  value: T;
  label?: string;
  icon?: string;
  title?: string;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  stretch = false,
  className = '',
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  stretch?: boolean;
  className?: string;
}) {
  return (
    <div className={`segmented ${stretch ? 'stretch' : ''} ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          title={o.title ?? o.label}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} />}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}
