import { OUTPUT_IDS, type OutputId } from "../../core/model/types";
import { formatClock, formatDuration } from "../../core/time/minutes";
import { getDoc, selectSchedule, useStore } from "../../state/store";
import {
  Button,
  CheckField,
  NumberField,
  Panel,
  Row,
  SelectField,
  TextArea,
  TextField,
  TimeField,
} from "../controls";
import styles from "./InspectorPanel.module.css";

export function InspectorPanel() {
  const doc = useStore(getDoc);
  const schedule = useStore(selectSchedule);
  const selectedId = useStore((state) => state.selectedId);
  const updateBlock = useStore((state) => state.updateBlock);
  const toggleAnchor = useStore((state) => state.toggleAnchor);

  const block = doc.blocks.find((entry) => entry.id === selectedId);
  if (!block) {
    return (
      <Panel title="Block">
        <p className={styles.none}>Pick a block on the timeline to edit it.</p>
      </Panel>
    );
  }

  const entry = schedule.positions.get(block.id);
  const headroom = schedule.slack.byBlock.get(block.id);

  return (
    <Panel title="Block">
      <TextField label="Label" value={block.label} onChange={(label) => updateBlock(block.id, { label })} />

      <Row>
        <NumberField
          label="Duration"
          value={block.durationMin}
          min={0}
          step={5}
          suffix="min"
          onChange={(durationMin) => updateBlock(block.id, { durationMin })}
        />
        <NumberField
          label="Contingency"
          value={block.bufferMin}
          min={0}
          step={5}
          suffix="min"
          onChange={(bufferMin) => updateBlock(block.id, { bufferMin })}
        />
      </Row>

      <div className={styles.anchor}>
        <Button
          variant={block.anchorMin === null ? "normal" : "primary"}
          onClick={() => toggleAnchor(block.id)}
          title={
            block.anchorMin === null
              ? "Pin this block to the clock, where it already sits"
              : "Let this block float after the one before it"
          }
        >
          {block.anchorMin === null ? "Anchor to the clock" : "Anchored"}
        </Button>
        <span className={styles.resolved}>
          {entry ? `${formatClock(entry.startMin)} – ${formatClock(entry.endMin)}` : ""}
        </span>
      </div>

      {block.anchorMin === null ? (
        <NumberField
          label="Gap after the block before"
          value={block.gapMin}
          min={0}
          step={5}
          suffix="min"
          onChange={(gapMin) => updateBlock(block.id, { gapMin })}
        />
      ) : (
        <TimeField
          label="Anchored at"
          value={block.anchorMin}
          onChange={(anchorMin) => updateBlock(block.id, { anchorMin })}
        />
      )}

      <SelectField
        label="Lane"
        value={block.lane}
        options={doc.lanes.map((lane) => ({ value: lane, label: lane }))}
        onChange={(lane) => updateBlock(block.id, { lane })}
      />

      <TextField
        label="Location"
        value={block.location}
        onChange={(location) => updateBlock(block.id, { location })}
      />

      <TextField
        label="Tags"
        value={block.tags.join(", ")}
        placeholder="photographer, band"
        onChange={(value) =>
          updateBlock(block.id, {
            tags: value
              .split(",")
              .map((tag) => tag.trim().toLowerCase())
              .filter(Boolean),
          })
        }
      />

      <TextArea label="Notes" value={block.notes} onChange={(notes) => updateBlock(block.id, { notes })} />

      <fieldset className={styles.outputs}>
        <legend className={styles.legend}>Appears on</legend>
        {OUTPUT_IDS.filter((id) => id !== "contact-sheet").map((id: OutputId) => (
          <CheckField
            key={id}
            label={doc.outputs.find((output) => output.id === id)?.label ?? id}
            checked={block.outputs.includes(id)}
            onChange={(on) =>
              updateBlock(block.id, {
                outputs: on
                  ? [...new Set([...block.outputs, id])]
                  : block.outputs.filter((output) => output !== id),
              })
            }
          />
        ))}
      </fieldset>

      {headroom != null && (
        <p className={headroom < 0 ? styles.tight : styles.slack}>
          {headroom < 0
            ? `Over the next anchor by ${formatDuration(-headroom)}.`
            : `${formatDuration(headroom)} spare before the next anchor.`}
        </p>
      )}
    </Panel>
  );
}
