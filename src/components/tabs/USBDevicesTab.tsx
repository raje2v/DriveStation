import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useGamepadStore, GamepadInfo } from "../../stores/gamepadStore";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Horizontal axis bar with numeric value */
function AxisBar({ index, value }: { index: number; value: number }) {
  const pct = Math.abs(value) * 50;
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-2 h-5">
      <span className="text-[10px] text-ds-text-dim w-3 text-right font-mono">
        {index}
      </span>
      <div className="flex-1 h-3 bg-ds-bg rounded-sm relative overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-ds-border z-10" />
        <div
          className="absolute top-0 bottom-0 bg-ds-green transition-all duration-75"
          style={{
            left: isPositive ? "50%" : `${50 - pct}%`,
            width: `${pct}%`,
          }}
        />
      </div>
      <span className="text-[10px] font-mono text-ds-text-dim w-10 text-right">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

/** Button indicator circle */
function ButtonDot({ index, pressed }: { index: number; pressed: boolean }) {
  return (
    <div
      className={`w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-bold transition-colors ${
        pressed
          ? "bg-ds-green border-ds-green text-black"
          : "bg-ds-bg border-ds-border text-ds-text-dim"
      }`}
    >
      {index + 1}
    </div>
  );
}

/** POV/D-pad display */
function POVDisplay({ angle }: { angle: number }) {
  const directions = [
    { deg: 0, x: 50, y: 10 },
    { deg: 45, x: 78, y: 22 },
    { deg: 90, x: 90, y: 50 },
    { deg: 135, x: 78, y: 78 },
    { deg: 180, x: 50, y: 90 },
    { deg: 225, x: 22, y: 78 },
    { deg: 270, x: 10, y: 50 },
    { deg: 315, x: 22, y: 22 },
  ];

  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle
          cx="50" cy="50" r="44" fill="none"
          stroke="currentColor" className="text-ds-border" strokeWidth="2"
        />
        <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" className="text-ds-border" strokeWidth="1" />
        <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" className="text-ds-border" strokeWidth="1" />
        {directions.map((d) => (
          <circle
            key={d.deg} cx={d.x} cy={d.y} r="8"
            className={angle === d.deg ? "fill-ds-green" : "fill-ds-bg stroke-ds-border"}
            strokeWidth="1"
          />
        ))}
        <circle cx="50" cy="50" r="4" className="fill-ds-border" />
      </svg>
    </div>
  );
}

