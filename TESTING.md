# Testing Guide for Gumboard

This guide covers how to test the Gumboard application comprehensively, including unit tests, integration tests, and end-to-end tests with database verification.

## Table of Contents

1. [Testing Setup](#testing-setup)
2. [Running Tests](#running-tests)
3. [Test Types](#test-types)
4. [Database Testing](#database-testing)
5. [Writing New Tests](#writing-new-tests)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Testing Setup

### Prerequisites

1. **Node.js** (version 18 or higher)
2. **PostgreSQL** database (for integration tests)
3. **Docker** (optional, for isolated testing environment)

### Installation

```bash
# Install dependencies
npm install

# Setup test database
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### Environment Variables

Create a `.env.test` file for testing:

```env
# Test Database
TEST_DATABASE_URL="postgresql://username:password@localhost:5432/gumboard_test"
DATABASE_URL="postgresql://username:password@localhost:5432/gumboard_test"

# Auth (for e2e tests)
NEXTAUTH_SECRET="test-secret"
NEXTAUTH_URL="http://localhost:3000"

# Other test-specific vars
NODE_ENV="test"
```

## Running Tests

### Unit Tests (Jest)

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- utils.test.ts

# Run with coverage
npm run test -- --coverage
```

### End-to-End Tests (Playwright)

```bash
# Run all e2e tests
npm run test:e2e

# Run e2e tests with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test notes-with-db-verification.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug
```

### API Integration Tests

```bash
# Run API tests specifically
npx playwright test api-integration.spec.ts

# Run with verbose output
npx playwright test api-integration.spec.ts --reporter=line
```

## Test Types

### 1. Unit Tests

Located in `lib/__tests__/` and test individual functions and utilities.

**Example:**
```typescript
// lib/__tests__/utils.test.ts
import { cn } from "../utils";

describe("cn utility function", () => {
  it("should combine class names correctly", () => {
    const result = cn("class1", "class2");
    expect(result).toBe("class1 class2");
  });
});
```

### 2. Component Tests

Test React components in isolation (can be added as needed).

### 3. API Integration Tests

Test API endpoints with real database operations.

**Example:**
```typescript
// tests/e2e/api-integration.spec.ts
test("POST /api/boards/[id]/notes - should create note", async ({ request, dbHelpers }) => {
  const testData = await dbHelpers.seedTestData();
  
  const response = await request.post(`/api/boards/${testData.board.id}/notes`, {
    data: { content: "Test note" },
  });
  
  expect(response.status()).toBe(201);
  
  // Verify in database
  const noteInDb = await dbHelpers.verifyNoteInDb(responseData.note.id);
  expect(noteInDb).not.toBeNull();
});
```

### 4. End-to-End Tests with Database Verification

Test complete user workflows with database state verification.

**Example:**
```typescript
// tests/e2e/notes-with-db-verification.spec.ts
test("should create and verify note in database", async ({ page, dbHelpers }) => {
  await page.goto("/boards/test-board");
  await page.click('button:has-text("Add Your First Note")');
  
  // Verify in database
  const notesCount = await dbHelpers.getNotesCount("test-board");
  expect(notesCount).toBe(1);
});
```

## Database Testing

### Database Helpers

Use the `dbHelpers` fixture for database operations in tests:

```typescript
import { test } from "../fixtures/test-helpers";

test("your test", async ({ dbHelpers }) => {
  // Seed test data
  const testData = await dbHelpers.seedTestData();
  
  // Verify note exists
  const note = await dbHelpers.verifyNoteInDb("note-id");
  
  // Check notes count
  const count = await dbHelpers.getNotesCount("board-id");
  
  // Get all board notes
  const notes = await dbHelpers.getBoardNotes("board-id");
  
  // Verify checklist item
  const item = await dbHelpers.verifyChecklistItemInDb("note-id", "item-content");
});
```

### Available Database Methods

- `seedTestData()` - Creates test organization, user, and board
- `verifyNoteInDb(noteId)` - Gets note from database
- `verifyChecklistItemInDb(noteId, content)` - Finds checklist item
- `getNotesCount(boardId)` - Counts active notes
- `getBoardNotes(boardId)` - Gets all notes for board
- `cleanup()` - Cleans up test data

### Database State Verification Pattern

```typescript
test("should update checklist item", async ({ page, dbHelpers }) => {
  // 1. Setup initial state
  const note = await dbHelpers.prisma.note.create({...});
  
  // 2. Perform UI action
  await page.click("checkbox");
  
  // 3. Verify database state
  const updatedNote = await dbHelpers.verifyNoteInDb(note.id);
  expect(updatedNote.checklistItems[0].checked).toBe(true);
});
```

## Writing New Tests

### Test File Structure

```
tests/
├── fixtures/
│   ├── test-helpers.ts      # Base test fixtures
│   └── db-helpers.ts        # Database utilities
├── e2e/
│   ├── notes.spec.ts        # Basic e2e tests
│   ├── notes-with-db-verification.spec.ts  # Enhanced e2e tests
│   └── api-integration.spec.ts              # API tests
└── unit/
    └── (future unit tests)
```

### Creating a New E2E Test

1. **Create test file:**
```typescript
// tests/e2e/my-feature.spec.ts
import { test, expect } from "../fixtures/test-helpers";

test.describe("My Feature", () => {
  test.beforeEach(async ({ dbHelpers }) => {
    await dbHelpers.seedTestData();
  });

  test("should do something", async ({ page, dbHelpers }) => {
    // Test implementation
  });
});
```

2. **Add database verification:**
```typescript
// Verify state changes in database
const result = await dbHelpers.verifyNoteInDb(noteId);
expect(result.someField).toBe(expectedValue);
```

### Creating API Tests

```typescript
test("API endpoint test", async ({ request, dbHelpers }) => {
  const testData = await dbHelpers.seedTestData();
  
  const response = await request.post("/api/endpoint", {
    data: { /* request data */ },
  });
  
  expect(response.status()).toBe(200);
  
  // Verify in database
  const dbResult = await dbHelpers.someVerificationMethod();
  expect(dbResult).toMatchExpected();
});
```

## Best Practices

### 1. Test Isolation

- Each test should be independent
- Use `dbHelpers.cleanup()` to ensure clean state
- Don't rely on test execution order

### 2. Database Testing

- Always verify critical state changes in database
- Use transactions for test data when possible
- Clean up test data after each test

### 3. Async Testing

```typescript
// ✅ Good: Wait for state changes
await page.click("button");
await page.waitForTimeout(500); // Allow API call to complete
const dbState = await dbHelpers.verifyNoteInDb(noteId);

// ❌ Bad: Not waiting for async operations
await page.click("button");
const dbState = await dbHelpers.verifyNoteInDb(noteId); // May fail
```

### 4. Error Handling

```typescript
test("should handle errors gracefully", async ({ page, dbHelpers }) => {
  // Test error scenarios
  const response = await request.post("/api/invalid-endpoint");
  expect(response.status()).toBe(404);
  
  // Verify no side effects in database
  const count = await dbHelpers.getNotesCount("board-id");
  expect(count).toBe(0);
});
```

### 5. Test Data Management

```typescript
// ✅ Good: Use helpers for consistent test data
const testData = await dbHelpers.seedTestData();

// ✅ Good: Create specific test data for test case
const noteWithItems = await dbHelpers.prisma.note.create({
  data: {
    checklistItems: [/* specific items for this test */],
    boardId: testData.board.id,
    createdBy: testData.user.id,
  },
});

// ❌ Bad: Hardcoded IDs that might not exist
const note = await dbHelpers.verifyNoteInDb("hardcoded-id");
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check database is running
   psql -h localhost -p 5432 -U username -d gumboard_test
   
   # Reset test database
   npm run db:reset
   ```

2. **Test Timeouts**
   ```typescript
   // Increase timeout for slow operations
   test.setTimeout(30000); // 30 seconds
   
   // Use proper waits
   await page.waitForSelector(".element");
   await page.waitForLoadState("networkidle");
   ```

3. **Flaky Tests**
   - Add explicit waits instead of fixed timeouts
   - Verify async operations complete
   - Check for race conditions

4. **Database State Issues**
   ```typescript
   // Debug database state
   console.log(await dbHelpers.getBoardNotes("board-id"));
   
   // Check if cleanup is working
   test.beforeEach(async ({ dbHelpers }) => {
     await dbHelpers.cleanup();
     const count = await dbHelpers.getNotesCount("any-board");
     expect(count).toBe(0); // Should be clean
   });
   ```

### Debug Commands

```bash
# Run single test with debug output
npx playwright test my-test.spec.ts --debug

# Run tests with browser visible
npx playwright test --headed

# Generate test report
npx playwright show-report

# Record new test
npx playwright codegen localhost:3000
```

### Performance Tips

1. **Parallel Test Execution**
   ```typescript
   // In playwright.config.ts
   export default defineConfig({
     workers: process.env.CI ? 2 : undefined,
     fullyParallel: true,
   });
   ```

2. **Database Optimization**
   - Use database transactions for test data
   - Batch database operations
   - Use specific queries instead of full scans

3. **Test Optimization**
   - Group related tests in describe blocks
   - Use shared setup in beforeEach
   - Avoid unnecessary UI interactions

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: gumboard_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test
      - run: npm run test:e2e
```

This comprehensive testing approach ensures that your application works correctly at all levels - from individual functions to complete user workflows with proper database state verification.
