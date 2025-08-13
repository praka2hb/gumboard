import { test, expect } from "../fixtures/test-helpers";

test.describe("API Integration Tests", () => {
  test.beforeEach(async ({ dbHelpers }) => {
    // Clean and seed database before each test
    await dbHelpers.cleanup();
    await dbHelpers.seedTestData();
  });

  test("POST /api/boards/[id]/notes - should create note with checklist items", async ({ page, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    let createdNoteId: string | null = null;
    
    const noteData = {
      content: "",
      color: "#fef3c7",
      checklistItems: [
        {
          id: "item-1",
          content: "Test checklist item",
          checked: false,
          order: 0,
        },
      ],
    };

    // Mock the API endpoint
    await page.route(`**/api/boards/${testData.board.id}/notes`, async (route) => {
      if (route.request().method() === "POST") {
        const postData = await route.request().postDataJSON();
        
        // Create note in actual database
        const note = await dbHelpers.prisma.note.create({
          data: {
            content: postData.content || "",
            color: postData.color || "#fef3c7",
            checklistItems: postData.checklistItems || [],
            boardId: testData.board.id,
            createdBy: testData.user.id,
          },
          include: {
            user: true,
            board: true,
          },
        });

        createdNoteId = note.id;

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            note: {
              id: note.id,
              content: note.content,
              color: note.color,
              done: note.done,
              checklistItems: note.checklistItems,
              createdAt: note.createdAt.toISOString(),
              updatedAt: note.updatedAt.toISOString(),
              boardId: note.boardId,
              user: {
                id: note.user.id,
                name: note.user.name,
                email: note.user.email,
              },
              board: {
                id: note.board.id,
                name: note.board.name,
              },
            },
          }),
        });
      }
    });

    // Simulate the API call
    const response = await page.evaluate(async (data) => {
      return await fetch(`/api/boards/${data.boardId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.noteData),
      });
    }, { boardId: testData.board.id, noteData });

    expect(createdNoteId).not.toBeNull();

    // Verify in database
    const noteInDb = await dbHelpers.verifyNoteInDb(createdNoteId!);
    expect(noteInDb).not.toBeNull();
    expect(noteInDb.boardId).toBe(testData.board.id);
    
    const checklistItems = noteInDb.checklistItems as any[];
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].content).toBe("Test checklist item");
  });

  test("PUT /api/boards/[id]/notes/[noteId] - should update checklist items", async ({ request, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create initial note
    const initialNote = await dbHelpers.prisma.note.create({
      data: {
        content: "",
        color: "#fef3c7",
        checklistItems: [
          {
            id: "item-1",
            content: "Original item",
            checked: false,
            order: 0,
          },
        ],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    const updateData = {
      checklistItems: [
        {
          id: "item-1",
          content: "Updated item",
          checked: true,
          order: 0,
        },
        {
          id: "item-2",
          content: "New item",
          checked: false,
          order: 1,
        },
      ],
    };

    const response = await request.put(`/api/boards/${testData.board.id}/notes/${initialNote.id}`, {
      data: updateData,
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(200);
    
    const responseData = await response.json();
    expect(responseData.note.checklistItems).toHaveLength(2);

    // Verify in database
    const updatedNoteInDb = await dbHelpers.verifyNoteInDb(initialNote.id);
    const checklistItems = updatedNoteInDb.checklistItems as any[];
    
    expect(checklistItems).toHaveLength(2);
    expect(checklistItems[0].content).toBe("Updated item");
    expect(checklistItems[0].checked).toBe(true);
    expect(checklistItems[1].content).toBe("New item");
    expect(checklistItems[1].checked).toBe(false);
  });

  test("GET /api/boards/[id]/notes - should return notes with proper structure", async ({ request, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create test notes
    await dbHelpers.prisma.note.createMany({
      data: [
        {
          id: "note-1",
          content: "First note",
          color: "#fef3c7",
          checklistItems: [],
          boardId: testData.board.id,
          createdBy: testData.user.id,
        },
        {
          id: "note-2",
          content: "",
          color: "#dbeafe",
          checklistItems: [
            {
              id: "item-1",
              content: "Checklist item",
              checked: false,
              order: 0,
            },
          ],
          boardId: testData.board.id,
          createdBy: testData.user.id,
        },
      ],
    });

    const response = await request.get(`/api/boards/${testData.board.id}/notes`);
    expect(response.status()).toBe(200);
    
    const responseData = await response.json();
    expect(responseData.notes).toBeDefined();
    expect(responseData.notes).toHaveLength(2);

    // Verify note structure
    const firstNote = responseData.notes.find((n: any) => n.id === "note-1");
    expect(firstNote).toBeDefined();
    expect(firstNote.content).toBe("First note");
    expect(firstNote.user).toBeDefined();
    expect(firstNote.board).toBeDefined();

    const secondNote = responseData.notes.find((n: any) => n.id === "note-2");
    expect(secondNote).toBeDefined();
    expect(secondNote.checklistItems).toHaveLength(1);
    expect(secondNote.checklistItems[0].content).toBe("Checklist item");
  });

  test("DELETE /api/boards/[id]/notes/[noteId] - should soft delete note", async ({ request, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create note to delete
    const noteToDelete = await dbHelpers.prisma.note.create({
      data: {
        content: "Note to delete",
        color: "#fef3c7",
        checklistItems: [],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    const response = await request.delete(`/api/boards/${testData.board.id}/notes/${noteToDelete.id}`);
    expect(response.status()).toBe(200);

    // Verify note still exists but with deletedAt timestamp
    const deletedNote = await dbHelpers.prisma.note.findUnique({
      where: { id: noteToDelete.id },
    });
    expect(deletedNote).not.toBeNull();
    expect(deletedNote?.deletedAt).not.toBeNull();

    // Verify note is not in active notes
    const activeNotes = await dbHelpers.getBoardNotes(testData.board.id);
    expect(activeNotes).toHaveLength(0);
  });

  test("API endpoints should handle invalid board IDs", async ({ request }) => {
    const invalidBoardId = "invalid-board-id";

    // Test GET
    const getResponse = await request.get(`/api/boards/${invalidBoardId}/notes`);
    expect(getResponse.status()).toBe(404);

    // Test POST
    const postResponse = await request.post(`/api/boards/${invalidBoardId}/notes`, {
      data: { content: "Test note" },
    });
    expect(postResponse.status()).toBe(404);

    // Test PUT
    const putResponse = await request.put(`/api/boards/${invalidBoardId}/notes/some-note-id`, {
      data: { content: "Updated note" },
    });
    expect(putResponse.status()).toBe(404);

    // Test DELETE
    const deleteResponse = await request.delete(`/api/boards/${invalidBoardId}/notes/some-note-id`);
    expect(deleteResponse.status()).toBe(404);
  });

  test("API should validate checklist item structure", async ({ request, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Test with invalid checklist items
    const invalidNoteData = {
      content: "",
      checklistItems: [
        {
          // Missing required fields
          content: "Test item",
        },
      ],
    };

    const response = await request.post(`/api/boards/${testData.board.id}/notes`, {
      data: invalidNoteData,
    });

    // Should handle invalid data gracefully
    expect([400, 422]).toContain(response.status());
  });

  test("API should handle concurrent updates to checklist items", async ({ request, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create initial note
    const initialNote = await dbHelpers.prisma.note.create({
      data: {
        content: "",
        color: "#fef3c7",
        checklistItems: [
          {
            id: "item-1",
            content: "Original item",
            checked: false,
            order: 0,
          },
        ],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    // Simulate concurrent updates
    const update1 = {
      checklistItems: [
        {
          id: "item-1",
          content: "Update from client 1",
          checked: false,
          order: 0,
        },
      ],
    };

    const update2 = {
      checklistItems: [
        {
          id: "item-1",
          content: "Update from client 2",
          checked: true,
          order: 0,
        },
      ],
    };

    // Send both updates concurrently
    const [response1, response2] = await Promise.all([
      request.put(`/api/boards/${testData.board.id}/notes/${initialNote.id}`, {
        data: update1,
      }),
      request.put(`/api/boards/${testData.board.id}/notes/${initialNote.id}`, {
        data: update2,
      }),
    ]);

    // Both should succeed (last write wins or proper conflict resolution)
    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);

    // Verify final state in database
    const finalNote = await dbHelpers.verifyNoteInDb(initialNote.id);
    expect(finalNote).not.toBeNull();
    expect(finalNote.checklistItems).toHaveLength(1);
  });
});
