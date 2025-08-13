import { test, expect, TestHelpers } from "../fixtures/test-helpers";

test.describe("Notes Management with Database Verification", () => {
  test.beforeEach(async ({ page, dbHelpers }) => {
    // Seed database with test data
    const testData = await dbHelpers.seedTestData();

    // Mock authentication
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: testData.user.id,
            email: testData.user.email,
            name: testData.user.name,
          },
        }),
      });
    });

    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: testData.user.id,
          email: testData.user.email,
          name: testData.user.name,
          isAdmin: true,
          organization: {
            id: testData.organization.id,
            name: testData.organization.name,
          },
        }),
      });
    });

    await page.route(`**/api/boards/${testData.board.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          board: {
            id: testData.board.id,
            name: testData.board.name,
            description: "A test board",
          },
        }),
      });
    });

    await page.route("**/api/boards", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          boards: [
            {
              id: testData.board.id,
              name: testData.board.name,
              description: "A test board",
            },
          ],
        }),
      });
    });

    // Route for fetching notes
    await page.route(`**/api/boards/${testData.board.id}/notes`, async (route) => {
      if (route.request().method() === "GET") {
        const notes = await dbHelpers.getBoardNotes(testData.board.id);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ notes }),
        });
      }
    });
  });

  test("should create note and verify in database", async ({ page, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    let createdNoteId: string | null = null;

    // Intercept note creation API call
    await page.route(`**/api/boards/${testData.board.id}/notes`, async (route) => {
      if (route.request().method() === "POST") {
        const postData = await route.request().postDataJSON();
        
        // Create note in actual database
        const note = await dbHelpers.prisma.note.create({
          data: {
            content: postData.content || "",
            color: postData.color || "#fef3c7",
            checklistItems: postData.checklistItems || [
              {
                id: `item-${Date.now()}`,
                content: "",
                checked: false,
                order: 0,
              },
            ],
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

    await page.goto(`/boards/${testData.board.id}`);

    // Create a note by clicking the button
    await page.click('button:has-text("Add Your First Note")');
    await page.waitForTimeout(1000);

    // Verify note was created in database
    expect(createdNoteId).not.toBeNull();
    
    if (createdNoteId) {
      const noteInDb = await dbHelpers.verifyNoteInDb(createdNoteId);
      expect(noteInDb).not.toBeNull();
      expect(noteInDb.boardId).toBe(testData.board.id);
      expect(noteInDb.createdBy).toBe(testData.user.id);
      
      // Verify notes count increased
      const notesCount = await dbHelpers.getNotesCount(testData.board.id);
      expect(notesCount).toBe(1);
    }
  });

  test("should create and update checklist items with database verification", async ({ page, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    let noteId: string | null = null;

    // Create initial note in database
    const initialNote = await dbHelpers.prisma.note.create({
      data: {
        content: "",
        color: "#fef3c7",
        checklistItems: [],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });
    noteId = initialNote.id;

    // Mock note update API
    await page.route(`**/api/boards/${testData.board.id}/notes/${noteId}`, async (route) => {
      if (route.request().method() === "PUT") {
        const updateData = await route.request().postDataJSON();
        
        // Update note in database
        const updatedNote = await dbHelpers.prisma.note.update({
          where: { id: noteId! },
          data: {
            checklistItems: updateData.checklistItems,
            updatedAt: new Date(),
          },
          include: {
            user: true,
            board: true,
          },
        });

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            note: {
              id: updatedNote.id,
              content: updatedNote.content,
              color: updatedNote.color,
              done: updatedNote.done,
              checklistItems: updatedNote.checklistItems,
              createdAt: updatedNote.createdAt.toISOString(),
              updatedAt: updatedNote.updatedAt.toISOString(),
              boardId: updatedNote.boardId,
              user: {
                id: updatedNote.user.id,
                name: updatedNote.user.name,
                email: updatedNote.user.email,
              },
            },
          }),
        });
      }
    });

    // Mock notes fetch to include our created note
    await page.route(`**/api/boards/${testData.board.id}/notes`, async (route) => {
      if (route.request().method() === "GET") {
        const notes = await dbHelpers.getBoardNotes(testData.board.id);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ notes }),
        });
      }
    });

    await page.goto(`/boards/${testData.board.id}`);

    // Wait for note to be visible
    await expect(page.locator(".note-background")).toBeVisible();

    // Add checklist item
    await page.click('button:has-text("Add task")');
    const input = page.locator('input[placeholder="Add new item..."]');
    await expect(input).toBeVisible();
    await input.fill("Test checklist item");
    await input.press("Enter");

    await page.waitForTimeout(500);

    // Verify checklist item was saved to database
    const updatedNote = await dbHelpers.verifyNoteInDb(noteId);
    expect(updatedNote).not.toBeNull();
    expect(updatedNote.checklistItems).toBeDefined();
    
    const checklistItems = updatedNote.checklistItems as any[];
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].content).toBe("Test checklist item");
    expect(checklistItems[0].checked).toBe(false);

    // Verify specific checklist item
    const foundItem = await dbHelpers.verifyChecklistItemInDb(noteId, "Test checklist item");
    expect(foundItem).not.toBeNull();
    expect(foundItem.content).toBe("Test checklist item");
  });

  test("should toggle checklist item and verify database state", async ({ page, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create note with checklist item
    const noteWithItem = await dbHelpers.prisma.note.create({
      data: {
        content: "",
        color: "#fef3c7",
        checklistItems: [
          {
            id: "item-1",
            content: "Toggle test item",
            checked: false,
            order: 0,
          },
        ],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    // Mock note update API
    await page.route(`**/api/boards/${testData.board.id}/notes/${noteWithItem.id}`, async (route) => {
      if (route.request().method() === "PUT") {
        const updateData = await route.request().postDataJSON();
        
        const updatedNote = await dbHelpers.prisma.note.update({
          where: { id: noteWithItem.id },
          data: {
            checklistItems: updateData.checklistItems,
            updatedAt: new Date(),
          },
          include: {
            user: true,
          },
        });

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            note: {
              id: updatedNote.id,
              content: updatedNote.content,
              checklistItems: updatedNote.checklistItems,
              user: {
                id: updatedNote.user.id,
                name: updatedNote.user.name,
                email: updatedNote.user.email,
              },
            },
          }),
        });
      }
    });

    // Mock notes fetch
    await page.route(`**/api/boards/${testData.board.id}/notes`, async (route) => {
      if (route.request().method() === "GET") {
        const notes = await dbHelpers.getBoardNotes(testData.board.id);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ notes }),
        });
      }
    });

    await page.goto(`/boards/${testData.board.id}`);

    // Wait for note to be visible
    await expect(page.locator("text=Toggle test item")).toBeVisible();

    // Click the checkbox to toggle
    const checkbox = page.locator('[data-testid="item-1"] [data-state="unchecked"]');
    await expect(checkbox).toBeVisible();
    await checkbox.click();

    await page.waitForTimeout(500);

    // Verify toggle state in database
    const toggledNote = await dbHelpers.verifyNoteInDb(noteWithItem.id);
    expect(toggledNote).not.toBeNull();
    
    const checklistItems = toggledNote.checklistItems as any[];
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].checked).toBe(true);
  });

  test("should delete checklist item and verify database state", async ({ page, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create note with multiple checklist items
    const noteWithItems = await dbHelpers.prisma.note.create({
      data: {
        content: "",
        color: "#fef3c7",
        checklistItems: [
          {
            id: "item-1",
            content: "Keep this item",
            checked: false,
            order: 0,
          },
          {
            id: "item-2",
            content: "Delete this item",
            checked: false,
            order: 1,
          },
        ],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    // Mock note update API
    await page.route(`**/api/boards/${testData.board.id}/notes/${noteWithItems.id}`, async (route) => {
      if (route.request().method() === "PUT") {
        const updateData = await route.request().postDataJSON();
        
        const updatedNote = await dbHelpers.prisma.note.update({
          where: { id: noteWithItems.id },
          data: {
            checklistItems: updateData.checklistItems,
            updatedAt: new Date(),
          },
          include: {
            user: true,
          },
        });

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            note: {
              id: updatedNote.id,
              content: updatedNote.content,
              checklistItems: updatedNote.checklistItems,
              user: {
                id: updatedNote.user.id,
                name: updatedNote.user.name,
                email: updatedNote.user.email,
              },
            },
          }),
        });
      }
    });

    // Mock notes fetch
    await page.route(`**/api/boards/${testData.board.id}/notes`, async (route) => {
      if (route.request().method() === "GET") {
        const notes = await dbHelpers.getBoardNotes(testData.board.id);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ notes }),
        });
      }
    });

    await page.goto(`/boards/${testData.board.id}`);

    // Wait for note to be visible
    await expect(page.locator("text=Keep this item")).toBeVisible();
    await expect(page.locator("text=Delete this item")).toBeVisible();

    // Delete the second item
    const deleteButton = page.locator('[data-testid="item-2"] button[aria-label="Delete item"]');
    await deleteButton.click();

    await page.waitForTimeout(500);

    // Verify item was deleted from database
    const updatedNote = await dbHelpers.verifyNoteInDb(noteWithItems.id);
    expect(updatedNote).not.toBeNull();
    
    const checklistItems = updatedNote.checklistItems as any[];
    expect(checklistItems).toHaveLength(1);
    expect(checklistItems[0].content).toBe("Keep this item");

    // Verify the deleted item is not in database
    const deletedItem = await dbHelpers.verifyChecklistItemInDb(noteWithItems.id, "Delete this item");
    expect(deletedItem).toBeNull();
  });

  test("should handle note deletion with database verification", async ({ page, dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create note to be deleted
    const noteToDelete = await dbHelpers.prisma.note.create({
      data: {
        content: "Note to be deleted",
        color: "#fef3c7",
        checklistItems: [],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    // Mock note deletion API
    await page.route(`**/api/boards/${testData.board.id}/notes/${noteToDelete.id}`, async (route) => {
      if (route.request().method() === "DELETE") {
        // Soft delete the note
        await dbHelpers.prisma.note.update({
          where: { id: noteToDelete.id },
          data: {
            deletedAt: new Date(),
          },
        });

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Mock notes fetch
    await page.route(`**/api/boards/${testData.board.id}/notes`, async (route) => {
      if (route.request().method() === "GET") {
        const notes = await dbHelpers.getBoardNotes(testData.board.id);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ notes }),
        });
      }
    });

    await page.goto(`/boards/${testData.board.id}`);

    // Wait for note to be visible
    await expect(page.locator("text=Note to be deleted")).toBeVisible();

    // Delete the note
    const deleteButton = page.locator('button[aria-label*="Delete Note"]');
    await deleteButton.click();

    // Confirm deletion in dialog
    const confirmButton = page.locator('button:has-text("Delete note")');
    await confirmButton.click();

    await page.waitForTimeout(500);

    // Verify note was soft-deleted in database
    const deletedNote = await dbHelpers.prisma.note.findUnique({
      where: { id: noteToDelete.id },
    });
    expect(deletedNote).not.toBeNull();
    expect(deletedNote?.deletedAt).not.toBeNull();

    // Verify note is not in active notes count
    const activeNotesCount = await dbHelpers.getNotesCount(testData.board.id);
    expect(activeNotesCount).toBe(0);
  });
});
