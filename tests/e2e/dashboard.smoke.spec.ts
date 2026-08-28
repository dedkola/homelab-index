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
    devices: { url?: string }[];
    links: unknown[];
  };
  expect(dashboard.systems).toHaveLength(2);
  expect(dashboard.unifi).toBeTruthy();
  expect(dashboard.devices.length).toBeGreaterThanOrEqual(8);
  expect(dashboard.links).toHaveLength(10);

  await page.goto("/");

  for (const sectionTitle of [
    "Network",
    "Core systems",
    "LAN workloads",
    "Quick links",
  ]) {
    await expect(
      page.getByRole("heading", { name: sectionTitle }),
    ).toBeAttached();
    await expect(page.getByRole("heading", { name: sectionTitle })).toHaveCSS(
      "clip-path",
      "inset(50%)",
    );
  }
  await expect(page.getByRole("heading", { name: "Proxmox" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unraid" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UniFi" })).toBeVisible();
  await expect(page.locator("[data-system-logo]")).toHaveCount(3);
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(
    dashboard.devices.length + 3,
  );
  await expect(
    page.getByRole("link", { name: /Open .* in a new window/ }),
  ).toHaveCount(
    dashboard.devices.filter((device) => device.url).length +
      dashboard.links.length,
  );

  const layout = await page.evaluate(() => {
    const topbar = document.querySelector(".topbar");
    const sections = [...document.querySelectorAll(".dashboard-section")];

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      headerGap:
        sections[0].getBoundingClientRect().top -
        topbar!.getBoundingClientRect().bottom,
      sectionGaps: sections
        .slice(1)
        .map(
          (section, index) =>
            section.getBoundingClientRect().top -
            sections[index].getBoundingClientRect().bottom,
        ),
    };
  });

  expect(layout.documentWidth).toBe(layout.viewportWidth);
  expect(layout.documentHeight).toBeLessThanOrEqual(2160);
  expect(layout.headerGap).toBe(5);
  expect(layout.sectionGaps).toEqual([5, 5, 5]);
});
