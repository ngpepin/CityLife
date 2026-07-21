'use client';

import React, { useEffect, useRef } from 'react';
import type { CityLifeSnapshot, NodeAttribution } from '@/lib/citylife';

type MetricAttribution = {
  positive: NodeAttribution[];
  negative: NodeAttribution[];
};

type MetricCardProps = {
  label: string;
  total: number;
  attribution: MetricAttribution;
  barClassName: string;
};

function formatSigned(value: number, precision = 2): string {
  if (Math.abs(value) < 0.005) return (0).toFixed(precision);
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(precision)}`;
}

function contributionClassName(value: number): string {
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-rose-300';
  return 'text-slate-400';
}

function AttributionList({
  title,
  items,
  kind,
}: {
  title: string;
  items: NodeAttribution[];
  kind: 'positive' | 'negative';
}) {
  const emptyMessage = kind === 'positive'
    ? 'No positive activity contributions.'
    : 'No negative activity contributions.';

  return (
    <div>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="min-w-0 break-words text-slate-200">{item.name}</span>
              <span className={`shrink-0 font-mono font-semibold ${contributionClassName(item.value)}`}>
                {formatSigned(item.value)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MetricCard({ label, total, attribution, barClassName }: MetricCardProps) {
  const boundedTotal = Math.max(0, Math.min(100, total));

  return (
    <section
      aria-labelledby={`citylife-insights-${label.toLowerCase()}-heading`}
      className="rounded-lg border border-white/10 bg-slate-900/65 p-4"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3
          id={`citylife-insights-${label.toLowerCase()}-heading`}
          className="font-semibold text-white"
        >
          {label}
        </h3>
        <span className="font-mono text-xl font-semibold text-white">{total.toFixed(1)}</span>
      </div>
      <div
        className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label={`${label} score`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(total.toFixed(1))}
      >
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${boundedTotal}%` }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <AttributionList title="Top positive" items={attribution.positive} kind="positive" />
        <AttributionList title="Top negative" items={attribution.negative} kind="negative" />
      </div>
    </section>
  );
}

function ReadinessNames({ names, emptyMessage }: { names: string[]; emptyMessage: string }) {
  if (names.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ul className="mt-2 space-y-1 text-xs text-slate-300">
      {names.map((name, index) => (
        <li key={`${name}-${index}`} className="flex gap-2">
          <span aria-hidden="true" className="text-slate-500">
            •
          </span>
          <span className="break-words">{name}</span>
        </li>
      ))}
    </ul>
  );
}

