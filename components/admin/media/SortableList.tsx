"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "../icons";
import styles from "./media.module.css";

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  disabled?: boolean;
  label: string;
}

/**
 * Drag-and-drop ordering for pointer users, with Move up / Move down buttons
 * so keyboard and touch users can reorder too. Moves are announced.
 */
export function SortableList<T>({ items, getId, getLabel, onReorder, renderItem, disabled, label }: SortableListProps<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(next);
    setAnnouncement(`${getLabel(item)} moved to position ${to + 1} of ${items.length}.`);
  };

  return (
    <>
      <ol className={styles.sortable} aria-label={label}>
        {items.map((item, index) => {
          const id = getId(item);
          return (
            <li
              key={id}
              className={styles.sortItem}
              data-dragging={dragId === id || undefined}
              data-over={overId === id && dragId !== id ? true : undefined}
              draggable={!disabled}
              onDragStart={(event) => {
                setDragId(id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", id);
              }}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                setOverId(id);
              }}
              onDragLeave={() => setOverId((current) => (current === id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                const from = items.findIndex((candidate) => getId(candidate) === dragId);
                setDragId(null);
                setOverId(null);
                if (from >= 0) move(from, index);
              }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
            >
              <span className={styles.handle} aria-hidden="true" title="Drag to reorder"><Icon name="grip" /></span>
              <div className={styles.sortBody}>{renderItem(item, index)}</div>
              <span className={styles.moveButtons}>
                <button type="button" className={styles.moveButton} onClick={() => move(index, index - 1)} disabled={disabled || index === 0} aria-label={`Move ${getLabel(item)} up`}><Icon name="up" /></button>
                <button type="button" className={styles.moveButton} onClick={() => move(index, index + 1)} disabled={disabled || index === items.length - 1} aria-label={`Move ${getLabel(item)} down`}><Icon name="down" /></button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </>
  );
}
