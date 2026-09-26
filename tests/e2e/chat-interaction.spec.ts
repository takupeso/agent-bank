import { test, expect } from "@playwright/test";
test("quick requests close tools and new chat content scrolls into view", async ({
  page,
}) => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    id: String(index),
    role: "assistant",
    text: `Previous message ${index}.Checking account operations.`,
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({ json: { authenticated: true } });
    if (path === "/api/world")
      return route.fulfill({ json: { authMode: "local-demo" } });
    if (path === "/api/dashboard")
      return route.fulfill({
        json: { initialized: true, td: "800000", movements: [] },
      });
    if (path === "/api/chat/messages") {
      if (route.request().method() === "POST")
        messages.push({
          id: "new",
          role: "assistant",
          text: "I have prepared an investment proposal.",
        });
      return route.fulfill({ json: messages });
    }
    if (path === "/api/demo/events")
      return route.fulfill({ status: 400, json: { error: "failed" } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const conversation = page.locator(".agent-conversation");
  await expect(
    page.getByText("Previous message 29.Checking account operations.", {
      exact: true,
    }),
  ).toBeInViewport();
  await conversation.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page
    .getByText("Demo actions and common requests", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Invest my available funds", exact: true })
    .click();
  await expect(page.locator("details.agent-tools")).not.toHaveAttribute("open");
  await expect(
    page.getByText("I have prepared an investment proposal.", { exact: true }),
  ).toBeInViewport();
  await expect
    .poll(() =>
      conversation.evaluate(
        (element) =>
          element.scrollHeight - element.clientHeight - element.scrollTop,
      ),
    )
    .toBeLessThan(5);
  await page
    .getByText("Demo actions and common requests", { exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Demo: advance to payment due date",
      exact: true,
    })
    .click();
  await expect(page.locator("details.agent-tools")).not.toHaveAttribute("open");
  await expect(page.locator(".agent-error")).toContainText(
    "Unable to complete the operation",
  );
});
