export type BoardEvent = "note.created" | "note.updated" | "note.deleted";

/**
 * Publish a board event to the standalone Socket.IO server via REST.
 * No-ops if env is not configured, so it won't break existing flows.
 */
export async function publishBoardEvent(
  boardId: string,
  event: BoardEvent,
  payload: unknown
): Promise<void> {
  try {
    const baseUrl = process.env.SOCKET_SERVER_URL;
    const secret = process.env.SOCKET_SERVER_SECRET;
    if (!baseUrl || !secret) return;

    await fetch(`${baseUrl.replace(/\/$/, "")}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-socket-secret": secret,
      },
      body: JSON.stringify({ boardId, event, payload }),
    });
  } catch (error) {
    // Swallow errors so API routes still succeed; log for visibility
    console.error("Failed to publish board event:", error);
  }
}


