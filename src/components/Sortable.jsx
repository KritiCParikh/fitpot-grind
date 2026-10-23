import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'

// Drag to reorder (phase 5.10). Used for a routine's exercises and for the
// exercises in a workout while you're doing it.
//
// Each row gets a grip handle (hold and drag, with mouse or finger) plus up and
// down arrows for anyone who finds dragging fiddly. Only the grip starts a
// drag, so typing in a row's inputs and scrolling the page work as usual.
// Keyboard: focus the grip, press Space, move with the arrow keys, Space again.

let n = 0
/** A row id that stays put while rows move around. Never saved. */
export const rowId = () => `row-${Date.now().toString(36)}-${++n}`

/**
 * items: the rows, each with a stable `rowId`. onChange(newItems) after a move.
 * children(item, index, controls): draws a row; put {controls} where the grip
 * and arrows should go.
 */
export default function SortableList({ items, onChange, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = items.map((x) => x.rowId)
  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return
    onChange(arrayMove(items, from, to))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={({ active, over }) => over && move(ids.indexOf(active.id), ids.indexOf(over.id))}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="sortable-list">
          {items.map((item, i) => (
            <SortableRow key={item.rowId} id={item.rowId} name={item.name} first={i === 0} last={i === items.length - 1}
              onUp={() => move(i, i - 1)} onDown={() => move(i, i + 1)}>
              {(controls) => children(item, i, controls)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, name, first, last, onUp, onDown, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? 5 : undefined }
  const controls = (
    <span className="reorder">
      <button type="button" className="grip" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Drag to move ${name}`}>
        <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
          {[4, 10, 16].map((y) => <g key={y}><circle cx="4" cy={y} r="1.8" /><circle cx="10" cy={y} r="1.8" /></g>)}
        </svg>
      </button>
      <button type="button" className="move" onClick={onUp} disabled={first} aria-label={`Move ${name} up`}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
      </button>
      <button type="button" className="move" onClick={onDown} disabled={last} aria-label={`Move ${name} down`}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </span>
  )
  return (
    <div ref={setNodeRef} style={style} className={`sortable-row ${isDragging ? 'dragging' : ''}`}>
      {children(controls)}
    </div>
  )
}
