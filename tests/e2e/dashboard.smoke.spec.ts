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
  expect(dashboard.devices).toHaveLength(2);
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
  await expect(
    page.locator(".system-header").getByText("Online", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("2.5G", { exact: true })).toHaveCount(0);
  await expect(
    page.locator(".device-card").getByText("CPU", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".device-card").getByText("MEM", { exact: true }),
  ).toHaveCount(0);
  const copyIpButtons = page.getByRole("button", {
    name: /Copy .* IP address/,
  });
  await expect(copyIpButtons).toHaveCount(dashboard.devices.length);
  await copyIpButtons.first().click();
  await expect(page.getByRole("button", { name: /IP copied$/ })).toHaveCount(1);
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
    const topbarInner = document.querySelector(".topbar-inner");
    const footerInner = document.querySelector(".footer-inner");
    const systemHeaders = [...document.querySelectorAll(".system-header")];
    const sections = [...document.querySelectorAll(".dashboard-section")];

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      topbarInnerHeight: topbarInner!.getBoundingClientRect().height,
      footerInnerHeight: footerInner!.getBoundingClientRect().height,
      statusTextSizes: [
        ...document.querySelectorAll(".status-cluster > *"),
      ].map((item) => Number.parseFloat(getComputedStyle(item).fontSize)),
      systemHeaderHeights: systemHeaders.map(
        (header) => header.getBoundingClientRect().height,
      ),
      systemLogoInsets: systemHeaders.map((header) => {
        const headerBounds = header.getBoundingClientRect();
        const logoBounds = header
          .querySelector(".system-glyph")!
          .getBoundingClientRect();
        return {
          top: logoBounds.top - headerBounds.top,
          bottom: headerBounds.bottom - logoBounds.bottom,
        };
      }),
      deviceCardHeights: [...document.querySelectorAll(".device-card")].map(
        (card) => card.getBoundingClientRect().height,
      ),
      deviceActionSizes: [...document.querySelectorAll(".device-actions")].map(
        (actions) =>
          [...actions.querySelectorAll("a, button")].map((action) => {
            const bounds = action.getBoundingClientRect();
            return { width: bounds.width, height: bounds.height };
          }),
      ),
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
  expect(layout.topbarInnerHeight).toBe(35);
  expect(layout.footerInnerHeight).toBe(29);
  expect(layout.statusTextSizes).toEqual([8, 8]);
  expect(layout.systemHeaderHeights).toEqual([58, 58, 58]);
  expect(layout.systemLogoInsets).toEqual([
    { top: 12, bottom: 12 },
    { top: 12, bottom: 12 },
    { top: 12, bottom: 12 },
  ]);
  expect(layout.deviceCardHeights.every((height) => height <= 90)).toBe(true);
  expect(
    layout.deviceActionSizes.every((sizes) =>
      sizes.every(({ width, height }) => width === 14 && height === 14),
    ),
  ).toBe(true);
  expect(layout.headerGap).toBe(5);
  expect(layout.sectionGaps).toEqual([5, 5, 5]);
});
