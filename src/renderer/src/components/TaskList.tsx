import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task } from '../../../shared/types'
import TaskItem from './TaskItem'

interface Props {
  tasks: Task[]
  onToggle: (id: number, completed: boolean) => void
  onUpdate: (id: number, fields: { title?: string; notes?: string; links?: string[]; tags?: string[] }) => void
  onDelete: (id: number) => void
  onReorder: (orderedIds: number[]) => void
  onNavigateToTemplate?: (templateId: number) => void
  readonly?: boolean
  emptyMessage?: string
  collapsibleDone?: boolean
}

export default function TaskList({
  tasks,
  onToggle,
  onUpdate,
  onDelete,
  onReorder,
  onNavigateToTemplate,
  readonly,
  emptyMessage = 'No tasks yet — add one above',
  collapsibleDone = false
}: Props) {
  const [showDone, setShowDone] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const incomplete = tasks.filter((t) => !t.completed)
  const complete = tasks.filter((t) => t.completed)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = incomplete.findIndex((t) => t.id === active.id)
    const newIndex = incomplete.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...incomplete]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    onReorder([...reordered.map((t) => t.id), ...complete.map((t) => t.id)])
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 text-ghost text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={incomplete.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {incomplete.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onNavigateToTemplate={onNavigateToTemplate}
              readonly={readonly}
            />
          ))}
        </SortableContext>
      </DndContext>

      {complete.length > 0 && (
        <div className="pt-3">
          {collapsibleDone ? (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="w-full px-3 pb-1 flex items-center gap-2 text-left"
              aria-expanded={showDone}
            >
              <div className="flex-1 h-px bg-rim" />
              <span className="text-xs text-ghost font-medium uppercase tracking-wider">
                Done ({complete.length})
              </span>
              <span className="text-xs text-ghost font-medium leading-none">
                {showDone ? '▲' : '▼'}
              </span>
              <div className="flex-1 h-px bg-rim" />
            </button>
          ) : (
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
              <div className="flex-1 h-px bg-rim" />
              <span className="text-xs text-ghost font-medium uppercase tracking-wider">
                Done ({complete.length})
              </span>
              <div className="flex-1 h-px bg-rim" />
            </div>
          )}
          {(!collapsibleDone || showDone) && complete.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onNavigateToTemplate={onNavigateToTemplate}
              readonly={readonly}
            />
          ))}
        </div>
      )}
    </div>
  )
}
