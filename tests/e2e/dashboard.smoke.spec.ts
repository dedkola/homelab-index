import { expect, test } from "@playwright/test";

test("renders the approved 4K dashboard and API contract", async ({
  page,
  request,
}) => {
  const healthResponse = await request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);

  const dashboardResponse = await request.get("/api/dashboard");
  expect(dashboardResponse.ok()).toBe(true);
  const dashboard = (await dashboardResponse.json()) as {
    systems: unknown[];
    unifi: unknown;
    devices: unknown[];
    links: unknown[];
  };
  expect(dashboard.systems).toHaveLength(2);
  expect(dashboard.unifi).toBeTruthy();
  expect(dashboard.devices).toHaveLength(8);
  expect(dashboard.links).toHaveLength(10);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Network" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Core systems" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "LAN workloads" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quick links" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proxmox" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unraid" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UniFi" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(11);
  await expect(
    page.getByRole("link", { name: /Open .* in a new window/ }),
  ).toHaveCount(18);

  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
  }));

  expect(layout.documentWidth).toBe(layout.viewportWidth);
  expect(layout.documentHeight).toBeLessThanOrEqual(2160);
});
