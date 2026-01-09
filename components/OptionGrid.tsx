'use client';
/* eslint-disable @next/next/no-img-element */
import React from 'react';

export type Option = {
  id: string;
  label: string;
  priceDelta?: number;
  imageUrl?: string;
  length?: number; // meters
  width?: number; // meters
  dropThrough?: boolean;
};

type Props = {
  options: Option[];
  mode: 'single' | 'multi';
  selected: string[]; // array of ids (single mode uses first element)
  onChange: (next: string[]) => void;
};

function metersToInches(m?: number) {
  if (!m) return null;
  return `${(m * 39.3701).toFixed(1)}"`;
}

export default function OptionGrid({ options, mode, selected, onChange }: Props) {
  function toggle(id: string) {
    if (mode === 'single') {
      onChange([id]);
    } else {
      if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
      else onChange([...selected, id]);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (mode !== 'single') return;
    const idx = options.findIndex((o) => o.id === selected[0]);
    if (idx === -1) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const next = (idx - 1 + options.length) % options.length;
      onChange([options[next].id]);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const next = (idx + 1) % options.length;
      onChange([options[next].id]);
      e.preventDefault();
    } else if (e.key === 'Home') {
      onChange([options[0].id]);
      e.preventDefault();
    } else if (e.key === 'End') {
      onChange([options[options.length - 1].id]);
      e.preventDefault();
    }
  }

  return (
    <div
      role="listbox"
      aria-multiselectable={mode === 'multi'}
      tabIndex={0}
      onKeyDown={onKey}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}
    >
      {options.map((o) => {
        const isSelected = selected.includes(o.id);
        const lengthIn = metersToInches(o.length);
        const widthIn = metersToInches(o.width);
        const ariaLabelParts = [o.label];
        if (lengthIn && widthIn) ariaLabelParts.push(`${lengthIn} × ${widthIn}`);
        ariaLabelParts.push(o.priceDelta ? `+$${o.priceDelta}` : 'Included');
        const ariaLabel = ariaLabelParts.join(', ');

        return (
          <button
            key={o.id}
            role="option"
            aria-selected={isSelected}
            aria-label={ariaLabel}
            onClick={() => toggle(o.id)}
            className={`optionCard ${isSelected ? 'optionCard--selected' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'center',
              padding: 12,
              borderRadius: 8,
              border: isSelected ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.04)',
              background: isSelected ? 'rgba(34,197,94,0.04)' : 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'transform .12s ease, box-shadow .12s ease'
            }}
          >
            <div className="thumb" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {o.imageUrl ? (
                <img src={o.imageUrl} alt="" className="thumbImg" />
              ) : (
                <div className="thumbPlaceholder" />
              )}
            </div>

            <div style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {o.dropThrough && <div className="badge drop" aria-hidden>Drop-through</div>}
              <div className="dims" aria-hidden>{lengthIn && widthIn ? `${lengthIn} × ${widthIn}` : ''}</div>
            </div>

            <div className="price" style={{ fontSize: 12, color: 'var(--muted)' }}>{o.priceDelta ? `+$${o.priceDelta}` : 'Included'}</div>
          </button>
        );
      })}
    </div>
  );
}
