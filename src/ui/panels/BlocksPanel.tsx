import { formatClock } from "../../core/time/minutes";
import { getDoc, selectSchedule, useStore } from "../../state/store";
import { Button, Panel } from "../controls";
import styles from "./BlocksPanel.module.css";

export function BlocksPanel() {
  const doc = useStore(getDoc);
  const schedule = useStore(selectSchedule);
  const selectedId = useStore((state) => state.selectedId);
  const select = useStore((state) => state.select);
  const addBlock = useStore((state) => state.addBlock);
  const deleteBlock = useStore((state) => state.deleteBlock);
  const reorderBlock = useStore((state) => state.reorderBlock);
  const updateBlock = useStore((state) => state.updateBlock);

  return (
    <Panel title="Blocks">
      {doc.lanes.map((lane) => {
        const blocks = doc.blocks.filter((block) => block.lane === lane);
        return (
          <div key={lane} className={styles.lane}>
            <div className={styles.laneHead}>
              <span className={styles.laneName}>{lane}</span>
              <Button variant="quiet" onClick={() => addBlock(lane)} title={`Add a block to ${lane}`}>
                + Add
              </Button>
            </div>

            {blocks.length === 0 && <p className={styles.empty}>Nothing in this lane yet.</p>}

            <ul className={styles.list}>
              {blocks.map((block) => {
                const entry = schedule.positions.get(block.id);
                const trouble = schedule.byBlock.get(block.id) ?? [];
                return (
                  <li
                    key={block.id}
                    className={[
                      styles.item,
                      selectedId === block.id ? styles.selected : "",
                      trouble.some((c) => c.severity === "conflict") ? styles.conflict : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button type="button" className={styles.pick} onClick={() => select(block.id)}>
                      <span className={styles.time}>
                        {entry ? formatClock(entry.startMin) : "--:--"}
                      </span>
                      <span className={styles.label}>{block.label}</span>
                      {block.anchorMin !== null && <span className={styles.pin} title="Anchored" />}
                    </button>
                    <span className={styles.actions}>
                      <button
                        type="button"
                        className={styles.icon}
                        title="Move earlier in this lane"
                        onClick={() => reorderBlock(block.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.icon}
                        title="Move later in this lane"
                        onClick={() => reorderBlock(block.id, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={styles.icon}
                        title="Delete"
                        onClick={() => deleteBlock(block.id)}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div className={styles.bulk}>
        <Button
          variant="quiet"
          onClick={() => {
            const everyGuest = doc.blocks.every((block) => block.outputs.includes("order-of-day"));
            for (const block of doc.blocks) {
              updateBlock(block.id, {
                outputs: everyGuest
                  ? block.outputs.filter((output) => output !== "order-of-day")
                  : [...new Set([...block.outputs, "order-of-day" as const])],
              });
            }
          }}
          title="Put every block on the guest order of the day, or take them all off"
        >
          Toggle all on the order of the day
        </Button>
      </div>
    </Panel>
  );
}