export function CityLifeInsightsPanel({
  snapshot,
  onClose,
}: {
  snapshot: CityLifeSnapshot;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const activeNodes = snapshot.nodes.filter((node) => node.active);
  const inactiveNodes = snapshot.nodes.filter((node) => !node.active);
  const activeWithoutRelationships = activeNodes.filter((node) => node.relationshipCount === 0);
  const strongestRelationships = [...snapshot.edges]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-2 sm:p-4 lg:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="citylife-insights-title"
        aria-describedby="citylife-insights-description"
        tabIndex={-1}
        className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/15 bg-slate-950 text-slate-100 shadow-2xl sm:max-h-[92vh]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-slate-900/85 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 id="citylife-insights-title" className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Why your scores look this way
            </h2>
            <p id="citylife-insights-description" className="mt-1 max-w-3xl text-xs leading-5 text-slate-400 sm:text-sm">
              Scores combine road-ready activities with modeled relationships. Use them as planning signals for exploring tradeoffs, not as predictions about your life.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close score insights"
            className="shrink-0 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/35 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <section aria-labelledby="citylife-insights-scores-heading">
            <div className="mb-3">
              <h2 id="citylife-insights-scores-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Score breakdown
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Attribution values include each activity&apos;s base effect and its share of relationship effects.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <MetricCard
                label="Income"
                total={snapshot.income}
                attribution={snapshot.topIncome}
                barClassName="bg-cyan-400"
              />
              <MetricCard
                label="Happiness"
                total={snapshot.happiness}
                attribution={snapshot.topHappiness}
                barClassName="bg-emerald-400"
              />
              <MetricCard
                label="Wellness"
                total={snapshot.wellness}
                attribution={snapshot.topWellness}
                barClassName="bg-indigo-400"
              />
            </div>
          </section>

          <section aria-labelledby="citylife-insights-readiness-heading" className="mt-7">
            <div className="mb-3">
              <h2 id="citylife-insights-readiness-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Readiness
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Road adjacency makes an activity active. Relationships also require a qualifying road path and a modeled category effect.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/5 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-emerald-100">Road-adjacent</h3>
                  <span className="font-mono text-2xl font-semibold text-emerald-300">{activeNodes.length}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">Active activities that can contribute to scores.</p>
                <ReadinessNames
                  names={activeNodes.map((node) => node.name)}
                  emptyMessage="No activities are road-adjacent yet."
                />
              </div>

              <div className="rounded-lg border border-amber-300/20 bg-amber-400/5 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-amber-100">Needs a road</h3>
                  <span className="font-mono text-2xl font-semibold text-amber-300">{inactiveNodes.length}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">Inactive activities that do not currently affect scores.</p>
                <ReadinessNames
                  names={inactiveNodes.map((node) => node.name)}
                  emptyMessage="Every activity is road-adjacent."
                />
              </div>

              <div className="rounded-lg border border-sky-300/20 bg-sky-400/5 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-sky-100">No relationships</h3>
                  <span className="font-mono text-2xl font-semibold text-sky-300">
                    {activeWithoutRelationships.length}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Road-adjacent, but with no qualifying relationship in this snapshot.
                </p>
                <ReadinessNames
                  names={activeWithoutRelationships.map((node) => node.name)}
                  emptyMessage="Every active activity has at least one modeled relationship."
                />
              </div>
            </div>
          </section>

          <section aria-labelledby="citylife-insights-relationships-heading" className="mt-7">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="citylife-insights-relationships-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Strongest relationships
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Shorter road paths generally produce stronger weights. Deltas show the modeled effect of each pair.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Showing {strongestRelationships.length} of {snapshot.edges.length}
              </span>
            </div>

            {strongestRelationships.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-slate-400">
                No qualifying relationships yet. Connect active activities through roads or place them closer together.
              </div>
            ) : (
              <ol className="space-y-2">
                {strongestRelationships.map((edge) => {
                  const source = nodeById.get(edge.sourceId);
                  const target = nodeById.get(edge.targetId);

                  return (
                    <li
                      key={`${edge.sourceId}-${edge.targetId}`}
                      className="rounded-lg border border-white/10 bg-slate-900/55 p-3 sm:p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-semibold text-white">
                            {source?.name ?? 'Unknown activity'}
                            <span aria-hidden="true" className="mx-2 text-slate-500">
                              ↔
                            </span>
                            <span className="sr-only">and</span>
                            {target?.name ?? 'Unknown activity'}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            Road distance <span className="font-mono text-slate-200">{edge.distance}</span>
                            <span aria-hidden="true" className="mx-2 text-slate-600">
                              •
                            </span>
                            Weight <span className="font-mono text-slate-200">{edge.weight.toFixed(2)}</span>
                          </p>
                        </div>

                        <dl className="grid shrink-0 grid-cols-3 gap-2 text-xs sm:gap-3">
                          <div className="rounded bg-black/20 px-2 py-1.5 text-center">
                            <dt className="text-slate-500">Income</dt>
                            <dd className={`mt-0.5 font-mono font-semibold ${contributionClassName(edge.delta.income)}`}>
                              {formatSigned(edge.delta.income)}
                            </dd>
                          </div>
                          <div className="rounded bg-black/20 px-2 py-1.5 text-center">
                            <dt className="text-slate-500">Happiness</dt>
                            <dd className={`mt-0.5 font-mono font-semibold ${contributionClassName(edge.delta.happiness)}`}>
                              {formatSigned(edge.delta.happiness)}
                            </dd>
                          </div>
                          <div className="rounded bg-black/20 px-2 py-1.5 text-center">
                            <dt className="text-slate-500">Wellness</dt>
                            <dd className={`mt-0.5 font-mono font-semibold ${contributionClassName(edge.delta.wellness)}`}>
                              {formatSigned(edge.delta.wellness)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <aside className="mt-7 rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-4 text-xs leading-5 text-slate-300">
            <strong className="text-cyan-100">Interpret with care.</strong>{' '}
            CityLife scores are simplified planning signals based on the categories and roads in this model. They are not forecasts, diagnoses, or judgments about what you should do.
          </aside>
        </div>
      </div>
    </div>
  );
}
