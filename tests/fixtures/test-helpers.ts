import { test as base, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createTestDbHelpers, TestDbHelpers } from "./db-helpers";

interface TestFixtures {
  prisma: PrismaClient;
  dbHelpers: TestDbHelpers;
}

export const test = base.extend<TestFixtures>({
  prisma: async ({}, use: (r: PrismaClient) => Promise<void>) => {
    const prisma = new PrismaClient();
    await use(prisma);
    await prisma.$disconnect();
  },

  dbHelpers: async ({}, use) => {
    const helpers = await createTestDbHelpers();
    
    // Clean up before test
    await helpers.cleanup();
    
    await use(helpers);
    
    // Clean up after test
    await helpers.cleanup();
    
    // Disconnect after all tests are done
    await helpers.prisma.$disconnect();
  },
});

export { expect };

// API response types for better type safety in tests
export interface ApiNote {
  id: string;
  content: string;
  color: string;
  done: boolean;
  checklistItems?: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  boardId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  board?: {
    id: string;
    name: string;
  };
}

export interface ChecklistItem {
  id: string;
  content: string;
  checked: boolean;
  order: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  note?: ApiNote;
  notes?: ApiNote[];
}

// Helper functions for common test operations
export class TestHelpers {
  static async waitForApiCall(page: any, urlPattern: string): Promise<any> {
    return await page.waitForResponse((response: any) => 
      response.url().includes(urlPattern) && response.status() === 200
    );
  }

  static async interceptAndVerifyApiCall(
    page: any, 
    urlPattern: string, 
    method: string = "POST"
  ): Promise<{ request: any; response: any }> {
    const [request] = await Promise.all([
      page.waitForRequest((req: any) => 
        req.url().includes(urlPattern) && req.method() === method
      ),
    ]);

    const response = await request.response();
    return { request, response };
  }

  static createMockNote(overrides: Partial<ApiNote> = {}): ApiNote {
    return {
      id: "test-note-id",
      content: "",
      color: "#fef3c7",
      done: false,
      checklistItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      boardId: "test-board-id",
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
      },
      board: {
        id: "test-board-id",
        name: "Test Board",
      },
      ...overrides,
    };
  }

  static createMockChecklistItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
    return {
      id: `item-${Date.now()}`,
      content: "Test checklist item",
      checked: false,
      order: 0,
      ...overrides,
    };
  }
}