/** Detailed view for a selected gamepad */
function GamepadDetail({ gp }: { gp: GamepadInfo }) {
  return (
    <div className="flex gap-6 p-4">
      <div className="flex-1 min-w-[200px]">
        <h4 className="text-[10px] text-ds-text-dim uppercase tracking-wider mb-2 font-semibold">
          Axes
        </h4>
        <div className="flex flex-col gap-1">
          {gp.axes.map((val, i) => (
            <AxisBar key={i} index={i} value={val} />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-[10px] text-ds-text-dim uppercase tracking-wider mb-2 font-semibold">
          Buttons
        </h4>
        <div className="grid grid-cols-4 gap-1.5">
          {gp.buttons.map((pressed, i) => (
            <ButtonDot key={i} index={i} pressed={pressed} />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-[10px] text-ds-text-dim uppercase tracking-wider mb-2 font-semibold">
          POV
        </h4>
        {gp.povs && gp.povs.length > 0 ? (
          <POVDisplay angle={gp.povs[0]} />
        ) : (
          <div className="text-xs text-ds-text-dim">None</div>
        )}
      </div>
    </div>
  );
}

/** Slot row content (shared between actual slot and drag overlay) */
function SlotContent({
  index,
  gamepad,
  isSelected,
  isDragging,
}: {
  index: number;
  gamepad?: GamepadInfo;
  isSelected: boolean;
  isDragging?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b border-ds-border transition-colors ${
        isDragging
          ? "bg-ds-accent/30 border-l-2 border-l-ds-accent opacity-90"
          : isSelected
            ? "bg-ds-accent/20 border-l-2 border-l-ds-accent"
            : "hover:bg-ds-panel"
      }`}
    >
      <span className="text-xs font-mono font-bold text-ds-text-dim w-3">
        {index}
      </span>
      {gamepad ? (
        <span className="text-xs truncate flex-1">{gamepad.name}</span>
      ) : (
        <span className="text-xs text-ds-text-dim italic flex-1">Empty</span>
      )}
      {gamepad && (
        <span className="text-[10px] text-ds-text-dim cursor-grab">⠿</span>
      )}
    </div>
  );
}

/** A single draggable + droppable slot */
function SlotItem({
  index,
  gamepad,
  isSelected,
  onClick,
}: {
  index: number;
  gamepad?: GamepadInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-${index}`,
    data: { slot: index },
  });

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-${index}`,
    data: { slot: index },
    disabled: !gamepad,
  });

  return (
    <div
      ref={setDropRef}
      className={`${isOver ? "ring-1 ring-ds-accent ring-inset" : ""}`}
    >
      <div
        ref={setDragRef}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`cursor-pointer ${isDragging ? "opacity-40" : ""}`}
      >
        <SlotContent
          index={index}
          gamepad={gamepad}
          isSelected={isSelected}
        />
      </div>
    </div>
  );
}

export default function USBDevicesTab() {
  const { gamepads } = useGamepadStore();
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const slot = event.active.data.current?.slot as number;
    setActiveSlot(slot);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSlot(null);

    if (!over) return;

    const fromSlot = active.data.current?.slot as number;
    const toSlot = over.data.current?.slot as number;

    if (fromSlot !== undefined && toSlot !== undefined && fromSlot !== toSlot) {
      if (isTauri()) {
        invoke("reorder_gamepads", { from: fromSlot, to: toSlot });
      }
      setSelectedSlot(toSlot);
    }
  };

  const selectedGamepad = gamepads.find((gp) => gp.slot === selectedSlot);
  const activeGamepad =
    activeSlot !== null
      ? gamepads.find((gp) => gp.slot === activeSlot)
      : undefined;

  // Build slot list (always show 6 slots, 0-5)
  const slots = Array.from({ length: 6 }, (_, i) => ({
    index: i,
    gamepad: gamepads.find((g) => g.slot === i),
  }));

  return (
    <div className="flex h-full">
      {/* Left: USB Slot List */}
      <div className="w-[200px] flex-shrink-0 border-r border-ds-border flex flex-col">
        <div className="px-3 py-2 border-b border-ds-border bg-ds-panel">
          <h3 className="text-[10px] text-ds-text-dim uppercase tracking-wider font-semibold">
            USB Order
          </h3>
          <div className="text-[9px] text-ds-text-dim mt-0.5">
            Drag to reorder
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {slots.map(({ index, gamepad }) => (
              <SlotItem
                key={index}
                index={index}
                gamepad={gamepad}
                isSelected={selectedSlot === index}
                onClick={() => setSelectedSlot(index)}
              />
            ))}
            <DragOverlay>
              {activeSlot !== null && activeGamepad ? (
                <div className="w-[200px] shadow-lg">
                  <SlotContent
                    index={activeSlot}
                    gamepad={activeGamepad}
                    isSelected={false}
                    isDragging
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Right: Controller Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedGamepad ? (
          <>
            <div className="px-4 py-2 border-b border-ds-border bg-ds-panel">
              <div className="text-sm font-medium truncate">
                {selectedGamepad.name}
              </div>
              <div className="text-[10px] text-ds-text-dim">
                Slot {selectedSlot} &middot; {selectedGamepad.axes.length} axes
                &middot; {selectedGamepad.buttons.length} buttons
                {selectedGamepad.povs?.length > 0 &&
                  ` \u00b7 ${selectedGamepad.povs.length} POV`}
              </div>
            </div>
            <GamepadDetail gp={selectedGamepad} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ds-text-dim text-sm">
            {gamepads.length === 0
              ? "No controllers connected. Plug in a USB gamepad to get started."
              : `Slot ${selectedSlot} is empty. Select a slot with a controller.`}
          </div>
        )}
      </div>
    </div>
  );
}
