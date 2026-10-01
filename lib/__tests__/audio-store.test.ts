import { describe, expect, it } from "vitest"
import { createMemoryAudioStore, removeOrphanedAudio } from "../audio-store"

const blob = (text: string) => new Blob([text], { type: "audio/wav" })

describe("memory audio store", () => {
  it("round-trips a blob", async () => {
    const store = createMemoryAudioStore()
    await store.put("a", blob("x"))
    expect(await store.get("a")).toBeInstanceOf(Blob)
    expect(await store.get("missing")).toBeNull()
  })

  it("deletes and lists keys", async () => {
    const store = createMemoryAudioStore()
    await store.put("a", blob("x"))
    await store.put("b", blob("y"))
    await store.delete("a")
    expect(await store.keys()).toEqual(["b"])
  })
})

describe("removeOrphanedAudio", () => {
  it("removes audio whose session no longer exists and keeps the rest", async () => {
    const store = createMemoryAudioStore()
    await store.put("live", blob("1"))
    await store.put("gone", blob("2"))
    const removed = await removeOrphanedAudio(store, ["live"])
    expect(removed).toEqual(["gone"])
    expect(await store.keys()).toEqual(["live"])
  })

  it("keeps going when one delete fails", async () => {
    const store = createMemoryAudioStore()
    await store.put("a", blob("1"))
    await store.put("b", blob("2"))
    const realDelete = store.delete
    store.delete = async (id) => {
      if (id === "a") throw new Error("boom")
      return realDelete(id)
    }
    const removed = await removeOrphanedAudio(store, [])
    expect(removed).toEqual(["b"])
  })
})
