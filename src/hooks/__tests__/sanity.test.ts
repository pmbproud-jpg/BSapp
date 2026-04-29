/**
 * Sanity test -- weryfikacja ze jest + jest-expo + ts dziala.
 * Faza 4 commit 1 (setup). Po pierwszych prawdziwych testach mozna usunac.
 */
describe("Jest setup", () => {
  it("uruchamia testy TypeScript", () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(2, 3)).toBe(5);
  });

  it("ma async/await", async () => {
    const promise = Promise.resolve(42);
    await expect(promise).resolves.toBe(42);
  });
});
