'use client';

import React, { useEffect, useId, useRef } from 'react';

type CityLifeOnboardingProps = {
  onChooseBlank: () => void;
  onChooseExample: () => void;
  onImport: () => void;
};

const concepts = [
  {
    eyebrow: 'Activities',
    title: 'Build what matters',
    description: 'Each building represents a commitment, routine, project, or source of support in your life.',
    accent: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
    icon: '◆',
  },
  {
    eyebrow: 'Access',
    title: 'Connect with roads',
    description: 'A road makes an adjacent activity active. Road distance shapes how connected activities influence one another.',
    accent: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
    icon: '┿',
  },
  {
    eyebrow: 'Balance',
    title: 'Read the signals',
    description: 'Income, Happiness, and Wellness help you compare arrangements. They are planning signals, not predictions.',
    accent: 'border-indigo-300/25 bg-indigo-400/10 text-indigo-100',
    icon: '◒',
  },
] as const;

export function CityLifeOnboarding({
  onChooseBlank,
  onChooseExample,
  onImport,
}: CityLifeOnboardingProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    primaryActionRef.current?.focus({ preventScroll: true });

    const keepFocusInDialog = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', keepFocusInDialog);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', keepFocusInDialog);
      if (previousActiveElement && document.contains(previousActiveElement)) {
        previousActiveElement.focus();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-44 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <main className="relative flex min-h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <section
          ref={dialogRef}
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-slate-900/90 shadow-2xl shadow-black/50 backdrop-blur-xl"
          role="dialog"
        >
          <div className="border-b border-white/10 px-5 py-7 text-center sm:px-10 sm:py-10">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/20 to-indigo-400/15 shadow-lg shadow-cyan-950/40">
              <div className="relative h-8 w-9" aria-hidden="true">
                <span className="absolute bottom-0 left-0 h-4 w-4 rotate-45 border border-cyan-100/70 bg-cyan-300/70" />
                <span className="absolute bottom-1 right-0 h-5 w-5 rotate-45 border border-indigo-100/70 bg-indigo-300/65" />
                <span className="absolute left-3 top-0 h-5 w-5 rotate-45 border border-emerald-100/70 bg-emerald-300/70" />
              </div>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Welcome to CityLife</p>
            <h1 id={titleId} className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Turn your commitments into a city you can reason about.
            </h1>
            <p id={descriptionId} className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Arrange the activities in your life, connect what supports them, and explore tradeoffs without flattening everything into another list.
            </p>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-3 md:grid-cols-3">
              {concepts.map((concept) => (
                <article key={concept.eyebrow} className="rounded-xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-lg ${concept.accent}`}
                    >
                      {concept.icon}
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {concept.eyebrow}
                    </p>
                  </div>
                  <h2 className="text-base font-semibold text-white">{concept.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{concept.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-xs leading-5 text-slate-400 sm:text-sm">
              <svg
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 0h10.5a1.5 1.5 0 0 1 1.5 1.5v7.5H5.25V12a1.5 1.5 0 0 1 1.5-1.5Z" />
              </svg>
              <p>
                Your CityLife workspace autosaves in this browser. Use Export whenever you want a portable backup.
              </p>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-[1.35fr_1fr_1fr]">
              <button
                ref={primaryActionRef}
                type="button"
                className="group rounded-xl border border-cyan-200/55 bg-cyan-400/20 p-4 text-left transition hover:border-cyan-100/75 hover:bg-cyan-400/30 focus:outline-none focus:ring-2 focus:ring-cyan-200/80 focus:ring-offset-2 focus:ring-offset-slate-900"
                onClick={onChooseExample}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold text-cyan-50">Explore an example</span>
                  <span className="text-xl text-cyan-200 transition group-hover:translate-x-0.5" aria-hidden="true">
                    →
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-5 text-cyan-100/70">
                  Learn by editing a ready-made CityLife map.
                </span>
                <span className="mt-3 inline-flex rounded-full bg-cyan-100/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-100">
                  Recommended
                </span>
              </button>

              <button
                type="button"
                className="rounded-xl border border-white/20 bg-white/[0.055] p-4 text-left transition hover:border-white/35 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-slate-900"
                onClick={onChooseBlank}
              >
                <span className="text-base font-semibold text-white">Start with a blank city</span>
                <span className="mt-1 block text-sm leading-5 text-slate-400">
                  Create your own workspace from the ground up.
                </span>
              </button>

              <button
                type="button"
                className="rounded-xl border border-dashed border-white/15 bg-transparent p-4 text-left transition hover:border-white/30 hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                onClick={onImport}
              >
                <span className="text-base font-medium text-slate-200">Import a workspace</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">
                  Continue from a CityLife JSON export.
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
