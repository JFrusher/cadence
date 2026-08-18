// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleDoc } from "../core/model/defaults";
import { serialise } from "../core/project/file";
import { clearPersisted, createPersister, persist, restore, STORAGE_KEY } from "./persist";

beforeEach(() => {
  localStorage.clear();
});

describe("restore", () => {
  it("returns nothing when there is nothing saved", () => {
    expect(restore()).toEqual({ doc: null, notice: null });
  });

  it("brings back the saved day", () => {
    persist(sampleDoc());
    const { doc, notice } = restore();
    expect(notice).toBeNull();
    expect(doc).toEqual(sampleDoc());
  });

  it("starts empty with a notice when the payload is rubbish", () => {
    localStorage.setItem(STORAGE_KEY, "{ this is not json");
    const { doc, notice } = restore();
    expect(doc).toBeNull();
    expect(notice).toMatch(/could not be read/);
  });

  it("survives storage being blocked outright", () => {
    const blocked = {
      getItem() {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(restore(blocked).notice).toMatch(/blocking local storage/);
  });
});

describe("createPersister", () => {
  it("writes once after the edits stop", () => {
    vi.useFakeTimers();
    const { schedule } = createPersister();
    const spy = vi.spyOn(Storage.prototype, "setItem");

    schedule(sampleDoc());
    schedule(sampleDoc());
    schedule(sampleDoc());
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
    vi.useRealTimers();
  });

  it("flushes on demand", () => {
    vi.useFakeTimers();
    const { schedule, flush } = createPersister();
    schedule(sampleDoc());
    flush();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(serialise(sampleDoc()));
    vi.useRealTimers();
  });
});

describe("clearPersisted", () => {
  it("removes the saved day", () => {
    persist(sampleDoc());
    clearPersisted();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
