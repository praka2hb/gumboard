import { test, expect } from "../fixtures/test-helpers";

test.describe("Database Operations Testing", () => {
  test.beforeEach(async ({ dbHelpers }) => {
    // Clean database before each test
    await dbHelpers.cleanup();
  });

  test("should create and verify test data", async ({ dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Verify organization
    expect(testData.organization.id).toBeDefined();
    expect(testData.organization.name).toContain("Test Organization");
    
    // Verify user
    expect(testData.user.id).toBeDefined();
    expect(testData.user.email).toContain("test-user-");
    expect(testData.user.name).toContain("Test User");
    
    // Verify board
    expect(testData.board.id).toBeDefined();
    expect(testData.board.name).toContain("Test Board");
  });

  test("should create note with checklist items in database", async ({ dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create note directly in database
    const note = await dbHelpers.prisma.note.create({
      data: {
        content: "Test note content",
        color: "#fef3c7",
        checklistItems: [
          {
            id: "item-1",
            content: "First checklist item",
            checked: false,
            order: 0,
          },
          {
            id: "item-2", 
            content: "Second checklist item",
            checked: true,
            order: 1,
          },
        ],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    // Verify note was created
    const noteInDb = await dbHelpers.verifyNoteInDb(note.id);
    expect(noteInDb).not.toBeNull();
    expect(noteInDb.content).toBe("Test note content");
    expect(noteInDb.boardId).toBe(testData.board.id);
    expect(noteInDb.createdBy).toBe(testData.user.id);
    
    // Verify checklist items
    const checklistItems = noteInDb.checklistItems as any[];
    expect(checklistItems).toHaveLength(2);
    expect(checklistItems[0].content).toBe("First checklist item");
    expect(checklistItems[0].checked).toBe(false);
    expect(checklistItems[1].content).toBe("Second checklist item");
    expect(checklistItems[1].checked).toBe(true);
  });

  test("should update checklist items in database", async ({ dbHelpers }) => {
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

    // Update checklist items
    const updatedNote = await dbHelpers.prisma.note.update({
      where: { id: initialNote.id },
      data: {
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
      },
    });

    // Verify updates
    const noteInDb = await dbHelpers.verifyNoteInDb(initialNote.id);
    const checklistItems = noteInDb.checklistItems as any[];
    
    expect(checklistItems).toHaveLength(2);
    expect(checklistItems[0].content).toBe("Updated item");
    expect(checklistItems[0].checked).toBe(true);
    expect(checklistItems[1].content).toBe("New item");
    expect(checklistItems[1].checked).toBe(false);
  });

  test("should soft delete note", async ({ dbHelpers }) => {
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

    // Soft delete the note
    await dbHelpers.prisma.note.update({
      where: { id: noteToDelete.id },
      data: {
        deletedAt: new Date(),
      },
    });

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

  test("should count notes correctly", async ({ dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Initially no notes
    let notesCount = await dbHelpers.getNotesCount(testData.board.id);
    expect(notesCount).toBe(0);

    // Create first note
    await dbHelpers.prisma.note.create({
      data: {
        content: "First note",
        color: "#fef3c7",
        checklistItems: [],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    notesCount = await dbHelpers.getNotesCount(testData.board.id);
    expect(notesCount).toBe(1);

    // Create second note
    await dbHelpers.prisma.note.create({
      data: {
        content: "Second note",
        color: "#dbeafe",
        checklistItems: [],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    notesCount = await dbHelpers.getNotesCount(testData.board.id);
    expect(notesCount).toBe(2);
  });

  test("should verify checklist item by content", async ({ dbHelpers }) => {
    const testData = await dbHelpers.seedTestData();
    
    // Create note with specific checklist item
    const note = await dbHelpers.prisma.note.create({
      data: {
        content: "",
        color: "#fef3c7",
        checklistItems: [
          {
            id: "item-1",
            content: "Find this item",
            checked: false,
            order: 0,
          },
          {
            id: "item-2",
            content: "Another item",
            checked: true,
            order: 1,
          },
        ],
        boardId: testData.board.id,
        createdBy: testData.user.id,
      },
    });

    // Verify specific item exists
    const foundItem = await dbHelpers.verifyChecklistItemInDb(note.id, "Find this item");
    expect(foundItem).not.toBeNull();
    expect(foundItem.content).toBe("Find this item");
    expect(foundItem.checked).toBe(false);

    // Verify non-existent item
    const notFoundItem = await dbHelpers.verifyChecklistItemInDb(note.id, "Non-existent item");
    expect(notFoundItem).toBeNull();
  });

  test("should handle multiple boards", async ({ dbHelpers }) => {
    const testData1 = await dbHelpers.seedTestData();
    
    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const testData2 = await dbHelpers.seedTestData();
    
    // Create notes in different boards
    await dbHelpers.prisma.note.create({
      data: {
        content: "Note in board 1",
        color: "#fef3c7",
        checklistItems: [],
        boardId: testData1.board.id,
        createdBy: testData1.user.id,
      },
    });

    await dbHelpers.prisma.note.create({
      data: {
        content: "Note in board 2",
        color: "#dbeafe",
        checklistItems: [],
        boardId: testData2.board.id,
        createdBy: testData2.user.id,
      },
    });

    // Verify each board has its own note
    const board1Notes = await dbHelpers.getBoardNotes(testData1.board.id);
    const board2Notes = await dbHelpers.getBoardNotes(testData2.board.id);
    
    expect(board1Notes).toHaveLength(1);
    expect(board2Notes).toHaveLength(1);
    expect(board1Notes[0].content).toBe("Note in board 1");
    expect(board2Notes[0].content).toBe("Note in board 2");
  });
});
