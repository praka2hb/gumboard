import { PrismaClient } from "@prisma/client";

export interface TestDbHelpers {
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
  seedTestData: () => Promise<TestSeedData>;
  verifyNoteInDb: (noteId: string) => Promise<any>;
  verifyChecklistItemInDb: (noteId: string, itemContent: string) => Promise<any>;
  getNotesCount: (boardId: string) => Promise<number>;
  getBoardNotes: (boardId: string) => Promise<any[]>;
}

export interface TestSeedData {
  organization: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
  };
  board: {
    id: string;
    name: string;
  };
}

export async function createTestDbHelpers(): Promise<TestDbHelpers> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      },
    },
  });

  const cleanup = async () => {
    try {
      // Clean up test data in correct order due to foreign key constraints
      await prisma.note.deleteMany({
        where: {
          user: {
            email: { contains: "test-user-" }
          }
        }
      });
      
      await prisma.board.deleteMany({
        where: {
          organization: {
            name: { contains: "Test Organization" }
          }
        }
      });
      
      await prisma.user.deleteMany({
        where: {
          email: { contains: "test-user-" }
        }
      });
      
      await prisma.organization.deleteMany({
        where: {
          name: { contains: "Test Organization" }
        }
      });
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  };

  const seedTestData = async (): Promise<TestSeedData> => {
    // Generate unique IDs for this test run to avoid conflicts
    const timestamp = Date.now() + Math.random();
    const orgId = `test-org-${Math.floor(timestamp)}`;
    const userId = `test-user-${Math.floor(timestamp)}`;
    const boardId = `test-board-${Math.floor(timestamp)}`;

    // Create test organization
    const organization = await prisma.organization.create({
      data: {
        id: orgId,
        name: `Test Organization ${Math.floor(timestamp)}`,
      },
    });

    // Create test user
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: `test-user-${Math.floor(timestamp)}@example.com`,
        name: `Test User ${Math.floor(timestamp)}`,
        organizationId: organization.id,
        isAdmin: true,
      },
    });

    // Create test board
    const board = await prisma.board.create({
      data: {
        id: boardId,
        name: `Test Board ${Math.floor(timestamp)}`,
        description: "A test board for e2e testing",
        organizationId: organization.id,
        createdBy: user.id,
      },
    });

    return {
      organization: { id: organization.id, name: organization.name },
      user: { id: user.id, email: user.email, name: user.name || "" },
      board: { id: board.id, name: board.name },
    };
  };

  const verifyNoteInDb = async (noteId: string) => {
    return await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        user: true,
        board: true,
      },
    });
  };

  const verifyChecklistItemInDb = async (noteId: string, itemContent: string) => {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note?.checklistItems) return null;

    const checklistItems = note.checklistItems as any[];
    const foundItem = checklistItems.find((item: any) => item.content === itemContent);
    return foundItem || null;
  };

  const getNotesCount = async (boardId: string): Promise<number> => {
    return await prisma.note.count({
      where: {
        boardId,
        deletedAt: null,
      },
    });
  };

  const getBoardNotes = async (boardId: string) => {
    return await prisma.note.findMany({
      where: {
        boardId,
        deletedAt: null,
      },
      include: {
        user: true,
        board: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  return {
    prisma,
    cleanup,
    seedTestData,
    verifyNoteInDb,
    verifyChecklistItemInDb,
    getNotesCount,
    getBoardNotes,
  };
}
