import { useEffect } from "react";
import { Presentation } from "./render/screen/Presentation";
import { Timeline } from "./render/screen/Timeline";
import { serialise } from "./core/project/file";
import { formatDuration } from "./core/time/minutes";
import { restoreFonts } from "./state/fontLoader";
import { createPersister, restore } from "./state/persist";
import { getDoc, selectSchedule, useStore } from "./state/store";
import { useKeyboard } from "./state/useKeyboard";
import { Announcer } from "./ui/Announcer";
import { Button } from "./ui/controls";
import { DesktopGate, useIsDesktop } from "./ui/DesktopGate";
import { Mark } from "./ui/Mark";
import { ExportBar } from "./ui/ExportBar";
import { ProjectButtons } from "./ui/ProjectButtons";
import { Sidebar } from "./ui/Sidebar";
import { WarningsList } from "./ui/WarningsList";
import { write as writeLinkedFile } from "./state/fileSink";
import styles from "./App.module.css";

const persister = createPersister();

export function App() {
  const isDesktop = useIsDesktop();
  const doc = useStore(getDoc);
  const schedule = useStore(selectSchedule);
  const presentation = useStore((state) => state.ui.presentation);
  const pxPerMin = useStore((state) => state.ui.pxPerMin);
  const notice = useStore((state) => state.notice);
  const setUi = useStore((state) => state.setUi);
  const setNotice = useStore((state) => state.setNotice);
  useKeyboard();

  // Bring back the last session once, on boot.
  useEffect(() => {
    const { doc: saved, notice: problem } = restore();
    if (saved) {
      useStore.getState().loadDoc(saved);
      void restoreFonts(saved.fonts).then((missing) => {
        if (missing.length > 0) setNotice(`Missing font${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
      });
    }
    if (problem) setNotice(problem);
  }, [setNotice]);

  // Autosave, debounced, and flushed if the window goes away mid-edit.
  // localStorage is the source of truth for this browser; the linked file, when
  // there is one, is a second write so a synced folder always holds the current
  // day. A failure there never loses work, so it is not worth interrupting for.
  useEffect(() => {
    persister.schedule(doc);
    void writeLinkedFile(serialise(doc));
  }, [doc]);
  useEffect(() => {
    const flush = () => persister.flush();
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  if (!isDesktop) return <DesktopGate />;
  if (presentation) return <Presentation />;

  const curfew = schedule.slack.toCurfewMin;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <Mark />
          <h1 className={styles.wordmark}>Cadence</h1>
        </span>
        <span className={styles.day}>
          {doc.day.coupleNames || "A day with no name yet"}
          {doc.day.venueName && ` · ${doc.day.venueName}`}
        </span>

        <span className={curfew < 0 ? styles.over : styles.slack}>
          {doc.blocks.length === 0
            ? ""
            : curfew < 0
              ? `${formatDuration(-curfew)} past curfew`
              : `${formatDuration(curfew)} before curfew`}
        </span>

        <span className={styles.spacer} />

        <span className={styles.zoom}>
          <Button variant="quiet" onClick={() => setUi({ pxPerMin: Math.max(0.2, pxPerMin - 0.2) })} title="Zoom out">
            −
          </Button>
          <Button variant="quiet" onClick={() => setUi({ pxPerMin: Math.min(6, pxPerMin + 0.2) })} title="Zoom in">
            +
          </Button>
        </span>

        <Button variant="quiet" onClick={() => useStore.getState().undo()} title="Undo">
          Undo
        </Button>
        <Button variant="quiet" onClick={() => useStore.getState().redo()} title="Redo">
          Redo
        </Button>
        <Button onClick={() => setUi({ presentation: true })}>Present</Button>
        <ProjectButtons />
      </header>

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
          <button type="button" className={styles.dismiss} onClick={() => setNotice(null)}>
            dismiss
          </button>
        </p>
      )}

      <div className={styles.body}>
        <Sidebar />
        <main className={styles.canvas}>
          <Timeline />
          <div className={styles.foot}>
            <WarningsList />
            <ExportBar />
          </div>
        </main>
      </div>

      <Announcer />
    </div>
  );
}
