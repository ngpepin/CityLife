'use client';

import React, { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import type { CityLifeNode, CityLifeNodeMetadata, CityLifeNodeStatus } from '@/lib/citylife';

type CityLifeNodeEditorProps = {
  node: CityLifeNode;
  onSave: (metadata: CityLifeNodeMetadata) => void;
  onClose: () => void;
};

type Priority = CityLifeNodeMetadata['priority'];
type Task = CityLifeNodeMetadata['tasks'][number];

const STATUS_OPTIONS: Array<{ value: CityLifeNodeStatus; label: string }> = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const fieldClassName =
  'w-full rounded-md border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/15';

function cloneMetadata(metadata: CityLifeNodeMetadata): CityLifeNodeMetadata {
  return {
    ...metadata,
    tasks: metadata.tasks.map((task) => ({ ...task })),
  };
}

function createTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function CityLifeNodeEditor({ node, onSave, onClose }: CityLifeNodeEditorProps) {
  const [draft, setDraft] = useState<CityLifeNodeMetadata>(() => cloneMetadata(node.metadata));
  const [newTaskText, setNewTaskText] = useState('');
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const notesId = useId();
  const nextActionId = useId();
  const statusId = useId();
  const priorityId = useId();
  const dueDateId = useId();
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    titleInputRef.current?.focus();
    titleInputRef.current?.select();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusableElements = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && document.contains(previousActiveElement)) {
        previousActiveElement.focus();
      }
    };
  }, [onClose]);

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setDraft((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
    }));
  };

  const deleteTask = (taskId: string) => {
    setDraft((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  };

  const addTask = () => {
    const text = newTaskText.trim();
    if (!text) return;

    setDraft((current) => ({
      ...current,
      tasks: [...current.tasks, { id: createTaskId(), text, done: false }],
    }));
    setNewTaskText('');
  };

  const handleNewTaskKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addTask();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      titleInputRef.current?.focus();
      return;
    }

    onSave({
      ...draft,
      title,
      notes: draft.notes.trim(),
      nextAction: draft.nextAction.trim(),
      dueDate: draft.dueDate || undefined,
      tasks: draft.tasks.map((task) => ({ ...task, text: task.text.trim() })),
      updatedAt: Date.now(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        aria-describedby={dialogDescriptionId}
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/15 bg-slate-900 shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-3rem)]"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-slate-950/70 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 id={dialogTitleId} className="truncate text-lg font-semibold text-white">
                Edit commitment
              </h2>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  node.active
                    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'
                    : 'border-amber-300/30 bg-amber-400/10 text-amber-200'
                }`}
              >
                {node.active ? 'Road active' : 'Needs road'}
              </span>
            </div>
            <p id={dialogDescriptionId} className="text-xs text-slate-400">
              {formatCategory(node.category)} · Tile ({node.x}, {node.y})
            </p>
          </div>
          <button
            type="button"
            aria-label="Close commitment editor"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-xl leading-none text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor={titleId}>
                Title
              </label>
              <input
                ref={titleInputRef}
                id={titleId}
                className={fieldClassName}
                maxLength={120}
                placeholder="What does this building represent?"
                required
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor={statusId}>
                  Status
                </label>
                <select
                  id={statusId}
                  className={fieldClassName}
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      status: event.target.value as CityLifeNodeStatus,
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor={priorityId}>
                  Priority
                </label>
                <select
                  id={priorityId}
                  className={fieldClassName}
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, priority: event.target.value as Priority }))
                  }
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor={dueDateId}>
                  Due date <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id={dueDateId}
                  className={`${fieldClassName} [color-scheme:dark]`}
                  type="date"
                  value={draft.dueDate ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, dueDate: event.target.value || undefined }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor={nextActionId}>
                Next action
              </label>
              <input
                id={nextActionId}
                className={fieldClassName}
                maxLength={180}
                placeholder="The smallest concrete step you can take next"
                value={draft.nextAction}
                onChange={(event) => setDraft((current) => ({ ...current, nextAction: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor={notesId}>
                Notes
              </label>
              <textarea
                id={notesId}
                className={`${fieldClassName} min-h-28 resize-y`}
                maxLength={2000}
                placeholder="Context, constraints, or anything useful to remember"
                rows={4}
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            <fieldset className="space-y-3 rounded-lg border border-white/10 bg-slate-950/35 p-3 sm:p-4">
              <legend className="px-1 text-sm font-medium text-slate-200">Task checklist</legend>

              {draft.tasks.length === 0 ? (
                <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                  No tasks yet. Add a concrete step below.
                </p>
              ) : (
                <ul className="space-y-2">
                  {draft.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-900/75 p-2"
                    >
                      <input
                        aria-label={`Mark ${task.text || 'task'} as ${task.done ? 'not done' : 'done'}`}
                        checked={task.done}
                        className="h-4 w-4 shrink-0 rounded border-white/25 bg-slate-950 accent-cyan-400 focus:ring-2 focus:ring-cyan-300/60"
                        type="checkbox"
                        onChange={(event) => updateTask(task.id, { done: event.target.checked })}
                      />
                      <input
                        aria-label="Task text"
                        className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none transition focus:border-cyan-300/50 focus:bg-slate-950/70 ${
                          task.done ? 'text-slate-500 line-through' : 'text-slate-200'
                        }`}
                        maxLength={240}
                        value={task.text}
                        onChange={(event) => updateTask(task.id, { text: event.target.value })}
                      />
                      <button
                        type="button"
                        aria-label={`Delete ${task.text || 'task'}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded text-lg text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-300/50"
                        onClick={() => deleteTask(task.id)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="New task"
                  className={fieldClassName}
                  maxLength={240}
                  placeholder="Add a task"
                  value={newTaskText}
                  onChange={(event) => setNewTaskText(event.target.value)}
                  onKeyDown={handleNewTaskKeyDown}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!newTaskText.trim()}
                  onClick={addTask}
                >
                  Add task
                </button>
              </div>
            </fieldset>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 bg-slate-950/70 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-cyan-300/50 bg-cyan-400/20 px-5 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/30 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!draft.title.trim()}
            >
              Save commitment
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
