// components/recipe/IngredientList.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { Copy, RotateCcw } from 'lucide-react';

import { useCookStore } from '@/stores/cookStore';
import { cn } from '@/lib/utils';
import {
  formatMeasure,
  normalizeUnit,
  scaleQuantity,
  type Unit,
} from '@/lib/units';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export type IngredientItem = {
  id?: string;
  name: string;
  quantity?: number | null;
  unit?: string | null; // will be normalized
  preparation?: string | null;
  optional?: boolean | null;
  alternatives?: string[] | null;
  measureRaw?: string | null; // e.g., "to taste"
};

export type IngredientSection = {
  title?: string | null;
  items: IngredientItem[];
};

export type IngredientListProps = {
  sections: IngredientSection[];
  recipeKey?: string; // for persisting checkmarks per recipe (slug or id)
  className?: string;
  showHeader?: boolean; // show top controls bar (toggle optional, copy, reset)
};

export default function IngredientList({
  sections,
  recipeKey,
  className,
  showHeader = true,
}: IngredientListProps) {
  const [units, scale, servings] = useCookStore(
    (s) => [s.units, s.scale, s.servings],
    shallow
  );

  const [showOptional, setShowOptional] = useState(true);
  const storageKey = useMemo(
    () => (recipeKey ? `sourkimchi:mise:${recipeKey}` : `sourkimchi:mise`),
    [recipeKey]
  );

  // Checked state for mise en place
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Load from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Persist to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      // ignore
    }
  }, [checked, storageKey]);

  // Build a stable key for each ingredient
  const keyFor = (secIdx: number, idx: number, ing: IngredientItem) =>
    ing.id || `${secIdx}-${idx}-${slugifyLoose(ing.name)}`;

  // Filtered sections (respecting optional toggle)
  const filtered = useMemo(() => {
    const hideOptional = !showOptional;
    return sections.map((sec) => ({
      ...sec,
      items: hideOptional ? sec.items.filter((i) => !i.optional) : sec.items,
    }));
  }, [sections, showOptional]);

  // Copy to clipboard (plain text)
  const handleCopy = async () => {
    const lines: string[] = [];
    filtered.forEach((sec) => {
      if (sec.title && sec.items.length) lines.push(`# ${sec.title}`);
      sec.items.forEach((ing) => lines.push(formatIngredientLine(ing, units, scale())));
      if (sec.items.length) lines.push(''); // blank line between sections
    });
    const text = lines.join('\n').trim();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const handleResetChecks = () => setChecked({});

  return (
    <div className={cn('space-y-4', className)}>
      {showHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Show optional</span>
            <Switch checked={showOptional} onCheckedChange={(v) => setShowOptional(!!v)} />
            {typeof servings === 'number' && (
              <Badge variant="secondary" className="ml-2">
                Servings: {servings}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleResetChecks}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset checks
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy list
            </Button>
          </div>
        </div>
      )}

      {filtered.map((sec, sIdx) => (
        <section key={sIdx} className="space-y-2">
          {sec.title ? (
            <>
              <h3 className="text-base font-semibold">{sec.title}</h3>
              <Separator />
            </>
          ) : null}

          <ul className="space-y-2">
            {sec.items.map((ing, iIdx) => {
              const id = keyFor(sIdx, iIdx, ing);
              const isChecked = !!checked[id];
              const line = formatIngredientLine(ing, units, scale());
              const isOptional = !!ing.optional;
              const alts = ing.alternatives?.filter(Boolean) ?? [];
              return (
                <li
                  key={id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3',
                    isChecked ? 'opacity-60' : ''
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(v) =>
                      setChecked((prev) => ({ ...prev, [id]: !!v }))
                    }
                    className="mt-0.5"
                    aria-label={`Check ${ing.name}`}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('leading-snug', isChecked && 'line-through')}>
                        {line}
                        {ing.measureRaw && !hasStructuredMeasure(ing) ? (
                          <span className="text-muted-foreground"> — {ing.measureRaw}</span>
                        ) : null}
                        {ing.preparation ? (
                          <span className="text-muted-foreground"> ({ing.preparation})</span>
                        ) : null}
                      </span>
                      {isOptional && <Badge variant="outline">optional</Badge>}
                    </div>
                    {alts.length ? (
                      <div className="mt-1 text-sm text-muted-foreground">
                        or: {alts.join(', ')}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* =========================
   Helpers
   ========================= */

function hasStructuredMeasure(ing: IngredientItem) {
  return typeof ing.quantity === 'number' || !!ing.unit;
}

function formatIngredientLine(
  ing: IngredientItem,
  unitsPref: 'metric' | 'imperial',
  scaleFactor: number
): string {
  const qty = typeof ing.quantity === 'number' ? scaleQuantity(ing.quantity, scaleFactor) : undefined;
  const unit = normalizeUnit(ing.unit || undefined) as Unit | undefined;

  const measure =
    qty != null || unit
      ? formatMeasure(qty, unit, {
          targetSystem: unitsPref,
          preferLarger: true,
          unicodeFractions: true,
          maxDenominator: 8,
        })
      : '';

  const name = ing.name;
  return [measure, name].filter(Boolean).join(' ');
}

function slugifyLoose(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}